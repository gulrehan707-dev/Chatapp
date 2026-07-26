import { createClient } from "@/lib/supabase/server";
import type { ConversationListItem, Message, Profile } from "@/lib/types";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, last_seen_at")
    .eq("id", user.id)
    .maybeSingle();

  return data;
}

export async function getConversations(
  userId: string,
): Promise<ConversationListItem[]> {
  const supabase = await createClient();

  const { data: memberships, error } = await supabase
    .from("conversation_members")
    .select(
      "conversation_id, conversations(id, type, name, created_at), user_id",
    )
    .eq("user_id", userId);

  if (error || !memberships) {
    return [];
  }

  const conversations = memberships
    .map((row) => {
      const conversation = row.conversations;
      if (!conversation || Array.isArray(conversation)) {
        return null;
      }
      return conversation as ConversationListItem;
    })
    .filter((conversation): conversation is ConversationListItem =>
      Boolean(conversation),
    );

  const dmConversations = conversations.filter((c) => c.type === "dm");
  const dmIds = dmConversations.map((c) => c.id);

  if (dmIds.length === 0) {
    return conversations;
  }

  const { data: dmMembers } = await supabase
    .from("conversation_members")
    .select("conversation_id, profiles(id, username, display_name, avatar_url, last_seen_at)")
    .in("conversation_id", dmIds)
    .neq("user_id", userId);

  const otherByConversation = new Map<string, Profile>();
  for (const member of dmMembers ?? []) {
    if (member.profiles) {
      otherByConversation.set(
        member.conversation_id,
        member.profiles as unknown as Profile,
      );
    }
  }

  return conversations.map((conversation) =>
    conversation.type === "dm"
      ? {
          ...conversation,
          otherUser: otherByConversation.get(conversation.id) ?? null,
        }
      : conversation,
  );
}

export async function getMessages(
  conversationId: string,
  limit = 50,
): Promise<Message[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  return data ?? [];
}

export async function searchProfiles(query: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, last_seen_at")
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .neq("id", userId)
    .limit(10);

  return data ?? [];
}

export async function getConversationMembers(
  conversationId: string,
): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversation_members")
    .select("profiles(id, username, display_name, avatar_url, last_seen_at)")
    .eq("conversation_id", conversationId);

  const profiles: Profile[] = [];
  for (const row of data ?? []) {
    const profile = row.profiles;
    if (profile && !Array.isArray(profile)) {
      profiles.push(profile as Profile);
    }
  }
  return profiles;
}

export async function getJoinableChannels(userId: string) {
  const supabase = await createClient();

  const { data: memberRows } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);

  const joined = new Set((memberRows ?? []).map((row) => row.conversation_id));

  const { data: channels } = await supabase
    .from("conversations")
    .select("id, type, name, created_at")
    .eq("type", "channel")
    .order("created_at", { ascending: false })
    .limit(20);

  return (channels ?? []).filter((channel) => !joined.has(channel.id));
}
