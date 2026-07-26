-- Slack Lite schema: profiles, conversations, members, messages + RLS

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create type public.conversation_type as enum ('dm', 'channel');

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type public.conversation_type not null,
  name text,
  created_by uuid not null references public.profiles (id) on delete cascade,
  dm_key text unique,
  created_at timestamptz not null default now(),
  constraint conversations_dm_name_check check (
    (type = 'channel' and name is not null)
    or (type = 'dm' and name is null)
  )
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

create or replace function public.is_member(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = coalesce(p_user_id, auth.uid())
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  candidate text;
  suffix int := 0;
begin
  base_username := lower(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      split_part(new.email, '@', 1),
      'user'
    )
  );
  candidate := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');
  if candidate = '' then
    candidate := 'user';
  end if;

  loop
    begin
      insert into public.profiles (id, username, display_name)
      values (
        new.id,
        case when suffix = 0 then candidate else candidate || suffix::text end,
        coalesce(new.raw_user_meta_data ->> 'display_name', candidate)
      );
      exit;
    exception when unique_violation then
      suffix := suffix + 1;
    end;
  end loop;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Members can view conversations"
  on public.conversations for select
  to authenticated
  using (public.is_member(id));

create policy "Authenticated users can create conversations"
  on public.conversations for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "Members can view conversation membership"
  on public.conversation_members for select
  to authenticated
  using (public.is_member(conversation_id));

create policy "Users can join conversations they create"
  on public.conversation_members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
  );

create policy "Members can view messages"
  on public.messages for select
  to authenticated
  using (public.is_member(conversation_id));

create policy "Members can send messages"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_member(conversation_id)
  );

create or replace function public.create_dm(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  dm uuid;
  key text;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  if other_user_id = me then
    raise exception 'Cannot DM yourself';
  end if;

  if not exists (select 1 from public.profiles where id = other_user_id) then
    raise exception 'User not found';
  end if;

  key := case when me::text < other_user_id::text
    then me::text || ':' || other_user_id::text
    else other_user_id::text || ':' || me::text
  end;

  select id into dm from public.conversations where dm_key = key;
  if dm is not null then
    return dm;
  end if;

  insert into public.conversations (type, created_by, dm_key)
  values ('dm', me, key)
  returning id into dm;

  insert into public.conversation_members (conversation_id, user_id, role)
  values
    (dm, me, 'member'),
    (dm, other_user_id, 'member');

  return dm;
end;
$$;

grant execute on function public.create_dm(uuid) to authenticated;

create or replace function public.create_channel(channel_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  channel_id uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  if channel_name is null or btrim(channel_name) = '' then
    raise exception 'Channel name required';
  end if;

  insert into public.conversations (type, name, created_by)
  values ('channel', btrim(channel_name), me)
  returning id into channel_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (channel_id, me, 'owner');

  return channel_id;
end;
$$;

grant execute on function public.create_channel(text) to authenticated;

create or replace function public.join_channel(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.conversations
    where id = p_conversation_id and type = 'channel'
  ) then
    raise exception 'Channel not found';
  end if;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (p_conversation_id, me, 'member')
  on conflict do nothing;
end;
$$;

grant execute on function public.join_channel(uuid) to authenticated;
