import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePrincipal } from "./helpers";

/** All attendance records (used by offline cache seeding + sync reconciliation). */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requirePrincipal();
    return await ctx.db.query("attendance").order("desc").collect();
  },
});

/** Attendance records for one local calendar date (YYYY-MM-DD). */
export const listByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    await requirePrincipal();
    return await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
  },
});

/**
 * Upsert one attendance record for an employee/date pair.
 * Uses the employee+date index so duplicates are impossible.
 */
export const upsert = mutation({
  args: {
    employeeId: v.id("employees"),
    employeeName: v.string(),
    date: v.string(),
    time: v.optional(v.string()),
    status: v.union(
      v.literal("present"),
      v.literal("late"),
      v.literal("absent"),
      v.literal("permission"),
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await requirePrincipal();
    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_employee_date", (q) =>
        q.eq("employeeId", args.employeeId).eq("date", args.date),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        time: args.time,
        status: args.status,
        notes: args.notes?.trim() || undefined,
        updatedAt: args.updatedAt,
      });
      return existing._id;
    }
    return await ctx.db.insert("attendance", {
      employeeId: args.employeeId,
      employeeName: args.employeeName,
      date: args.date,
      time: args.time,
      status: args.status,
      notes: args.notes?.trim() || undefined,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
    });
  },
});

/** Edit an attendance record by id (arrival time, status, notes). */
export const updateRecord = mutation({
  args: {
    id: v.id("attendance"),
    time: v.optional(v.string()),
    status: v.union(
      v.literal("present"),
      v.literal("late"),
      v.literal("absent"),
      v.literal("permission"),
    ),
    notes: v.optional(v.string()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await requirePrincipal();
    const { id, updatedAt, ...rest } = args;
    await ctx.db.patch(id, {
      ...rest,
      notes: args.notes?.trim() || undefined,
      updatedAt,
    });
    return id;
  },
});

/** Delete a single attendance record. */
export const removeRecord = mutation({
  args: { id: v.id("attendance") },
  handler: async (ctx, args) => {
    await requirePrincipal();
    await ctx.db.delete(args.id);
  },
});
