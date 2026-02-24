'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { conversations, users, type User } from '@/lib/api';

export default function NewGroupPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [name, setName] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    if (searchQ.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    users
      .search(searchQ.trim())
      .then((r) => setResults(r.users))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, [searchQ, token]);

  const toggleUser = (u: User) => {
    if (selected.some((s) => s._id === u._id)) {
      setSelected((prev) => prev.filter((s) => s._id !== u._id));
    } else {
      setSelected((prev) => [...prev, u]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Group name is required.');
      return;
    }
    if (selected.length === 0) {
      setError('Select at least one member.');
      return;
    }
    setCreating(true);
    try {
      const participantIds = selected.map((u) => u._id);
      const conv = await conversations.createGroup({
        name: name.trim(),
        participantIds,
      });
      router.push(`/chats/${conv._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group.');
    } finally {
      setCreating(false);
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-400">You must be logged in.</p>
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
        <h1 className="font-semibold truncate">New group</h1>
      </header>

      <form onSubmit={handleCreate} className="p-4 space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Group name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg bg-chat-bg border border-chat-border px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-chat-accent"
            placeholder="Study group, Project team..."
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Add members</label>
          <input
            type="search"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search users..."
            className="w-full rounded-lg bg-chat-bg border border-chat-border px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-chat-accent"
          />
        </div>

        {searchQ.trim().length >= 2 && (
          <div className="border border-chat-border rounded-xl bg-chat-panel/70 max-h-56 overflow-y-auto scroll-thin">
            {searching ? (
              <p className="text-sm text-zinc-400 p-3">Searching...</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-zinc-400 p-3">No users found</p>
            ) : (
              <ul>
                {results.map((u) => {
                  const isSelected = selected.some((s) => s._id === u._id);
                  return (
                    <li key={u._id}>
                      <button
                        type="button"
                        onClick={() => toggleUser(u)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-chat-bubbleOut/50 ${
                          isSelected ? 'bg-chat-bubbleOut/60' : ''
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-chat-accent/30 flex items-center justify-center text-chat-accent text-sm font-medium">
                          {(u.name || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.name}</p>
                          <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                        </div>
                        {isSelected && (
                          <span className="text-xs text-chat-accent font-medium">Added</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {selected.length > 0 && (
          <div className="text-sm text-zinc-400">
            Members:{' '}
            {selected.map((u) => u.name).join(', ')}
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={creating}
          className="w-full mt-2 py-2.5 rounded-lg bg-chat-accent text-white font-medium hover:opacity-90 disabled:opacity-50"
        >
          {creating ? 'Creating group...' : 'Create group'}
        </button>
      </form>
    </div>
  );
}

