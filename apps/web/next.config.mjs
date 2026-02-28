import type { NextConfig } from 'next';

const nextConfig = {
  transpilePackages: ['@balkina/shared', '@balkina/db', '@balkina/config'],
};

export default nextConfig;

