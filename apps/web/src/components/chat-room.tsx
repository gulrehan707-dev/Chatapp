"use client";

import { useEffect, useMemo, useState } from "react";
import { useSocket } from "@/components/socket-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Message, Profile } from "@/lib/types";

type LocalMessage = Message & {
  pending?: boolean;
  clientMsgId?: string;
};

export function ChatRoom({
  conversationId,
  currentUserId,
  initialMessages,
  members,
}: {
  conversationId: string;
  currentUserId: string;
  initialMessages: Message[];
  members: Profile[];
}) {
  const { joinConversation, sendMessage, setTyping, onMessage, onTyping } =
    useSocket();
  const [messages, setMessages] = useState<LocalMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );

  useEffect(() => {
    joinConversation(conversationId);
  }, [conversationId, joinConversation]);

  useEffect(() => {
    return onMessage((message) => {
      if (message.conversationId !== conversationId) {
        return;
      }

      setMessages((prev) => {
        const withoutPending = prev.filter(
          (item) => !item.clientMsgId || item.clientMsgId !== message.clientMsgId,
        );
        const exists = withoutPending.some((item) => item.id === message.id);
        if (exists) {
          return withoutPending;
        }
        return [
          ...withoutPending,
          {
            id: message.id,
            conversation_id: message.conversationId,
            sender_id: message.senderId,
            body: message.body,
            created_at: message.createdAt,
          },
        ];
      });
    });
  }, [conversationId, onMessage]);

  useEffect(() => {
    return onTyping((payload) => {
      if (payload.conversationId !== conversationId) {
        return;
      }
      if (payload.userId === currentUserId) {
        return;
      }

      setTypingUsers((prev) => {
        if (payload.isTyping) {
          return prev.includes(payload.userId)
            ? prev
            : [...prev, payload.userId];
        }
        return prev.filter((id) => id !== payload.userId);
      });
    });
  }, [conversationId, currentUserId, onTyping]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      return;
    }

    const clientMsgId = crypto.randomUUID();
    const optimistic: LocalMessage = {
      id: clientMsgId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      body: trimmed,
      created_at: new Date().toISOString(),
      pending: true,
      clientMsgId,
    };

    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    setTyping(conversationId, false);
    sendMessage({ conversationId, body: trimmed, clientMsgId });
  }

  const typingLabel = typingUsers
    .map((userId) => memberMap.get(userId)?.display_name ?? "Someone")
    .join(", ");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="flex-1 space-y-3 p-4">
        {messages.map((message) => {
          const sender = memberMap.get(message.sender_id);
          const mine = message.sender_id === currentUserId;
          return (
            <div
              key={message.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  mine
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                }`}
              >
                {!mine && (
                  <p className="mb-1 text-xs font-semibold opacity-70">
                    {sender?.display_name ?? "User"}
                  </p>
                )}
                <p>{message.body}</p>
              </div>
            </div>
          );
        })}
      </ScrollArea>

      {typingLabel ? (
        <p className="px-4 pb-2 text-xs text-zinc-500">
          {typingLabel} {typingUsers.length === 1 ? "is" : "are"} typing...
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-4">
        <Input
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            setTyping(conversationId, event.target.value.length > 0);
          }}
          placeholder="Message..."
        />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
