export type SenderType = 'USER' | 'ADMIN';

export interface MessageRecord {
  id: string;
  conversationId: string;
  sender: SenderType;
  content: string;
  createdAt: string;
  read: boolean;
}

export interface ConversationRecord {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  adminUnread: boolean;
  lastMessageAt: string | null;
  anonymousUser?: {
    anonymousToken: string;
  } | null;
}
