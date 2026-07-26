"use client";

import type {
  ClientToServerEvents,
  MessageRecord,
  ServerToClientEvents,
} from "@slack-lite/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, type Socket } from "socket.io-client";
import { createClient } from "@/lib/supabase/client";

type PresenceMap = Record<string, "online" | "offline">;

type SocketContextValue = {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  connected: boolean;
  presence: PresenceMap;
  joinConversation: (conversationId: string) => void;
  sendMessage: (payload: {
    conversationId: string;
    body: string;
    clientMsgId: string;
  }) => void;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  onMessage: (handler: (message: MessageRecord) => void) => () => void;
  onTyping: (
    handler: (payload: {
      conversationId: string;
      userId: string;
      isTyping: boolean;
    }) => void,
  ) => () => void;
};

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<PresenceMap>({});
  const messageHandlers = useRef(
    new Set<(message: MessageRecord) => void>(),
  );
  const typingHandlers = useRef(
    new Set<
      (payload: {
        conversationId: string;
        userId: string;
        isTyping: boolean;
      }) => void
    >(),
  );

  useEffect(() => {
    let active = true;
    let client: Socket<ServerToClientEvents, ClientToServerEvents> | null =
      null;

    async function connect() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token || !active) {
        return;
      }

      client = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000", {
        auth: { token },
        transports: ["websocket"],
      });

      client.on("connect", () => setConnected(true));
      client.on("disconnect", () => setConnected(false));
      client.on("message:new", (message) => {
        messageHandlers.current.forEach((handler) => handler(message));
      });
      client.on("typing", (payload) => {
        typingHandlers.current.forEach((handler) => handler(payload));
      });
      client.on("presence:update", ({ userId, status }) => {
        setPresence((prev) => ({ ...prev, [userId]: status }));
      });

      setSocket(client);
    }

    void connect();

    return () => {
      active = false;
      client?.disconnect();
    };
  }, []);

  const joinConversation = useCallback(
    (conversationId: string) => {
      socket?.emit("conversation:join", { conversationId });
    },
    [socket],
  );

  const sendMessage = useCallback(
    (payload: {
      conversationId: string;
      body: string;
      clientMsgId: string;
    }) => {
      socket?.emit("message:send", payload);
    },
    [socket],
  );

  const setTyping = useCallback(
    (conversationId: string, isTyping: boolean) => {
      if (isTyping) {
        socket?.emit("typing:start", { conversationId });
      } else {
        socket?.emit("typing:stop", { conversationId });
      }
    },
    [socket],
  );

  const onMessage = useCallback((handler: (message: MessageRecord) => void) => {
    messageHandlers.current.add(handler);
    return () => {
      messageHandlers.current.delete(handler);
    };
  }, []);

  const onTyping = useCallback(
    (
      handler: (payload: {
        conversationId: string;
        userId: string;
        isTyping: boolean;
      }) => void,
    ) => {
      typingHandlers.current.add(handler);
      return () => {
        typingHandlers.current.delete(handler);
      };
    },
    [],
  );

  const value = useMemo(
    () => ({
      socket,
      connected,
      presence,
      joinConversation,
      sendMessage,
      setTyping,
      onMessage,
      onTyping,
    }),
    [
      socket,
      connected,
      presence,
      joinConversation,
      sendMessage,
      setTyping,
      onMessage,
      onTyping,
    ],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return context;
}
