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

export default function ChatsPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const presence = usePresence();
  const [list, setList] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [searchUsers, setSearchUsers] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [creatingWith, setCreatingWith] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    conversations
      .list()
      .then((r) => setList(r.conversations))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (searchQ.trim().length < 2) {
      setSearchUsers([]);
      return;
    }
    setSearching(true);
    users
      .search(searchQ.trim())
      .then((r) => setSearchUsers(r.users))
      .catch(() => setSearchUsers([]))
      .finally(() => setSearching(false));
  }, [searchQ]);

  const startChat = async (otherUserId: string) => {
    if (!user || creatingWith) return;
    setCreatingWith(otherUserId);
    try {
      const conv = await conversations.getDirect(otherUserId);
      router.push(`/chats/${conv._id}`);
    } catch {
      setCreatingWith(null);
    } finally {
      setCreatingWith(null);
    }
  };

  const togglePin = async (c: Conversation, e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const me = c.participants.find((p) => p.user._id === user?._id);
      const pinned = !me?.isPinned;
      const updated = await conversations.setPinned(c._id, pinned);
      setList((prev) => prev.map((x) => (x._id === updated._id ? updated : x)));
    } catch {
      // ignore
    }
  };

  const archiveChat = async (c: Conversation, e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const updated = await conversations.setArchived(c._id, true);
      setList((prev) => prev.filter((x) => x._id !== updated._id));
    } catch {
      // ignore
    }
  };

  const deleteChat = async (c: Conversation, e: React.MouseEvent) => {
    e.preventDefault();
    if (deletingId) return;
    // Optional: lightweight confirm to avoid accidental deletion
    if (!window.confirm('Delete this conversation for all participants?')) return;
    setDeletingId(c._id);
    try {
      await conversations.delete(c._id);
      setList((prev) => prev.filter((x) => x._id !== c._id));
    } catch {
      // ignore for now
    } finally {
      setDeletingId(null);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
      <div className="p-3 border-b border-chat-border bg-chat-panel/50 flex items-center gap-2">
        <input
          type="search"
          placeholder="Search chats or users..."
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          className="flex-1 rounded-lg bg-chat-bg border border-chat-border px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-chat-accent"
        />
        <button
          type="button"
          onClick={() => router.push('/chats/archived')}
          className="px-3 py-2 rounded-lg bg-chat-bubbleIn border border-chat-border text-xs font-medium text-zinc-300 hover:bg-chat-bubbleOut/50 whitespace-nowrap"
        >
          Archived
        </button>
        <button
          type="button"
          onClick={() => router.push('/chats/new-group')}
          className="ml-2 px-3 py-2 rounded-lg bg-chat-accent text-xs font-medium text-white hover:opacity-90 whitespace-nowrap"
        >
          New group
        </button>
      </div>

      {searchQ.trim().length >= 2 && (
        <div className="border-b border-chat-border bg-chat-panel/80 p-2 max-h-48 overflow-y-auto scroll-thin">
          <p className="text-xs text-zinc-500 px-2 py-1">Users</p>
          {searching ? (
            <p className="text-sm text-zinc-400 p-2">Searching...</p>
          ) : searchUsers.length === 0 ? (
            <p className="text-sm text-zinc-400 p-2">No users found</p>
          ) : (
            <ul>
              {searchUsers.map((u) => (
                <li key={u._id}>
                  <button
                    type="button"
                    onClick={() => startChat(u._id)}
                    disabled={creatingWith === u._id}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-chat-bubbleOut/50 text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-chat-accent/30 flex items-center justify-center text-chat-accent font-medium">
                      {(u.name || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{u.name}</p>
                      <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                    </div>
                    {creatingWith === u._id && (
                      <span className="text-xs text-zinc-400">Opening...</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto scroll-thin">
        {loading ? (
          <div className="p-6 text-center text-zinc-400">Loading chats...</div>
        ) : list.length === 0 ? (
          <div className="p-6 text-center text-zinc-400">
            No chats yet. Search for a user above to start a conversation.
          </div>
        ) : (
          <ul>
            {list.map((c) => {
              const other = getOtherParticipant(c.participants as any, user._id);
              const onlineOverride =
                other && presence[other._id] ? presence[other._id].isOnline : other?.isOnline;
              const name = c.type === 'group' ? c.name : (other?.name || 'Unknown');
              const lastMsg = c.lastMessage;
              const me = c.participants.find((p) => p.user._id === user._id);
              return (
                <Link key={c._id} href={`/chats/${c._id}`}>
                  <li className="flex items-center gap-3 p-3 border-b border-chat-border hover:bg-chat-panel/70 transition">
                    <div className="w-12 h-12 rounded-full bg-chat-accent/30 flex items-center justify-center text-chat-accent font-semibold shrink-0">
                      {name[0]?.toUpperCase() || '?'}
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
                          {me?.isPinned && (
                            <span className="text-xs text-chat-accent shrink-0">Pinned</span>
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
                        onClick={(e) => togglePin(c, e)}
                        className="hover:text-chat-accent"
                      >
                        {me?.isPinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => archiveChat(c, e)}
                        className="hover:text-chat-accent"
                      >
                        Archive
                      </button>
                      <button
                        type="button"
                        onClick={(e) => deleteChat(c, e)}
                        disabled={!!deletingId}
                        className="hover:text-red-400 disabled:opacity-50"
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
