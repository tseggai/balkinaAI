import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@balkina/shared', '@balkina/db', '@balkina/config'],
};

export default nextConfig;
