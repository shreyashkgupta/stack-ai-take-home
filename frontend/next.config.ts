import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    domains: ['drive.google.com'],
  },
};

export default nextConfig;
