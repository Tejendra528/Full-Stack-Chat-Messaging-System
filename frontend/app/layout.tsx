import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { SocketProvider } from '@/components/SocketProvider';
import { PresenceProvider } from '@/components/PresenceProvider';
import { NotificationsCenter } from '@/components/NotificationsCenter';

export const metadata: Metadata = {
  title: 'Chat',
  description: 'Real-time messaging',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <AuthProvider>
          <SocketProvider>
            <PresenceProvider>
              {children}
              <NotificationsCenter />
            </PresenceProvider>
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
