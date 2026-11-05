import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@shopeer/web-lib"],
  async rewrites() {
    const apiUrl = (process.env.API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }];
  },
  turbopack: {
    root: fileURLToPath(new URL("../..", import.meta.url)),
  },
};

export default nextConfig;
