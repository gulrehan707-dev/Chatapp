import type {
  ConversationJoinInput,
  MessageReadInput,
  MessageSendInput,
  TypingInput,
} from "./schemas.js";

export type MessageRecord = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  clientMsgId?: string;
};

export type PresenceStatus = "online" | "offline";

export type ClientToServerEvents = {
  "conversation:join": (payload: ConversationJoinInput) => void;
  "message:send": (payload: MessageSendInput) => void;
  "typing:start": (payload: TypingInput) => void;
  "typing:stop": (payload: TypingInput) => void;
  "message:read": (payload: MessageReadInput) => void;
};

export type ServerToClientEvents = {
  "message:new": (message: MessageRecord) => void;
  "message:ack": (payload: {
    clientMsgId: string;
    message: MessageRecord;
  }) => void;
  "presence:update": (payload: {
    userId: string;
    status: PresenceStatus;
    lastSeenAt?: string;
  }) => void;
  typing: (payload: {
    conversationId: string;
    userId: string;
    isTyping: boolean;
  }) => void;
  error: (payload: { message: string }) => void;
};

export type InterServerEvents = Record<string, never>;

export type SocketData = {
  userId: string;
};
