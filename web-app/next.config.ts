import type { NextConfig } from "next";

const SERVER_URL = process.env.SERVER_INTERNAL_URL || "http://localhost:5000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${SERVER_URL}/api/v1/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${SERVER_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
