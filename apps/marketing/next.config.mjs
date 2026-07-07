/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    // White-label pitch deck (static file in /public).
    return [{ source: '/deck', destination: '/deck.html' }];
  },
};

export default nextConfig;
