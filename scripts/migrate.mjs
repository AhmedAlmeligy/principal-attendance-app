/**
 * One-off data migration: old Convex cloud -> new Convex cloud.
 * Safe to re-run: employees.add rejects exact name+phone duplicates, and
 * attendance.upsert keys on employeeId+date.
 *
 * NOTE: the source deployment (happy-otter-123) currently returns 404 on
 * every endpoint — if it has been deleted there is nothing to migrate from,
 * and this script says so instead of crashing. The working recovery path is
 * device-side: each device re-uploads its local history to the new backend
 * before its first sync (see `ensureFullUpload` in src/lib/sync-client.ts).
 *
 * Usage: bun run scripts/migrate.mjs
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../src/convex/_generated/api.js";

const OLD_URL = "https://happy-otter-123.convex.cloud";
const NEW_URL = "https://fantastic-seahorse-539.convex.cloud";

// Preflight: a dead deployment answers 404 with an empty/non-JSON body, which
// the HTTP client turns into an opaque `Error:` stack trace. Check first.
const probe = await fetch(`${OLD_URL}/api/query`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ path: "employees:list", args: {} }),
}).then(
  (res) => res,
  (err) => err,
);
if (probe instanceof Error || !probe.ok) {
  const detail = probe instanceof Error ? probe.message : `HTTP ${probe.status}`;
  console.error(`Old deployment ${OLD_URL} is not reachable (${detail}).`);
  console.error("It appears to have been deleted — there is no data to migrate from.");
  console.error(
    "Recovery happens on-device instead: each device re-uploads its local\n" +
      "history to the new backend before its first sync\n" +
      "(see ensureFullUpload in src/lib/sync-client.ts).",
  );
  process.exit(1);
}

const oldC = new ConvexHttpClient(OLD_URL);
const newC = new ConvexHttpClient(NEW_URL);

const employees = await oldC.query(api.employees.list, {});
const attendance = await oldC.query(api.attendance.listAll, {});
const settings = await oldC.query(api.settings.get, {});
let messages = [];
try {
  messages = await oldC.query(api.thankYouMessages.list, {});
} catch {
  console.log("(old deployment has no thankYouMessages.list — skipping)");
}

console.log(`old deployment: ${employees.length} employees, ${attendance.length} attendance rows, settings=${settings ? "yes" : "no"}, ${messages.length} messages`);

const idMap = new Map();
let empCreated = 0;
let empDupes = 0;
for (const e of employees) {
  try {
    const newId = await newC.mutation(api.employees.add, {
      name: e.name,
      phone: e.phone,
      position: e.position,
      category: e.category,
      notes: e.notes,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    });
    idMap.set(e._id, newId);
    empCreated++;
  } catch (err) {
    if (String(err.message).includes("DUPLICATE_EMPLOYEE")) {
      empDupes++;
      const list = await newC.query(api.employees.list, {});
      const match = list.find((x) => x.name === e.name && x.phone.trim() === e.phone.trim());
      if (match) idMap.set(e._id, match._id);
    } else {
      console.log("employee FAILED:", e.name, err.message);
    }
  }
}

let attOk = 0;
let attSkipped = 0;
for (const a of attendance) {
  const newEmpId = idMap.get(a.employeeId);
  if (!newEmpId) {
    attSkipped++;
    continue;
  }
  try {
    await newC.mutation(api.attendance.upsert, {
      employeeId: newEmpId,
      employeeName: a.employeeName,
      date: a.date,
      time: a.time,
      status: a.status,
      notes: a.notes,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    });
    attOk++;
  } catch (err) {
    console.log("attendance FAILED:", a.date, a.employeeName, err.message);
    attSkipped++;
  }
}

if (settings) {
  try {
    await newC.mutation(api.settings.upsert, {
      schoolName: settings.schoolName,
      principalName: settings.principalName,
      defaultArrivalTime: settings.defaultArrivalTime,
      lateThreshold: settings.lateThreshold,
      workingDays: settings.workingDays,
      reportFooterNote: settings.reportFooterNote,
      theme: settings.theme,
      principalPhoto: settings.principalPhoto,
    });
    console.log("settings migrated");
  } catch (err) {
    console.log("settings FAILED:", err.message);
  }
}

for (const m of messages) {
  try {
    await newC.mutation(api.thankYouMessages.add, { text: m.text, createdAt: m.createdAt });
  } catch (err) {
    console.log("message FAILED:", err.message);
  }
}

const verifyEmp = await newC.query(api.employees.list, {});
const verifyAtt = await newC.query(api.attendance.listAll, {});
console.log(`DONE. new deployment now has ${verifyEmp.length} employees, ${verifyAtt.length} attendance rows (created=${empCreated}, dupes=${empDupes}, attOk=${attOk}, attSkipped=${attSkipped})`);
