import { ChatRoom } from "@/components/chat-room";
import { joinChannel } from "@/app/actions/auth";
import { getConversationMembers, getMessages } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ join?: string }>;
}) {
  const { conversationId } = await params;
  const { join } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  if (join === "1") {
    await joinChannel(conversationId);
  }

  const [messages, members, conversationResult] = await Promise.all([
    getMessages(conversationId),
    getConversationMembers(conversationId),
    supabase
      .from("conversations")
      .select("id, type, name")
      .eq("id", conversationId)
      .maybeSingle(),
  ]);

  const conversation = conversationResult.data;

  const title =
    conversation?.type === "channel"
      ? `# ${conversation.name}`
      : members.find((member) => member.id !== user.id)?.display_name ??
        "Direct message";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b px-4 py-3">
        <h1 className="text-lg font-semibold">{title}</h1>
      </header>
      <ChatRoom
        conversationId={conversationId}
        currentUserId={user.id}
        initialMessages={messages}
        members={members}
      />
    </div>
  );
}
