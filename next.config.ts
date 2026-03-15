import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    qualities: [75, 85, 90, 95, 100],
    minimumCacheTTL: 60,
  },
};

export default nextConfig;
