import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  // Default auth tables using convex auth (do not remove).
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(v.string()), // "admin" | "member"
    deviceId: v.optional(v.string()), // stable per-browser tombstone
    deviceName: v.optional(v.string()),
    lastSeenAt: v.optional(v.number()),
    revoked: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("by_deviceId", ["deviceId"]),

  // Single-row feature flags controlled from the admin console.
  systemFlags: defineTable({
    key: v.string(), // always "main"
    appDisabled: v.boolean(), // global kill switch
    message: v.optional(v.string()),
  }).index("by_key", ["key"]),

  employees: defineTable({
    name: v.string(),
    phone: v.string(),
    position: v.string(),
    category: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

  attendance: defineTable({
    employeeId: v.id("employees"),
    employeeName: v.string(),
    date: v.string(), // YYYY-MM-DD (local calendar day)
    time: v.optional(v.string()), // HH:MM arrival time
    status: v.union(
      v.literal("present"),
      v.literal("late"),
      v.literal("absent"),
      v.literal("permission"),
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_employee_date", ["employeeId", "date"])
    .index("by_date", ["date"])
    .index("by_employee", ["employeeId"]),

  settings: defineTable({
    schoolName: v.string(),
    principalName: v.string(),
    defaultArrivalTime: v.string(), // HH:MM
    lateThreshold: v.string(), // HH:MM
    workingDays: v.array(v.number()), // 0=Sunday ... 6=Saturday
    reportFooterNote: v.optional(v.string()),
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"))),
    principalPhoto: v.optional(v.string()),
  }),

  thankYouMessages: defineTable({
    text: v.string(),
    createdAt: v.number(),
  }),
});

export default schema;
