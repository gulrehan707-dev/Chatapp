import {
  conversationJoinSchema,
  messageReadSchema,
  messageSendSchema,
  typingSchema,
  type MessageRecord,
} from "@slack-lite/shared";
import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@slack-lite/shared";
import { supabaseAdmin } from "../lib/supabase.js";
import { allowRequest } from "../rateLimit.js";
import { roomName, trackConnection, untrackConnection } from "../presence.js";

type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

async function isMember(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

function mapMessage(row: {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}): MessageRecord {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

export function registerSocketHandlers(io: AppServer, socket: AppSocket): void {
  const userId = socket.data.userId;
  trackConnection(io, userId, socket.id);

  socket.on("conversation:join", async (payload) => {
    const parsed = conversationJoinSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("error", { message: "Invalid join payload" });
      return;
    }

    try {
      const member = await isMember(parsed.data.conversationId, userId);
      if (!member) {
        socket.emit("error", { message: "Not a member of this conversation" });
        return;
      }

      await socket.join(roomName(parsed.data.conversationId));
    } catch {
      socket.emit("error", { message: "Failed to join conversation" });
    }
  });

  socket.on("message:send", async (payload) => {
    if (!allowRequest(`message:${socket.id}`)) {
      socket.emit("error", { message: "Rate limit exceeded" });
      return;
    }

    const parsed = messageSendSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("error", { message: "Invalid message payload" });
      return;
    }

    const { conversationId, body, clientMsgId } = parsed.data;

    try {
      const member = await isMember(conversationId, userId);
      if (!member) {
        socket.emit("error", { message: "Not authorized to send messages" });
        return;
      }

      const { data, error } = await supabaseAdmin
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          body,
        })
        .select("id, conversation_id, sender_id, body, created_at")
        .single();

      if (error || !data) {
        socket.emit("error", { message: "Failed to send message" });
        return;
      }

      const message: MessageRecord = {
        ...mapMessage(data),
        clientMsgId,
      };

      socket.emit("message:ack", { clientMsgId, message });
      io.to(roomName(conversationId)).emit("message:new", message);
    } catch {
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  socket.on("typing:start", async (payload) => {
    const parsed = typingSchema.safeParse(payload);
    if (!parsed.success) {
      return;
    }

    if (!(await isMember(parsed.data.conversationId, userId))) {
      return;
    }

    socket
      .to(roomName(parsed.data.conversationId))
      .emit("typing", {
        conversationId: parsed.data.conversationId,
        userId,
        isTyping: true,
      });
  });

  socket.on("typing:stop", async (payload) => {
    const parsed = typingSchema.safeParse(payload);
    if (!parsed.success) {
      return;
    }

    if (!(await isMember(parsed.data.conversationId, userId))) {
      return;
    }

    socket
      .to(roomName(parsed.data.conversationId))
      .emit("typing", {
        conversationId: parsed.data.conversationId,
        userId,
        isTyping: false,
      });
  });

  socket.on("message:read", async (payload) => {
    const parsed = messageReadSchema.safeParse(payload);
    if (!parsed.success) {
      return;
    }

    const readAt = parsed.data.readAt ?? new Date().toISOString();
    await supabaseAdmin
      .from("conversation_members")
      .update({ last_read_at: readAt })
      .eq("conversation_id", parsed.data.conversationId)
      .eq("user_id", userId);
  });

  socket.on("disconnect", () => {
    void untrackConnection(io, userId, socket.id);
  });
}
