-- Allow authenticated users to discover public channels before joining
drop policy if exists "Authenticated users can browse channels" on public.conversations;
create policy "Authenticated users can browse channels"
  on public.conversations for select
  to authenticated
  using (type = 'channel');
