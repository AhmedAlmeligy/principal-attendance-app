import { api } from "@/convex/_generated/api";
import type { ConvexReactClient } from "convex/react";
import {
  dequeueOp,
  getSyncQueue,
  getMeta,
  setMeta,
  getAllEmployees,
  getAllAttendance,
  putAttendance,
  putAttendanceList,
  putEmployees,
  putSettings,
  deleteAttendanceLocal,
  deleteEmployeeLocal,
} from "./local-db";
import type {
  LocalAttendance,
  LocalEmployee,
  LocalSettings,
  SyncQueueOp,
} from "./local-db";
import type { AttendanceStatus } from "./types";

/** The authenticated Convex client is registered by the app at startup. */
let client: ConvexReactClient | null = null;

export function registerConvexClient(c: ConvexReactClient) {
  client = c;
}

/** Null in local-only builds (no backend configured) — callers must cope. */
function getClient(): ConvexReactClient | null {
  return client;
}

let syncing = false;
let hasSyncedOnce = false;
const listeners = new Set<() => void>();

export type SyncState = "idle" | "syncing" | "offline" | "error";

let current: SyncState = "idle";
let pendingCount = 0;

function notify() {
  for (const fn of listeners) fn();
}

export function onSyncStateChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getSyncSnapshot(): { state: SyncState; pendingOps: number } {
  return { state: current, pendingOps: pendingCount };
}

function setState(s: SyncState) {
  current = s;
  notify();
}

export async function setPending(n: number) {
  pendingCount = n;
  notify();
}

export function markSynced() {
  hasSyncedOnce = true;
}

export function hasInitialSyncCompleted() {
  return hasSyncedOnce;
}

/** Replay the local queue against Convex using the authenticated client. */
export async function syncNow(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setState("offline");
      return;
    }
    const c = getClient();
    if (!c) {
      // Local-only build: no backend configured. Report offline and keep the
      // queue intact so queued ops flush once a backend is set up.
      setState("offline");
      return;
    }
    setState("syncing");
    // Replay in the order operations were created. Queue ids are random UUIDs,
    // so getAll()'s key order is NOT chronological — e.g. an attendance upsert
    // for an offline-created employee must run AFTER its employee.create op,
    // otherwise the employee id cannot be resolved and the record is lost.
    const queue = (await getSyncQueue()).sort(
      (a, b) => a.queuedAt - b.queuedAt,
    );
    for (const op of queue) {
      try {
        await applyOp(c, op);
      } catch (err) {
        console.error("sync op failed", op.kind, err);
        setState("error");
        return;
      }
      await dequeueOp(op.id);
    }
    await pullAll();
    const q = await getSyncQueue();
    await setPending(q.length);
    setState("idle");
    markSynced();
  } catch (err) {
    console.error("syncNow failed", err);
    setState("error");
  } finally {
    syncing = false;
  }
}

type Payload = Record<string, unknown>;

/**
 * Resolve a local-or-server employee id to a server id.
 * Local ids are UUIDs (contain dashes); server ids never do.
 */
async function resolveEmployeeServerId(
  id: string,
): Promise<string | undefined> {
  const mapped = await getMeta<string>(`emp:${id}`);
  if (mapped === "__deleted__") return undefined;
  if (mapped) return mapped;
  if (!id.includes("-")) return id; // already a server id
  return undefined; // local id, never pushed
}

/** Replace a local attendance record with its server-confirmed version. */
async function reconcileAttendance(
  localId: string,
  serverId: string,
): Promise<void> {
  if (localId === serverId) {
    const all = await getAllAttendance();
    const rec = all.find((a) => a.id === localId);
    if (rec) await putAttendance({ ...rec, dirty: false });
    return;
  }
  const all = await getAllAttendance();
  const local = all.find((a) => a.id === localId);
  if (!local) return;
  await deleteAttendanceLocal(localId);
  await putAttendance({ ...local, id: serverId, dirty: false });
}

async function applyOp(c: ConvexReactClient, op: SyncQueueOp): Promise<void> {
  const p = op.payload as Payload;
  switch (op.kind) {
    case "employee.create": {
      // Resolve server id if this local id was mapped before; else create.
      const serverId = await resolveEmployeeServerId(String(p.localId ?? ""));
      if (serverId) {
        await c.mutation(api.employees.update, {
          id: serverId as never,
          name: p.name as string,
          phone: p.phone as string,
          position: p.position as string,
          category: p.category as string,
          notes: p.notes as string | undefined,
          updatedAt: p.updatedAt as number,
        });
      } else {
        try {
          const newId = await c.mutation(api.employees.add, {
            name: p.name as string,
            phone: p.phone as string,
            position: p.position as string,
            category: p.category as string,
            notes: p.notes as string | undefined,
            createdAt: p.createdAt as number,
            updatedAt: p.updatedAt as number,
          });
          if (p.localId) {
            await setMeta(`emp:${String(p.localId)}`, newId);
          }
        } catch (err) {
          if (
            err instanceof Error &&
            err.message.includes("DUPLICATE_EMPLOYEE") &&
            p.localId
          ) {
            // Already exists on the server (e.g. a previous partial sync).
            // Find it and store the mapping so we update instead of create.
            const employees = await c.query(api.employees.list, {});
            const match = employees.find(
              (e) =>
                e.name === p.name && e.phone.trim() === String(p.phone).trim(),
            );
            if (match) {
              await setMeta(`emp:${String(p.localId)}`, match._id);
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        }
      }
      break;
    }
    case "employee.update": {
      // Update by server id when known, otherwise resolve from local id.
      const serverId = await resolveEmployeeServerId(
        (p.localId as string) ?? (p.id as string),
      );
      if (serverId) {
        await c.mutation(api.employees.update, {
          id: serverId as never,
          name: p.name as string,
          phone: p.phone as string,
          position: p.position as string,
          category: p.category as string,
          notes: p.notes as string | undefined,
          updatedAt: p.updatedAt as number,
        });
      } else {
        // Not on the server yet — create it.
        const newId = await c.mutation(api.employees.add, {
          name: p.name as string,
          phone: p.phone as string,
          position: p.position as string,
          category: p.category as string,
          notes: p.notes as string | undefined,
          createdAt: p.createdAt as number,
          updatedAt: p.updatedAt as number,
        });
        if (p.localId) {
          await setMeta(`emp:${String(p.localId)}`, newId);
        }
      }
      break;
    }
    case "employee.delete": {
      const serverId = await resolveEmployeeServerId(
        (p.localId as string) ?? (p.id as string),
      );
      if (serverId) {
        // Optionally remove history too.
        if (p.withHistory) {
          const atts = await getAllAttendance();
          const mine = atts.filter(
            (a) =>
              a.employeeId === (p.localId as string) ||
              a.employeeId === serverId,
          );
          for (const a of mine) {
            if (!a.dirty) {
              await c.mutation(api.attendance.removeRecord, {
                id: a.id as never,
              });
            }
          }
        }
        await c.mutation(api.employees.remove, { id: serverId as never });
        if (p.localId) {
          await setMeta(`emp:${String(p.localId)}`, "__deleted__");
        }
      }
      break;
    }
    case "attendance.upsert": {
      // Resolve employee id: could be server id directly or a local id.
      const employeeId = await resolveEmployeeServerId(
        p.employeeId as string,
      );
      if (!employeeId) break; // employee was deleted; drop the record
      const serverId = await c.mutation(api.attendance.upsert, {
        employeeId: employeeId as never,
        employeeName: p.employeeName as string,
        date: p.date as string,
        time: p.time as string | undefined,
        status: p.status as AttendanceStatus,
        notes: p.notes as string | undefined,
        createdAt: p.createdAt as number,
        updatedAt: p.updatedAt as number,
      });
      // If the op carried the local record id, reconcile ids after push.
      if (p.localRecordId) {
        await reconcileAttendance(
          p.localRecordId as string,
          serverId as string,
        );
      }
      break;
    }
    case "attendance.update": {
      // Local record id may not exist on the server; resolve via employee+date.
      const atts = await getAllAttendance();
      const local = atts.find((a) => a.id === (p.id as string));
      if (local && local.dirty) {
        // Not yet on the server — upsert it.
        const employeeId = await resolveEmployeeServerId(local.employeeId);
        if (!employeeId) break;
        const serverId = await c.mutation(api.attendance.upsert, {
          employeeId: employeeId as never,
          employeeName: local.employeeName,
          date: local.date,
          time: p.time as string | undefined,
          status: p.status as AttendanceStatus,
          notes: p.notes as string | undefined,
          createdAt: local.createdAt,
          updatedAt: p.updatedAt as number,
        });
        await reconcileAttendance(local.id, serverId as string);
      } else if (local) {
        // Server id is the same as local id (record came from pull).
        await c.mutation(api.attendance.updateRecord, {
          id: local.id as never,
          time: p.time as string | undefined,
          status: p.status as AttendanceStatus,
          notes: p.notes as string | undefined,
          updatedAt: p.updatedAt as number,
        });
      }
      break;
    }
    case "attendance.delete": {
      const atts = await getAllAttendance();
      const local = atts.find((a) => a.id === (p.id as string));
      if (local && !local.dirty) {
        await c.mutation(api.attendance.removeRecord, { id: p.id as never });
      }
      break;
    }
    case "settings.upsert":
      await c.mutation(api.settings.upsert, {
        schoolName: p.schoolName as string,
        principalName: p.principalName as string,
        defaultArrivalTime: p.defaultArrivalTime as string,
        lateThreshold: p.lateThreshold as string,
        workingDays: p.workingDays as number[],
        reportFooterNote: p.reportFooterNote as string | undefined,
        theme: p.theme as "light" | "dark" | undefined,
        principalPhoto: p.principalPhoto as string | undefined,
      });
      break;
    case "message.add":
      await c.mutation(api.thankYouMessages.add, {
        text: p.text as string,
        createdAt: p.createdAt as number,
      });
      break;
    case "message.delete":
      await c.mutation(api.thankYouMessages.remove, { id: p.id as never });
      break;
  }
}

/** Pull fresh employees/attendance/settings and cache them locally. */
export async function pullAll(): Promise<void> {
  const c = getClient();
  if (!c) return; // local-only build: nothing to pull
  const employees = await c.query(api.employees.list, {});
  const attendance = await c.query(api.attendance.listAll, {});
  const settings = await c.query(api.settings.get, {});

  // Build reverse map: serverId -> localId for employees created offline.
  const localEmployees = await getAllEmployees();
  const serverToLocal = new Map<string, string>();
  for (const le of localEmployees) {
    const mapped = await getMeta<string>(`emp:${le.id}`);
    if (mapped && mapped !== "__deleted__") {
      serverToLocal.set(mapped, le.id);
    }
  }

  const localEmployeeList: LocalEmployee[] = [];
  for (const e of employees) {
    const localId = serverToLocal.get(e._id);
    // Preserve dirty flag if local record is dirty and not yet replaced.
    const existingLocal = localId
      ? localEmployees.find((l) => l.id === localId)
      : undefined;
    localEmployeeList.push({
      id: localId ?? e._id,
      name: e.name,
      phone: e.phone,
      position: e.position,
      category: e.category,
      notes: e.notes,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      dirty: existingLocal?.dirty ? false : false,
    });
  }
  await putEmployees(localEmployeeList);

  // Remove local rows the server no longer contains (confirmed deletions and
  // stale tombstones). Dirty rows are still pending upload, so keep them.
  const localEmployeeIds = new Set(localEmployeeList.map((e) => e.id));
  for (const le of localEmployees) {
    if (!le.dirty && !localEmployeeIds.has(le.id)) {
      await deleteEmployeeLocal(le.id);
    }
  }

  const localAttendanceList: LocalAttendance[] = attendance.map((r): LocalAttendance => {
    const empLocalId = serverToLocal.get(r.employeeId);
    return {
      id: r._id,
      employeeId: empLocalId ?? r.employeeId,
      employeeName: r.employeeName,
      date: r.date,
      time: r.time,
      status: r.status,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      dirty: false,
    };
  });

  // Keep local dirty records that are newer than server ones (offline edits).
  const localAtts = await getAllAttendance();
  const serverAttIds = new Set(localAttendanceList.map((r) => r.id));
  for (const la of localAtts) {
    if (la.dirty && !serverAttIds.has(la.id)) {
      localAttendanceList.push(la);
    }
  }

  await putAttendanceList(localAttendanceList);

  // Remove local attendance rows the server no longer has. Dirty rows were
  // merged into localAttendanceList above because they await upload.
  for (const la of localAtts) {
    if (!la.dirty && !serverAttIds.has(la.id)) {
      await deleteAttendanceLocal(la.id);
    }
  }

  if (settings) {
    const localSettings: LocalSettings = {
      id: "school",
      schoolName: settings.schoolName,
      principalName: settings.principalName,
      defaultArrivalTime: settings.defaultArrivalTime,
      lateThreshold: settings.lateThreshold,
      workingDays: settings.workingDays,
      reportFooterNote: settings.reportFooterNote,
      theme: settings.theme,
      principalPhoto: settings.principalPhoto,
      updatedAt: Date.now(),
    };
    await putSettings(localSettings);
  }
}

/** Update a local attendance record and mark it dirty. */
export async function markAttendanceDirty(
  id: string,
  patch: Partial<LocalAttendance>,
): Promise<void> {
  const atts = await getAllAttendance();
  const rec = atts.find((a) => a.id === id);
  if (rec) {
    await putAttendance({ ...rec, ...patch, dirty: true, updatedAt: Date.now() });
  }
}

/** Force a full sync (called by the sync chip). */
export async function manualSync(): Promise<void> {
  await syncNow();
}
