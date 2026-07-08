/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    // Pitch decks (static files in /public).
    return [
      { source: '/deck', destination: '/deck.html' },
      { source: '/tenant-deck', destination: '/tenant-deck.html' },
    ];
  },
};

export default nextConfig;
