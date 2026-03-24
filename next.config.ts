import type { NextConfig } from "next";

/** Se NEXTAUTH_URL não estiver na Vercel, usa o host do deploy (evita login quebrado no Hobby). */
function vercelOrigin(): string | undefined {
  const v = process.env.VERCEL_URL;
  if (!v) return undefined;
  const host = v.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${host}`;
}

const nextConfig: NextConfig = {
  env: {
    ...(!process.env.NEXTAUTH_URL?.trim() && vercelOrigin()
      ? { NEXTAUTH_URL: vercelOrigin()! }
      : {}),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
