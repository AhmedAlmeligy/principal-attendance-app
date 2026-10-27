import type { AuthConfig } from "convex/server";

export default {
  providers: [
    // Standard Convex Auth provider for this project's own sign-in. The
    // deployment self-issues JWTs (iss = CONVEX_SITE_URL, no `kid` header)
    // validated via OIDC discovery at
    // `${domain}/.well-known/openid-configuration`, served by
    // auth.addHttpRoutes() in convex/http.ts. Do NOT convert this entry to
    // `type: "customJwt"` — that path rejects tokens without a `kid` header,
    // so sign-in would silently never confirm and RequireAuth would loop
    // back to /auth forever.
    {
      domain: process.env.CONVEX_SITE_URL!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
