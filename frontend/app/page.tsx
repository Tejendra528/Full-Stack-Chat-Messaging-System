'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    router.replace(token ? '/chats' : '/login');
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-chat-bg">
      <div className="animate-pulse text-chat-muted">Loading...</div>
    </div>
  );
}
