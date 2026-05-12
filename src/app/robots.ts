import type { MetadataRoute } from "next";

const adminPath = "/ai/apps/email-template-generator";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: [adminPath],
    },
  };
}
