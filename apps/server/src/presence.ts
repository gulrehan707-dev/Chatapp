import type { PresenceStatus } from "@slack-lite/shared";
import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@slack-lite/shared";
import { supabaseAdmin } from "./lib/supabase.js";

const userSockets = new Map<string, Set<string>>();

export function roomName(conversationId: string): string {
  return `room:${conversationId}`;
}

export function trackConnection(
  io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  userId: string,
  socketId: string,
): void {
  const sockets = userSockets.get(userId) ?? new Set<string>();
  const wasOffline = sockets.size === 0;
  sockets.add(socketId);
  userSockets.set(userId, sockets);

  if (wasOffline) {
    void supabaseAdmin
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", userId);
    io.emit("presence:update", { userId, status: "online" satisfies PresenceStatus });
  }
}

export async function untrackConnection(
  io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  userId: string,
  socketId: string,
): Promise<void> {
  const sockets = userSockets.get(userId);
  if (!sockets) {
    return;
  }

  sockets.delete(socketId);
  if (sockets.size > 0) {
    userSockets.set(userId, sockets);
    return;
  }

  userSockets.delete(userId);
  const lastSeenAt = new Date().toISOString();
  await supabaseAdmin
    .from("profiles")
    .update({ last_seen_at: lastSeenAt })
    .eq("id", userId);

  io.emit("presence:update", {
    userId,
    status: "offline",
    lastSeenAt,
  });
}

export function isUserOnline(userId: string): boolean {
  return (userSockets.get(userId)?.size ?? 0) > 0;
}

export function getOnlineUserIds(): string[] {
  return Array.from(userSockets.keys());
}
