import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Balkina AI — Tenant Panel',
  description: 'Manage your appointments, services, and staff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
