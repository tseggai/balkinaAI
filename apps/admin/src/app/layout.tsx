import type { Metadata } from 'next';
import './globals.css';
import { SupabaseProvider } from '@/components/supabase-provider';

export const metadata: Metadata = {
  title: 'Balkina AI — Admin Panel',
  description: 'Platform administration for Balkina AI',
  icons: {
    icon: '/assets/Balkina_icon_color.png',
    apple: '/assets/Balkina_icon_color.png',
  },
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  return (
    <html lang="en">
      <body>
        <SupabaseProvider
          supabaseUrl={supabaseUrl}
          supabaseAnonKey={supabaseAnonKey}
        >
          {children}
        </SupabaseProvider>
      </body>
    </html>
  );
}
