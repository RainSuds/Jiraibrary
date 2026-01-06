import type { NextConfig } from "next";

type RemotePattern = {
  protocol?: "http" | "https";
  hostname: string;
  port?: string;
  pathname?: string;
};

const remotePatterns: RemotePattern[] = [
  {
    protocol: "https",
    hostname: "lh1.googleusercontent.com",
  },
  {
    protocol: "https",
    hostname: "lh2.googleusercontent.com",
  },
  {
    protocol: "https",
    hostname: "lh3.googleusercontent.com",
  },
  {
    protocol: "https",
    hostname: "lh4.googleusercontent.com",
  },
  {
    protocol: "https",
    hostname: "lh5.googleusercontent.com",
  },
  {
    protocol: "https",
    hostname: "lh6.googleusercontent.com",
  },
  {
    protocol: "https",
    hostname: "**.amazonaws.com",
  },
  {
    protocol: "https",
    hostname: "**.cloudfront.net",
  },
  {
    protocol: "https",
    hostname: "placehold.co",
  },
];

const rawMediaHost = process.env.NEXT_PUBLIC_MEDIA_HOST;

if (rawMediaHost) {
  const protocol = rawMediaHost.startsWith("http://") ? "http" : "https";
  const withoutScheme = rawMediaHost.replace(/^https?:\/\//, "");
  const hostname = withoutScheme.split("/")[0];
  remotePatterns.push({
    protocol,
    hostname,
  });
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
};

export default nextConfig;
