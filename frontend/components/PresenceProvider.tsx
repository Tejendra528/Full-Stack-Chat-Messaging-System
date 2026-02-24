'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';

type Presence = {
  userId: string;
  isOnline: boolean;
  lastSeen?: string;
};

type PresenceMap = Record<string, Presence>;

const PresenceContext = createContext<PresenceMap>({});

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { socket } = useSocket();
  const [presence, setPresence] = useState<PresenceMap>({});

  useEffect(() => {
    if (!socket) return;

    const onStatus = (data: { userId: string; isOnline: boolean; lastSeen?: string }) => {
      setPresence((prev) => ({
        ...prev,
        [data.userId]: {
          userId: data.userId,
          isOnline: data.isOnline,
          lastSeen: data.lastSeen,
        },
      }));
    };

    socket.on('user_status', onStatus);

    return () => {
      socket.off('user_status', onStatus);
    };
  }, [socket]);

  return <PresenceContext.Provider value={presence}>{children}</PresenceContext.Provider>;
}

export function usePresence() {
  return useContext(PresenceContext);
}

