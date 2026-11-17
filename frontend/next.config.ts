import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Keep the dev badge clear of the sidebar footer in the bottom-left corner.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
