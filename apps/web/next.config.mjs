const nextConfig = {
  transpilePackages: ['@balkina/shared', '@balkina/db', '@balkina/config'],
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  },
  async rewrites() {
    // White-label pitch deck (static file in /public).
    return [{ source: '/deck', destination: '/deck.html' }];
  },
};

export default nextConfig;
