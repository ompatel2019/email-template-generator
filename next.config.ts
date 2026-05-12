import type { NextConfig } from "next";

const basePath = "/ai/apps";

const nextConfig: NextConfig = {
  // Admin URL: https://goodlabgroup.com/ai/apps/email-template-generator/
  // Public campaign URL: https://goodlabgroup.com/ai/apps/campaign/[id]
  basePath,
  assetPrefix: basePath,
  env: {
    // Client-side fetch() and absolute URLs must include basePath; see page.tsx.
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
