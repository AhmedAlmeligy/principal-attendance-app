import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePrincipal } from "./helpers";

/** Fetch the single settings row. Returns null when not yet configured. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    await requirePrincipal();
    return await ctx.db.query("settings").first();
  },
});

/** Create or update the singleton settings document. */
export const upsert = mutation({
  args: {
    schoolName: v.string(),
    principalName: v.string(),
    defaultArrivalTime: v.string(),
    lateThreshold: v.string(),
    workingDays: v.array(v.number()),
    reportFooterNote: v.optional(v.string()),
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"))),
    principalPhoto: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePrincipal();
    const existing = await ctx.db.query("settings").first();
    const payload = {
      ...args,
      reportFooterNote: args.reportFooterNote?.trim() || undefined,
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("settings", payload);
  },
});
