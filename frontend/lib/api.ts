const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as T;
}

export const auth = {
  register: (body: { email: string; password: string; name: string }) =>
    api<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    api<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  me: () => api<{ user: User }>('/auth/me'),
};

export const conversations = {
  list: (params?: { page?: number; limit?: number; archived?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.archived) q.set('archived', 'true');
    return api<{ conversations: Conversation[]; pagination: Pagination }>(
      `/conversations?${q.toString()}`
    );
  },
  getDirect: (userId: string) =>
    api<Conversation>(`/conversations/direct/${userId}`),
  get: (id: string) => api<Conversation>(`/conversations/${id}`),
  createGroup: (body: { name: string; participantIds: string[] }) =>
    api<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  setPinned: (id: string, pinned: boolean) =>
    api<Conversation>(`/conversations/${id}/pin`, {
      method: 'PATCH',
      body: JSON.stringify({ pinned }),
    }),
  setArchived: (id: string, archived: boolean) =>
    api<Conversation>(`/conversations/${id}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ archived }),
    }),
  delete: (id: string) =>
    api<{ ok: boolean }>(`/conversations/${id}`, {
      method: 'DELETE',
    }),
};

export const messages = {
  list: (conversationId: string, params?: { page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return api<{ messages: Message[]; pagination: Pagination }>(
      `/messages/conversation/${conversationId}?${q.toString()}`
    );
  },
  markSeen: (conversationId: string) =>
    api<{ ok: boolean }>('/messages/mark-seen', {
      method: 'POST',
      body: JSON.stringify({ conversationId }),
    }),
};

export const users = {
  search: (q: string) =>
    api<{ users: User[] }>(`/users/search?q=${encodeURIComponent(q)}`),
};

export interface User {
  _id: string;
  email: string;
  name: string;
  avatar?: string | null;
  isOnline?: boolean;
  lastSeen?: string | null;
}

export interface Participant {
  user: User;
  role?: string;
  lastReadAt?: string | null;
  isPinned?: boolean;
  isArchived?: boolean;
}

export interface Conversation {
  _id: string;
  type: 'direct' | 'group';
  participants: Participant[];
  name?: string | null;
  lastMessage?: Message | null;
  lastMessageAt?: string | null;
}

export interface Message {
  _id: string;
  conversation: string;
  sender: User | string;
  content: string;
  type: 'text' | 'image' | 'voice' | 'file';
  status?: 'sent' | 'delivered' | 'seen';
  deliveredTo?: string[];
  seenBy?: string[];
  createdAt: string;
  attachment?: { url?: string; filename?: string };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
