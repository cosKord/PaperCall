import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    if (process.env.VERCEL) return [];

    const fastifyUrl = (process.env.FASTIFY_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
    const parsedApiUrl = new URL(fastifyUrl);
    if (!["http:", "https:"].includes(parsedApiUrl.protocol)) {
      throw new Error("FASTIFY_URL must be an http(s) URL");
    }

    return [{ source: "/api/:path*", destination: `${fastifyUrl}/api/:path*` }];
  },
};

export default nextConfig;
