import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Balkina AI — Admin Panel',
  description: 'Platform administration for Balkina AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
