'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  adminUnread: boolean;
  lastMessageAt: string | null;
  preview: string | null;
}

interface MessageRecord {
  id: string;
  conversationId: string;
  sender: 'USER' | 'ADMIN';
  content: string;
  createdAt: string;
  read: boolean;
}

export default function PublicChat() {
  const [anonymousToken, setAnonymousToken] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [assistantTyping, setAssistantTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const refreshConversations = useCallback(async () => {
    if (!anonymousToken) return;
    const response = await fetch('/api/conversations', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    setConversations(data.conversations ?? []);
  }, [anonymousToken]);

  const loadConversationMessages = useCallback(async (conversationId: string) => {
    const response = await fetch(`/api/conversations/${conversationId}`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    setMessages(data.messages ?? []);
    setSelectedConversationId(conversationId);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const response = await fetch('/api/anonymous', { cache: 'no-store' });
      const data = await response.json();
      setAnonymousToken(data.anonymousToken);
      setLoading(false);
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!anonymousToken) return;
    refreshConversations();
    const socket = io({ path: '/socket.io', transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('register:user', { anonymousToken });
      socket.emit('join:conversation', { anonymousToken, conversationId: selectedConversationId });
    });

    socket.on('conversation:update', (payload) => {
      if (payload.conversationId === selectedConversationId) {
        setMessages((current) => {
          const exists = current.some((message) => message.id === payload.message?.id);
          if (!exists && payload.message) {
            return [...current, payload.message];
          }
          return current;
        });
      }
      refreshConversations();
    });

    socket.on('typing:start', (payload) => {
      if (payload.userType === 'ADMIN') {
        setAssistantTyping(true);
      }
    });

    socket.on('typing:stop', (payload) => {
      if (payload.userType === 'ADMIN') {
        setAssistantTyping(false);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [anonymousToken, refreshConversations, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    socketRef.current?.emit('join:conversation', {
      conversationId: selectedConversationId,
      anonymousToken
    });
    loadConversationMessages(selectedConversationId);
  }, [selectedConversationId, anonymousToken, loadConversationMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, assistantTyping]);

  const handleCreateConversation = () => {
    setSelectedConversationId(null);
    setMessages([]);
    setDraft('');
  };

  const handleSendMessage = async () => {
    if (!draft.trim()) return;
    const content = draft.trim();
    setDraft('');

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: selectedConversationId,
        content
      })
    });

    if (!response.ok) {
      setDraft(content);
      return;
    }

    const data = await response.json();
    if (data.conversationId) {
      setSelectedConversationId(data.conversationId);
      setMessages((current) => {
        const existing = current.some((message) => message.id === data.message.id);
        if (!existing) {
          return [...current, data.message];
        }
        return current;
      });
    }

    await refreshConversations();
  };

  const handleTyping = (isTyping: boolean) => {
    if (!selectedConversationId || !anonymousToken) return;
    socketRef.current?.emit(isTyping ? 'typing:start' : 'typing:stop', {
      conversationId: selectedConversationId,
      userType: 'USER',
      anonymousToken
    });
  };

  const inputOnChange = (value: string) => {
    setDraft(value);
    const isTyping = value.trim().length > 0;
    handleTyping(isTyping);
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">Loading chat...</div>;
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <aside className="w-full max-w-sm border-r border-slate-800 bg-slate-900/80 p-3">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">HumanChat</p>
            <h1 className="text-2xl font-semibold text-white">Inbox</h1>
          </div>
          <button
            type="button"
            onClick={handleCreateConversation}
            className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-600"
          >
            New Chat
          </button>
        </div>

        <div className="space-y-2 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
              No conversations yet.
            </div>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelectedConversationId(conversation.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedConversationId === conversation.id
                    ? 'border-sky-500 bg-slate-800'
                    : 'border-slate-800 bg-slate-950/30 hover:border-slate-700'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-white">{conversation.title}</span>
                  {conversation.adminUnread ? (
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
                  ) : null}
                </div>
                <p className="line-clamp-2 text-sm text-slate-400">{conversation.preview || 'No messages yet.'}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {conversation.lastMessageAt
                    ? new Date(conversation.lastMessageAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })
                    : new Date(conversation.updatedAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                </p>
              </button>
            ))
          )}
        </div>
      </aside>

      <main className="flex flex-1 flex-col bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Conversation</p>
            <h2 className="text-lg font-semibold text-white">
              {selectedConversation?.title || 'Start a new conversation'}
            </h2>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
          {selectedConversationId && messages.length === 0 ? (
            <div className="mt-8 text-center text-slate-400">No messages yet.</div>
          ) : (
            messages.map((message) => {
              const isUser = message.sender === 'USER';
              return (
                <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-2xl rounded-2xl border px-4 py-3 shadow-soft ${
                      isUser
                        ? 'border-slate-700 bg-slate-700/90 text-slate-100'
                        : 'border-slate-700 bg-slate-900 text-slate-100'
                    }`}
                  >
                    <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      {isUser ? 'You' : 'Assistant'}
                    </div>
                    <div className="markdown-body text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {assistantTyping ? (
            <div className="flex justify-start">
              <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                Assistant is typing...
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-800 bg-slate-950 p-4">
          <div className="flex items-end gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-3">
            <textarea
              rows={1}
              value={draft}
              onChange={(event) => inputOnChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={selectedConversationId ? 'Message...' : 'Type your message to start a new conversation'}
              className="max-h-40 min-h-[44px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-base text-white outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700"
              disabled={!draft.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
