import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // FOR DEV ONLY - Works for take home test
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://api.stack-ai.com/:path*',
      },
    ];
  },
};

export default nextConfig;
