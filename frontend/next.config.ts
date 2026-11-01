import type { NextConfig } from "next";

const fastApiUrl = (process.env.FASTAPI_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const parsedApiUrl = new URL(fastApiUrl);

if (!['http:', 'https:'].includes(parsedApiUrl.protocol)) {
  throw new Error("FASTAPI_URL must be an http(s) URL");
}

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${fastApiUrl}/api/:path*` }];
  },
};

export default nextConfig;
