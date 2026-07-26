import { z } from "zod";

export const conversationJoinSchema = z.object({
  conversationId: z.string().uuid(),
});

export const messageSendSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  clientMsgId: z.string().uuid(),
});

export const typingSchema = z.object({
  conversationId: z.string().uuid(),
});

export const messageReadSchema = z.object({
  conversationId: z.string().uuid(),
  readAt: z.string().datetime().optional(),
});

export type ConversationJoinInput = z.infer<typeof conversationJoinSchema>;
export type MessageSendInput = z.infer<typeof messageSendSchema>;
export type TypingInput = z.infer<typeof typingSchema>;
export type MessageReadInput = z.infer<typeof messageReadSchema>;
