import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL || "http://backend:5000";
const interactiveUrl = process.env.INTERACTIVE_URL || "ws://interactive-backend:5001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/ws/:path*",
        headers: [
          {
            key: "Connection",
            value: "Upgrade",
          },
          {
            key: "Upgrade",
            value: "websocket",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
