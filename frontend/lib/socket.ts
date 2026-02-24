import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000';

let socket: Socket | null = null;

export function getSocket(token: string | null): Socket | null {
  if (typeof window === 'undefined' || !token) return null;
  if (socket?.connected) return socket;
  if (socket) socket.disconnect();
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export type SocketEvents = {
  new_message: (msg: import('./api').Message) => void;
  typing: (data: { conversationId: string; userId: string; userName: string }) => void;
  typing_stopped: (data: { conversationId: string; userId: string }) => void;
  messages_seen: (data: { conversationId: string; seenBy: string }) => void;
};
