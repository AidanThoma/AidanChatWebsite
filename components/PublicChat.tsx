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

    socket.on('conversation:deleted', ({ conversationId }: { conversationId: string }) => {
      setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
      if (conversationId === selectedConversationId) {
        setSelectedConversationId(null);
        setMessages([]);
      }
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

  const handleDeleteConversation = async (conversationId: string) => {
    if (!window.confirm('Delete this conversation and its messages? This cannot be undone.')) return;

    const response = await fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' });
    if (!response.ok) {
      window.alert('Unable to delete this conversation. Please try again.');
      return;
    }

    setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
    if (conversationId === selectedConversationId) {
      setSelectedConversationId(null);
      setMessages([]);
      setDraft('');
    }
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
    return <div className="flex min-h-screen items-center justify-center bg-[#080711] text-slate-200">Loading ThomaGPT...</div>;
  }

  return (
    <div className="flex h-screen bg-[#080711] text-slate-100">
      <aside className="w-full max-w-sm border-r border-violet-300/10 bg-[#100d1b]/95 p-4 shadow-[12px_0_50px_rgba(0,0,0,0.22)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="brand-mark flex h-8 w-8 items-center justify-center rounded-xl text-sm font-black text-white">T</span>
              <p className="brand-text text-sm font-bold tracking-wide">ThomaGPT</p>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Your chats</h1>
          </div>
          <button
            type="button"
            onClick={handleCreateConversation}
            className="rounded-xl border border-violet-300/20 bg-gradient-to-r from-violet-600/90 to-fuchsia-600/90 px-3 py-2 text-sm font-semibold text-white shadow-[0_6px_22px_rgba(147,51,234,0.22)] transition hover:-translate-y-0.5 hover:brightness-110"
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
              <div
                key={conversation.id}
                className={`rounded-xl border p-3 transition ${
                  selectedConversationId === conversation.id
                    ? 'border-violet-400/50 bg-violet-500/10 shadow-[inset_3px_0_0_0_rgba(192,132,252,0.9)]'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-violet-300/20 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-white">{conversation.title}</span>
                      {conversation.adminUnread ? (
                        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
                      ) : null}
                    </span>
                    <span className="mt-1 block line-clamp-2 text-sm text-slate-400">
                      {conversation.preview || 'No messages yet.'}
                    </span>
                    <span className="mt-2 block text-xs text-slate-500">
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
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteConversation(conversation.id)}
                    aria-label={`Delete conversation: ${conversation.title}`}
                    title="Delete conversation"
                    className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <main className="flex flex-1 flex-col bg-[#0b0912]">
        <div className="flex items-center justify-between border-b border-violet-300/10 bg-[#0c0a14]/80 px-6 py-4 backdrop-blur-xl">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300/70">ThomaGPT</p>
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
                        ? 'border-violet-300/15 bg-gradient-to-br from-violet-600/90 to-fuchsia-600/80 text-white shadow-[0_8px_32px_rgba(147,51,234,0.13)]'
                        : 'border-white/[0.07] bg-[#151220] text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.18)]'
                    }`}
                  >
                    <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      {isUser ? 'You' : 'Thoma'}
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
              <div className="rounded-xl border border-violet-300/15 bg-[#171322] px-3 py-2 text-sm text-violet-100">
                Thoma is typing...
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-violet-300/10 bg-[#0c0a14]/90 p-4">
          <div className="flex items-end gap-3 rounded-2xl border border-violet-300/15 bg-[#171322] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.22)] transition focus-within:border-violet-400/50 focus-within:shadow-[0_0_0_3px_rgba(168,85,247,0.1)]">
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
              className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_5px_18px_rgba(147,51,234,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700"
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
