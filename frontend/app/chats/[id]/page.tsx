'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { usePresence } from '@/components/PresenceProvider';
import { useSocketConversation } from '@/hooks/useSocket';
import { conversations, messages, type Conversation, type Message } from '@/lib/api';

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function StatusIcon({ status }: { status?: string }) {
  if (status === 'seen')
    return (
      <span className="text-blue-400" title="Seen">
        ✓✓
      </span>
    );
  if (status === 'delivered')
    return (
      <span className="text-zinc-400" title="Delivered">
        ✓✓
      </span>
    );
  return (
    <span className="text-zinc-500" title="Sent">
      ✓
    </span>
  );
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();
  const presence = usePresence();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
const isTypingRef = useRef(false);
const [sending, setSending] = useState(false);
  const {
    messages: liveMessages,
    setMessages,
    sendMessage,
    startTyping,
    stopTyping,
    markSeen,
    typingUser,
  } = useSocketConversation(id || null);
  
  const loadConversation = useCallback(async () => {
    if (!id) return;
    try {
      const c = await conversations.get(id);
      setConv(c);
    } catch {
      router.push('/chats');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const loadHistory = useCallback(
    async (pageNum: number) => {
      if (!id) return;
      setLoadingMore(true);
      try {
        const { messages: msgs } = await messages.list(id, { page: pageNum, limit: 30 });
        setMessages((prev) => {
          const byId = new Map(prev.map((m) => [m._id, m]));
          msgs.forEach((m) => byId.set(m._id, m));
          const merged = Array.from(byId.values()).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          return merged;
        });
      } finally {
        setLoadingMore(false);
      }
    },
    [id, setMessages]
  );

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (!id) return;
    loadHistory(1);
    markSeen();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

useEffect(() => {
  if (!listRef.current) return;

  const container = listRef.current;
  const isNearBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight < 100;

  if (isNearBottom) {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }
}, [liveMessages]);

  useEffect(() => {
    markSeen();
  }, [liveMessages.length, markSeen]);

  const handleSend = async (e: React.FormEvent) => {
  e.preventDefault();

  const text = input.trim();
  if (!text || sending) return;

  setSending(true);

  try {
    await sendMessage(text);
    setInput('');
    stopTyping();
    isTypingRef.current = false;
  } catch (err) {
    console.error('Send failed:', err);
  } finally {
    setSending(false);
  }
};

  const loadingMoreRef = useRef(false);
  loadingMoreRef.current = loadingMore;

  const handleScroll = () => {
    if (!listRef.current || loadingMoreRef.current) return;
    if (listRef.current.scrollTop < 100) {
      setPage((p) => {
        const next = p + 1;
        loadHistory(next);
        return next;
      });
    }
  };

  const otherParticipant = conv?.participants?.find(
    (p) => (p.user as { _id: string })?._id !== user?._id
  );
  const chatName =
    conv?.type === 'group' ? conv.name : (otherParticipant?.user as { name?: string })?.name || 'Chat';

  const otherUserId = (otherParticipant?.user as any)?._id as string | undefined;
  const onlineOverride =
    otherUserId && presence[otherUserId] ? presence[otherUserId].isOnline : (otherParticipant?.user as any)?.isOnline;

  const baseApi = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(
    /\/api\/?$/,
    ''
  );

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !id) return;
    const file = e.target.files[0];
    const form = new FormData();
    form.append('file', file);
    form.append('conversationId', id);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/messages/upload`,
        {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      const msg: Message = data.message;
      setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
    } catch {
      // ignore upload errors for now
    } finally {
      e.target.value = '';
    }
  };

  if (loading || !conv) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-chat-panel border-b border-chat-border shrink-0">
        <Link
          href="/chats"
          className="text-zinc-400 hover:text-zinc-100 transition"
          aria-label="Back"
        >
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate flex items-center gap-2">
            {chatName}
            {otherParticipant && (
              <span
                className={`inline-flex h-2 w-2 rounded-full ${
                  onlineOverride ? 'bg-emerald-400' : 'bg-zinc-500'
                }`}
              />
            )}
          </h1>
          {typingUser && (
            <p className="text-xs text-chat-accent">{typingUser.userName} is typing...</p>
          )}
        </div>
      </header>

      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-2 scroll-thin"
      >
        {loadingMore && (
          <div className="text-center text-sm text-zinc-500 py-2">Loading more...</div>
        )}
        {liveMessages.length === 0 && !loadingMore && (
  <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
    No messages yet. Start the conversation 👋
  </div>
)}
        {liveMessages.map((m) => {
          const isMe =
            (m.sender as { _id?: string })?._id === user?._id ||
            (typeof m.sender === 'string' && m.sender === user?._id);
          const senderName =
            typeof m.sender === 'object' && m.sender && 'name' in m.sender
              ? (m.sender as { name?: string }).name
              : '';

          const isImage = m.type === 'image' && m.attachment?.url;
          const isFile = m.type === 'file' && m.attachment?.url;
          const attachmentUrl = m.attachment?.url
            ? m.attachment.url.startsWith('http')
              ? m.attachment.url
              : `${baseApi}${m.attachment.url}`
            : null;

          return (
            <div
              key={m._id}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  isMe
                    ? 'bg-chat-accent text-white rounded-br-md'
                    : 'bg-chat-bubbleIn border border-chat-border rounded-bl-md'
                }`}
              >
                {conv.type === 'group' && !isMe && (
                  <p className="text-xs font-medium text-chat-accent mb-0.5">{senderName}</p>
                )}
                {isImage && attachmentUrl ? (
                  <div className="space-y-1">
                    <img
                      src={attachmentUrl}
                      alt={m.attachment?.filename || 'Image'}
                      className="max-h-64 rounded-lg object-cover"
                    />
                    {m.content && <p className="text-sm break-words mt-1">{m.content}</p>}
                  </div>
                ) : isFile && attachmentUrl ? (
                  <a
                    href={attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm underline break-all"
                  >
                    {m.attachment?.filename || 'Download file'}
                  </a>
                ) : (
                  <p className="text-sm break-words">{m.content || 'Attachment'}</p>
                )}
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-xs opacity-80">{formatTime(m.createdAt)}</span>
                  {isMe && <StatusIcon status={m.status} />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="p-3 border-t border-chat-border bg-chat-panel/50 shrink-0"
      >
        <div className="flex gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={handleFileClick}
            className="px-3 py-2 rounded-xl bg-chat-bubbleIn border border-chat-border text-sm text-zinc-200 hover:bg-chat-bubbleOut/70 transition"
          >
            +
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => {
              const value = e.target.value;
              setInput(value);

              if (!isTypingRef.current && value.trim()) {
                startTyping();
                isTypingRef.current = true;
              }

              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
              }
            
              typingTimeoutRef.current = setTimeout(() => {
                stopTyping();
                isTypingRef.current = false;
              }, 1500);
            }}
            onBlur={stopTyping}
            placeholder="Type a message..."
            className="flex-1 rounded-xl bg-chat-bg border border-chat-border px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-chat-accent"
          />
          <button
  type="submit"
  disabled={!input.trim() || sending}
  className="px-4 py-2.5 rounded-xl bg-chat-accent text-white font-medium hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
>
  {sending ? 'Sending...' : 'Send'}
</button>
        </div>
      </form>
    </div>
  );
}

