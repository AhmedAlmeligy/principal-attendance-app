import { ConvexHttpClient } from "convex/browser";

export const convex = new ConvexHttpClient(
  import.meta.env.VITE_CONVEX_URL as string,
);
