'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { signOut } from 'next-auth/react';

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  lastMessageAt: string | null;
  adminUnread: boolean;
  anonymousToken: string;
  preview: string;
}

interface MessageRecord {
  id: string;
  content: string;
  sender: 'USER' | 'ADMIN';
  createdAt: string;
}

export default function AdminInbox() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageHistory, setMessageHistory] = useState<MessageRecord[]>([]);
  const [draft, setDraft] = useState('');
  const [userTyping, setUserTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const loadConversations = async () => {
    const response = await fetch('/api/admin/conversations', { cache: 'no-store' });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    setConversations(data.conversations ?? []);
  };

  const loadConversation = async (conversationId: string) => {
    const response = await fetch(`/api/admin/conversations/${conversationId}`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    setMessageHistory(data.messages ?? []);
    setSelectedConversationId(conversationId);
  };

  useEffect(() => {
    loadConversations();
    const socket = io({ path: '/socket.io', transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('register:admin');
    });

    socket.on('conversation:update', (payload) => {
      loadConversations();
      if (payload.conversationId === selectedConversationId) {
        loadConversation(payload.conversationId);
      }
    });

    socket.on('typing:start', (payload) => {
      if (payload.userType === 'USER' && payload.conversationId === selectedConversationId) {
        setUserTyping(true);
      }
    });

    socket.on('typing:stop', (payload) => {
      if (payload.userType === 'USER' && payload.conversationId === selectedConversationId) {
        setUserTyping(false);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedConversationId]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [draft]);

  const handleSendReply = async () => {
    if (!selectedConversationId || !draft.trim()) return;
    const response = await fetch(`/api/admin/conversations/${selectedConversationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: draft.trim() })
    });

    if (!response.ok) return;

    setDraft('');
    socketRef.current?.emit('typing:stop', {
      conversationId: selectedConversationId,
      userType: 'ADMIN'
    });
    await loadConversations();
    await loadConversation(selectedConversationId);
  };

  const handleTyping = (isTyping: boolean) => {
    if (!selectedConversationId) return;
    socketRef.current?.emit(isTyping ? 'typing:start' : 'typing:stop', {
      conversationId: selectedConversationId,
      userType: 'ADMIN'
    });
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <aside className="w-[380px] border-r border-slate-800 bg-slate-900/90 p-3">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin</p>
            <h1 className="text-xl font-semibold text-white">Inbox</h1>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/admin/login' })}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>

        <div className="space-y-2 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
              No conversations.
            </div>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => loadConversation(conversation.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedConversationId === conversation.id
                    ? 'border-sky-500 bg-slate-800'
                    : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-white">
                    {conversation.anonymousToken.slice(0, 8)} • {conversation.title}
                  </span>
                  {conversation.adminUnread ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  ) : null}
                </div>
                <p className="line-clamp-2 text-sm text-slate-300">{conversation.preview || 'No messages yet.'}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'New'}</span>
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">
                    Online
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex flex-1 flex-col bg-slate-950">
        {selectedConversationId ? (
          <>
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Conversation</p>
                <h2 className="text-lg font-semibold text-white">
                  {conversations.find((conversation) => conversation.id === selectedConversationId)?.title ?? 'Chat'}
                </h2>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {messageHistory.map((message) => {
                const isUser = message.sender === 'USER';
                return (
                  <div key={message.id} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-2xl rounded-2xl border px-4 py-3 ${
                        isUser
                          ? 'border-slate-700 bg-slate-900 text-slate-100'
                          : 'border-sky-500/50 bg-sky-500/10 text-slate-100'
                      }`}
                    >
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        {isUser ? 'User' : 'Assistant'}
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                    </div>
                  </div>
                );
              })}

              {userTyping ? (
                <div className="flex justify-start">
                  <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                    User is typing...
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-slate-800 bg-slate-950 p-4">
              <div className="flex items-end gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-3">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    const isTyping = event.target.value.trim().length > 0;
                    handleTyping(isTyping);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSendReply();
                    }
                  }}
                  placeholder="Reply as Assistant..."
                  className="max-h-40 min-h-[44px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-base text-white outline-none placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={handleSendReply}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700"
                  disabled={!draft.trim()}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-slate-400">Select a conversation to begin.</div>
        )}
      </section>
    </div>
  );
}
