'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import type { Message } from '@/lib/api';

type Notification = {
  id: string;
  conversationId: string;
  preview: string;
};

export function NotificationsCenter() {
  const { socket } = useSocket();
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    if (!socket) return;

    const onNew = (data: { conversationId: string; message: Message }) => {
      const text =
        data.message.content ||
        (data.message.type === 'image'
          ? 'Image'
          : data.message.type === 'voice'
          ? 'Voice message'
          : 'New message');
      const id = `${data.conversationId}-${data.message._id}-${Date.now()}`;
      setItems((prev) => [...prev, { id, conversationId: data.conversationId, preview: text }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((n) => n.id !== id));
      }, 5000);
    };

    socket.on('new_message_notification', onNew);
    return () => {
      socket.off('new_message_notification', onNew);
    };
  }, [socket]);

  if (!items.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {items.map((n) => (
        <div
          key={n.id}
          className="max-w-xs rounded-xl bg-chat-panel border border-chat-border px-3 py-2 shadow-lg"
        >
          <p className="text-xs text-zinc-400 mb-0.5">New message</p>
          <p className="text-sm text-zinc-100 truncate">{n.preview}</p>
        </div>
      ))}
    </div>
  );
}

