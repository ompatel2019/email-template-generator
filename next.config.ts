import type { NextConfig } from "next";

const basePath = "/ai/apps/email-template-generator";

const nextConfig: NextConfig = {
  // Public URL: https://goodlabgroup.com/ai/apps/email-template-generator/
  basePath,
  assetPrefix: basePath,
  env: {
    // Client-side fetch() and absolute URLs must include basePath; see page.tsx.
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
