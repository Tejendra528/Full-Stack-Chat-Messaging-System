'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
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
  return (lastMessage.content || '').slice(0, 30) + ((lastMessage.content?.length || 0) > 30 ? '…' : '');
}

export default function ChatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, loading } = useAuth();
  const presence = usePresence();
  const router = useRouter();
  const pathname = usePathname();
  
  const [list, setList] = useState<Conversation[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [searchUsers, setSearchUsers] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    conversations
      .list()
      .then((r) => setList(r.conversations))
      .catch(() => setList([]))
      .finally(() => setLoadingChats(false));
  }, [user]);

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
    try {
      const conv = await conversations.getDirect(otherUserId);
      router.push(`/chats/${conv._id}`);
    } catch (err) {
      console.error('Failed to start chat:', err);
    }
  };

  const isChatSelected = pathname?.startsWith('/chats/') && pathname !== '/chats' && !pathname.includes('/new-group') && !pathname.includes('/archived');

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-chat-bg">
        <p className="text-chat-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-chat-bg overflow-hidden">
      {/* WhatsApp-style Sidebar - Chat List */}
      <div className={`${isChatSelected ? 'hidden md:flex' : 'flex'} w-full md:w-[380px] lg:w-[420px] flex-col bg-chat-panel border-r border-chat-border`}>
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between px-3 py-2.5 bg-chat-header border-b border-chat-border">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-chat-accent flex items-center justify-center text-white font-medium">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/chats/new-group" className="p-2 rounded-full hover:bg-chat-panelHover transition-colors" title="New group">
              <svg className="w-5 h-5 text-chat-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </Link>
            <Link href="/chats/archived" className="p-2 rounded-full hover:bg-chat-panelHover transition-colors" title="Archived">
              <svg className="w-5 h-5 text-chat-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </Link>
            <button onClick={logout} className="p-2 rounded-full hover:bg-chat-panelHover transition-colors" title="Logout">
              <svg className="w-5 h-5 text-chat-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* Search Bar */}
        <div className="px-2 py-2 bg-chat-header border-b border-chat-border">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-chat-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search or start new chat"
              className="w-full py-2 pl-9 pr-3 bg-chat-input text-chat-text text-sm rounded-lg border border-chat-border focus:outline-none focus:border-chat-accent placeholder-chat-muted"
            />
          </div>
        </div>

        {/* Chat List / Search Results */}
        <div className="flex-1 overflow-y-auto scroll-thin">
          {searchQ.trim().length >= 2 ? (
            <div>
              {searching ? (
                <p className="p-4 text-chat-muted text-sm">Searching...</p>
              ) : searchUsers.length === 0 ? (
                <p className="p-4 text-chat-muted text-sm">No users found</p>
              ) : (
                <ul>
                  {searchUsers.map((u) => (
                    <li key={u._id}>
                      <button
                        onClick={() => startChat(u._id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-chat-panelHover transition-colors"
                      >
                        <div className="w-12 h-12 rounded-full bg-chat-accent flex items-center justify-center text-white font-medium shrink-0">
                          {(u.name || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-chat-text truncate">{u.name}</p>
                          <p className="text-sm text-chat-muted truncate">{u.email}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : loadingChats ? (
            <div className="p-4 text-chat-muted text-sm">Loading chats...</div>
          ) : list.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-chat-muted">No chats yet</p>
              <p className="text-sm text-chat-muted mt-1">Search for users to start chatting</p>
            </div>
          ) : (
            <ul>
              {list.map((c) => {
                const other = getOtherParticipant(c.participants as { user: User }[], user._id);
                const me = c.participants?.find((p) => (p.user as User)?._id === user._id);
                const name = c.type === 'group' ? c.name : other?.name || 'Unknown';
                const lastMsg = c.lastMessage as { content?: string; type?: string; createdAt?: string } | null;
                const onlineOverride = other?.isOnline && presence[other._id]?.isOnline;

                return (
                  <li key={c._id}>
                    <Link
                      href={`/chats/${c._id}`}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-chat-panelHover transition-colors border-b border-chat-border/30"
                    >
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-full bg-chat-accent flex items-center justify-center text-white font-medium">
                          {name?.[0]?.toUpperCase() || '?'}
                        </div>
                        {other && onlineOverride && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-chat-accent rounded-full border-2 border-chat-panel" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="font-medium text-chat-text truncate">{name}</p>
                            {me?.isPinned && (
                              <svg className="w-3.5 h-3.5 text-chat-accent shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v2H5V5zM5 9h10v6a2 2 0 01-2 2H7a2 2 0 01-2-2V9z" />
                              </svg>
                            )}
                          </div>
                          <span className="text-xs text-chat-muted shrink-0 ml-2">
                            {formatTime(lastMsg?.createdAt || c.lastMessageAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-chat-muted truncate">
                            {lastMessagePreview(lastMsg)}
                          </p>
                          {other && onlineOverride && (
                            <span className="ml-2 text-[10px] text-chat-accent font-medium">Online</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Chat Area - Right Panel */}
      <div className={`${isChatSelected ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-chat-bg`}>
        {children}
      </div>
    </div>
  );
}
