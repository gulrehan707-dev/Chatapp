export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  last_seen_at: string | null;
};

export type Conversation = {
  id: string;
  type: "dm" | "channel";
  name: string | null;
  created_at: string;
};

export type ConversationListItem = Conversation & {
  otherUser?: Profile | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
