import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePrincipal } from "./helpers";

/** List all employees, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePrincipal();
    return await ctx.db.query("employees").order("desc").collect();
  },
});

/** Single employee by id. */
export const get = query({
  args: { id: v.id("employees") },
  handler: async (ctx, args) => {
    await requirePrincipal();
    return await ctx.db.get(args.id);
  },
});

/** Add a new employee. Rejects exact duplicate name+phone pairs. */
export const add = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    position: v.string(),
    category: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await requirePrincipal();
    const existing = await ctx.db
      .query("employees")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .collect();
    const duplicate = existing.find(
      (e) => e.phone.trim() === args.phone.trim(),
    );
    if (duplicate) {
      throw new Error("DUPLICATE_EMPLOYEE");
    }
    const { createdAt, updatedAt, ...rest } = args;
    return await ctx.db.insert("employees", {
      ...rest,
      notes: args.notes?.trim() || undefined,
      createdAt,
      updatedAt,
    });
  },
});

/** Edit an employee. Throws DUPLICATE_EMPLOYEE on name+phone collision with another record. */
export const update = mutation({
  args: {
    id: v.id("employees"),
    name: v.string(),
    phone: v.string(),
    position: v.string(),
    category: v.string(),
    notes: v.optional(v.string()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await requirePrincipal();
    const employee = await ctx.db.get(args.id);
    if (!employee) throw new Error("NOT_FOUND");

    const existing = await ctx.db
      .query("employees")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .collect();
    const duplicate = existing.find(
      (e) => e._id !== args.id && e.phone.trim() === args.phone.trim(),
    );
    if (duplicate) {
      throw new Error("DUPLICATE_EMPLOYEE");
    }

    const { id, updatedAt, ...rest } = args;
    await ctx.db.patch(id, {
      ...rest,
      notes: args.notes?.trim() || undefined,
      updatedAt,
    });
    return args.id;
  },
});

/** Delete an employee and their attendance history (explicitly confirmed in UI). */
export const remove = mutation({
  args: { id: v.id("employees") },
  handler: (ctx, args) => ctx.db.delete(args.id),
});

/**
 * Delete an employee AND all of their attendance records. Called only after
 * the user explicitly confirms in the UI that history should be removed too.
 */
export const removeWithHistory = mutation({
  args: { id: v.id("employees") },
  handler: async (ctx, args) => {
    await requirePrincipal();
    const records = await ctx.db
      .query("attendance")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.id))
      .collect();
    for (const record of records) {
      await ctx.db.delete(record._id);
    }
    await ctx.db.delete(args.id);
  },
});
