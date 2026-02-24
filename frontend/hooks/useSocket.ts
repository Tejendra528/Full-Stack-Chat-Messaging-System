'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getSocket } from '@/lib/socket';
import type { Message } from '@/lib/api';

export function useSocket() {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<ReturnType<typeof getSocket>>(null);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      return;
    }
    const s = getSocket(token);
    setSocket(s);
    if (!s) return;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    if (s.connected) setConnected(true);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, [token]);

  return { socket, connected };
}

export function useSocketConversation(conversationId: string | null) {
  const { socket } = useSocket();
  const myUserId = useAuth().user?._id ?? null;
  const [typingUser, setTypingUser] = useState<{ userId: string; userName: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!socket || !conversationId) return;

    socket.emit('join_conversation', conversationId);

    const onNewMessage = (msg: Message) => {
      if (msg.conversation === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
    };

    const onTyping = (data: { conversationId: string; userId: string; userName: string }) => {
      if (data.conversationId !== conversationId) return;
      setTypingUser({ userId: data.userId, userName: data.userName });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
    };

    const onTypingStopped = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId !== conversationId) return;
      setTypingUser((prev) => (prev?.userId === data.userId ? null : prev));
    };

    const onMessagesSeen = (data: { conversationId: string; seenBy: string }) => {
      if (data.conversationId !== conversationId || !myUserId) return;
      setMessages((prev) =>
        prev.map((m) => {
          const senderId = typeof m.sender === 'object' && m.sender && '_id' in m.sender ? (m.sender as { _id: string })._id : m.sender;
          if (senderId !== myUserId) return m;
          if ((m.seenBy || []).includes(data.seenBy)) return m;
          return { ...m, status: 'seen' as const, seenBy: [...(m.seenBy || []), data.seenBy] };
        })
      );
    };

    const onMessageDelivered = (data: { messageId: string; conversationId: string; status: string }) => {
      if (data.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) => (m._id === data.messageId ? { ...m, status: data.status as Message['status'] } : m))
      );
    };

    socket.on('new_message', onNewMessage);
    socket.on('typing', onTyping);
    socket.on('typing_stopped', onTypingStopped);
    socket.on('messages_seen', onMessagesSeen);
    socket.on('message_delivered', onMessageDelivered);

    return () => {
      socket.emit('leave_conversation', conversationId);
      socket.off('new_message', onNewMessage);
      socket.off('typing', onTyping);
      socket.off('typing_stopped', onTypingStopped);
      socket.off('messages_seen', onMessagesSeen);
      socket.off('message_delivered', onMessageDelivered);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [socket, conversationId, myUserId]);

  const sendMessage = (content: string) => {
    if (!socket || !conversationId || !content.trim()) return;
    socket.emit('send_message', { conversationId, content, type: 'text' }, (ack: { message?: Message; error?: string }) => {
      if (ack?.message) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === ack.message!._id)) return prev;
          return [...prev, ack.message!];
        });
      }
    });
  };

  const startTyping = () => {
    if (socket && conversationId) socket.emit('typing_start', { conversationId });
  };

  const stopTyping = () => {
    if (socket && conversationId) socket.emit('typing_stop', { conversationId });
  };

  const markSeen = () => {
    if (socket && conversationId) socket.emit('mark_seen', { conversationId });
  };

  return {
    typingUser,
    messages,
    setMessages,
    sendMessage,
    startTyping,
    stopTyping,
    markSeen,
  };
}
