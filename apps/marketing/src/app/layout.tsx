import type { Metadata } from 'next';
import 'devices.css/dist/devices.min.css';
import './globals.css';
import { Navbar } from '@/components/navbar';

export const metadata: Metadata = {
  title: 'Balkina AI — Book Appointments with AI',
  description: 'The AI-powered appointment booking platform. Customers chat, AI finds businesses, checks availability, and books — all in one conversation.',
  keywords: ['appointment booking', 'AI booking', 'chatbot', 'scheduling', 'business management'],
  openGraph: {
    title: 'Balkina AI — Book Appointments with AI',
    description: 'The AI-powered appointment booking platform.',
    type: 'website',
    url: 'https://balkina.ai',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white">
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
