import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePrincipal } from "./helpers";

/** Saved custom appreciation messages, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePrincipal();
    return await ctx.db.query("thankYouMessages").order("desc").collect();
  },
});

/** Save a custom appreciation message so it can be reused later. */
export const add = mutation({
  args: { text: v.string(), createdAt: v.number() },
  handler: async (ctx, args) => {
    await requirePrincipal();
    const text = args.text.trim();
    if (!text) throw new Error("EMPTY_MESSAGE");
    return await ctx.db.insert("thankYouMessages", {
      text,
      createdAt: args.createdAt,
    });
  },
});

/** Remove a saved message template. */
export const remove = mutation({
  args: { id: v.id("thankYouMessages") },
  handler: async (ctx, args) => {
    await requirePrincipal();
    await ctx.db.delete(args.id);
  },
});
