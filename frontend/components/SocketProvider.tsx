'use client';

import React, { useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { getSocket, disconnectSocket } from '@/lib/socket';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return;
    }
    getSocket(token);
  }, [token]);

  return <>{children}</>;
}
