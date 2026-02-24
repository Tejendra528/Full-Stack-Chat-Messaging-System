'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { usePresence } from '@/components/PresenceProvider';
import { conversations, users, type User, type Conversation } from '@/lib/api';

function formatTime(date: string | null | undefined) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getOtherParticipant(participants: { user: User }[], myId: string): User | null {
  const other = participants.find((p) => (p.user as User)._id !== myId);
  return other ? (other.user as User) : null;
}

function lastMessagePreview(lastMessage: { content?: string; type?: string } | null | undefined): string {
  if (!lastMessage) return 'No messages yet';
  if (lastMessage.type !== 'text') return 'Attachment';
  return (lastMessage.content || '').slice(0, 40) + ((lastMessage.content?.length || 0) > 40 ? '…' : '');
}

export default function ArchivedChatsPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const presence = usePresence();
  const [list, setList] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    conversations
      .list({ archived: true })
      .then((r) => setList(r.conversations))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [token]);

  const unarchiveChat = async (c: Conversation, e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const updated = await conversations.setArchived(c._id, false);
      setList((prev) => prev.filter((x) => x._id !== updated._id));
    } catch {
      // ignore
    }
  };

  const deleteChat = async (c: Conversation, e: React.MouseEvent) => {
    e.preventDefault();
    if (!window.confirm('Delete this conversation for all participants?')) return;
    try {
      await conversations.delete(c._id);
      setList((prev) => prev.filter((x) => x._id !== c._id));
    } catch {
      // ignore for now
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
      <div className="p-3 border-b border-chat-border bg-chat-panel/50 flex items-center gap-2">
        <Link
          href="/chats"
          className="text-zinc-400 hover:text-zinc-100 transition"
        >
          ← Back
        </Link>
        <h1 className="font-semibold text-lg">Archived Chats</h1>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin">
        {loading ? (
          <div className="p-6 text-center text-zinc-400">Loading archived chats...</div>
        ) : list.length === 0 ? (
          <div className="p-6 text-center text-zinc-400">
            No archived chats.
          </div>
        ) : (
          <ul>
            {list.map((c) => {
              const other = getOtherParticipant(c.participants as any, user._id);
              const onlineOverride =
                other && presence[other._id] ? presence[other._id].isOnline : other?.isOnline;
              const name = c.type === 'group' ? c.name : (other?.name || 'Unknown');
              const lastMsg = c.lastMessage;
              const displayName = name || 'Unknown';
              return (
                <Link key={c._id} href={`/chats/${c._id}`}>
                  <li className="flex items-center gap-3 p-3 border-b border-chat-border hover:bg-chat-panel/70 transition">
                    <div className="w-12 h-12 rounded-full bg-chat-accent/30 flex items-center justify-center text-chat-accent font-semibold shrink-0">
                      {displayName[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-medium truncate">{name}</p>
                          {other && (
                            <span
                              className={`inline-flex h-2 w-2 rounded-full ${
                                onlineOverride ? 'bg-emerald-400' : 'bg-zinc-500'
                              }`}
                            />
                          )}
                        </div>
                        <span className="text-xs text-zinc-500 shrink-0">
                          {formatTime(lastMsg?.createdAt || c.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400 truncate">
                        {lastMessagePreview(lastMsg)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs text-zinc-500">
                      <button
                        type="button"
                        onClick={(e) => unarchiveChat(c, e)}
                        className="hover:text-chat-accent"
                      >
                        Unarchive
                      </button>
                      <button
                        type="button"
                        onClick={(e) => deleteChat(c, e)}
                        className="hover:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                </Link>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
