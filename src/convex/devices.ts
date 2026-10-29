import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx, mutation, query } from "./_generated/server";

/**
 * Accounts & device control.
 *
 * Every device signs in anonymously once (no password, no e-mail) and
 * registers itself here, which is what makes "the accounts using the app"
 * visible. The first device to register becomes the admin; from the admin
 * console you can revoke or restore an account, remove it, promote another,
 * and shut the whole app down with the global kill switch.
 *
 * Revocation is tied to a stable per-device id kept in the device's own
 * storage, so signing out and back in does not escape a block: registration
 * checks that tombstone before letting the device continue.
 */

type Ctx = QueryCtx | MutationCtx;

async function requireUser(ctx: Ctx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("unauthenticated");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("unauthenticated");
  return userId;
}

async function isAdmin(ctx: Ctx, userId: Id<"users">): Promise<boolean> {
  const user = await ctx.db.get(userId);
  return user?.role === "admin";
}

async function flags(ctx: Ctx) {
  const row = await ctx.db
    .query("systemFlags")
    .withIndex("by_key", (q) => q.eq("key", "main"))
    .first();
  if (row) return row;
  return { key: "main", appDisabled: false, message: undefined };
}

/** Called once right after the anonymous sign-in. */
export const register = mutation({
  args: { deviceId: v.string(), deviceName: v.string() },
  handler: async (ctx, { deviceId, deviceName }) => {
    const userId = await requireUser(ctx);
    const all = await ctx.db.query("users").collect();

    // A revoked device stays revoked even with a brand-new session.
    const blocked = all.some((u) => u.deviceId === deviceId && u.revoked);
    const f = await flags(ctx);
    if (blocked) {
      return { revoked: true, isAdmin: false, appDisabled: f.appDisabled };
    }

    await ctx.db.patch(userId, {
      deviceId,
      deviceName,
      lastSeenAt: Date.now(),
      revoked: false,
    });

    // Bootstrap: nobody is admin yet → this device owns the console.
    let admin = (await ctx.db.get(userId))?.role === "admin";
    if (!all.some((u) => u.role === "admin")) {
      await ctx.db.patch(userId, { role: "admin" });
      admin = true;
    }

    return { revoked: false, isAdmin: admin, appDisabled: f.appDisabled };
  },
});

/** Cheap reactive status the app gate watches (live revocation/kill switch). */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const f = await flags(ctx);
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { signedIn: false as const, appDisabled: f.appDisabled, message: f.message ?? null };
    const me = await ctx.db.get(userId);
    if (!me) return { signedIn: false as const, appDisabled: f.appDisabled, message: f.message ?? null };
    return {
      signedIn: true as const,
      revoked: !!me.revoked,
      isAdmin: me.role === "admin",
      appDisabled: f.appDisabled,
      message: f.message ?? null,
    };
  },
});

/** Admin console list. Returns null (not an error) for non-admins. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null || !(await isAdmin(ctx, userId))) return null;
    const users = await ctx.db.query("users").collect();
    return users
      .map((u) => ({
        id: u._id,
        name: u.name ?? null,
        deviceName: u.deviceName ?? null,
        role: u.role === "admin" ? "admin" : "member",
        revoked: !!u.revoked,
        lastSeenAt: u.lastSeenAt ?? null,
        self: u._id === userId,
      }))
      .sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
  },
});

export const setRevoked = mutation({
  args: { userId: v.id("users"), revoked: v.boolean() },
  handler: async (ctx, { userId, revoked }) => {
    const me = await requireUser(ctx);
    if (!(await isAdmin(ctx, me))) throw new Error("forbidden");
    if (userId === me) throw new Error("cannot revoke yourself");
    await ctx.db.patch(userId, { revoked });
  },
});

/** "Delete": anonymise the row and keep the device tombstone. */
export const removeAccount = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await requireUser(ctx);
    if (!(await isAdmin(ctx, me))) throw new Error("forbidden");
    if (userId === me) throw new Error("cannot remove yourself");
    const target = await ctx.db.get(userId);
    if (!target) return;
    await ctx.db.patch(userId, {
      revoked: true,
      role: undefined,
      name: "حساب محذوف",
      email: undefined,
      image: undefined,
      deviceName: undefined,
    });
  },
});

export const setRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("admin"), v.literal("member")) },
  handler: async (ctx, { userId, role }) => {
    const me = await requireUser(ctx);
    if (!(await isAdmin(ctx, me))) throw new Error("forbidden");
    await ctx.db.patch(userId, { role });
  },
});

/** Global kill switch: every device stops at the shutdown screen. */
export const setAppDisabled = mutation({
  args: { disabled: v.boolean(), message: v.optional(v.string()) },
  handler: async (ctx, { disabled, message }) => {
    const me = await requireUser(ctx);
    if (!(await isAdmin(ctx, me))) throw new Error("forbidden");
    const row = await ctx.db
      .query("systemFlags")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .first();
    if (row) {
      await ctx.db.patch(row._id, { appDisabled: disabled, message });
    } else {
      await ctx.db.insert("systemFlags", {
        key: "main",
        appDisabled: disabled,
        message,
      });
    }
  },
});
