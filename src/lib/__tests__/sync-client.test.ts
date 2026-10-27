import { beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";

// The sync engine talks to Convex through a registered ConvexReactClient.
// We register a lightweight fake so tests exercise the real queue/reconcile
// logic without a backend.
const mutationCalls: Array<{ fn: string; args: unknown }> = [];
let serverEmployees: Array<{
  _id: string;
  name: string;
  phone: string;
  position: string;
  category: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}> = [];
let serverAttendance: Array<{
  _id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  time?: string;
  status: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}> = [];
let serverSettings: {
  schoolName: string;
  principalName: string;
  defaultArrivalTime: string;
  lateThreshold: string;
  workingDays: number[];
  reportFooterNote?: string;
} | null = null;
let failNextAdd = false;

const fakeClient = {
  async mutation(fn: { __fn?: string }, args: unknown) {
    const name = (fn as unknown as { __fn?: string }).__fn ?? "unknown";
    const a = args as Record<string, unknown>;
    if (name === "employees.add") {
      if (failNextAdd) {
        failNextAdd = false;
        throw new Error("DUPLICATE_EMPLOYEE");
      }
      const id = `srvEmp${serverEmployees.length + 1}`;
      serverEmployees.push({
        _id: id,
        name: a.name as string,
        phone: a.phone as string,
        position: a.position as string,
        category: a.category as string,
        notes: a.notes as string | undefined,
        createdAt: a.createdAt as number,
        updatedAt: a.updatedAt as number,
      });
      mutationCalls.push({ fn: name, args });
      return id;
    }
    if (name === "employees.update") {
      const emp = serverEmployees.find((e) => e._id === a.id);
      if (emp) {
        Object.assign(emp, {
          name: a.name,
          phone: a.phone,
          position: a.position,
          category: a.category,
          notes: a.notes,
          updatedAt: a.updatedAt,
        });
      }
      mutationCalls.push({ fn: name, args });
      return a.id;
    }
    if (name === "employees.remove") {
      serverEmployees = serverEmployees.filter((e) => e._id !== a.id);
      mutationCalls.push({ fn: name, args });
      return null;
    }
    if (name === "attendance.upsert") {
      const existing = serverAttendance.find(
        (r) => r.employeeId === a.employeeId && r.date === a.date,
      );
      if (existing) {
        Object.assign(existing, {
          time: a.time,
          status: a.status,
          notes: a.notes,
          updatedAt: a.updatedAt,
        });
        mutationCalls.push({ fn: name, args });
        return existing._id;
      }
      const id = `srvAtt${serverAttendance.length + 1}`;
      serverAttendance.push({
        _id: id,
        employeeId: a.employeeId as string,
        employeeName: a.employeeName as string,
        date: a.date as string,
        time: a.time as string | undefined,
        status: a.status as string,
        notes: a.notes as string | undefined,
        createdAt: a.createdAt as number,
        updatedAt: a.updatedAt as number,
      });
      mutationCalls.push({ fn: name, args });
      return id;
    }
    if (name === "attendance.updateRecord") {
      const rec = serverAttendance.find((r) => r._id === a.id);
      if (rec) {
        Object.assign(rec, {
          time: a.time,
          status: a.status,
          notes: a.notes,
          updatedAt: a.updatedAt,
        });
      }
      mutationCalls.push({ fn: name, args });
      return a.id;
    }
    if (name === "attendance.removeRecord") {
      serverAttendance = serverAttendance.filter((r) => r._id !== a.id);
      mutationCalls.push({ fn: name, args });
      return null;
    }
    if (name === "settings.upsert") {
      serverSettings = {
        schoolName: a.schoolName as string,
        principalName: a.principalName as string,
        defaultArrivalTime: a.defaultArrivalTime as string,
        lateThreshold: a.lateThreshold as string,
        workingDays: a.workingDays as number[],
        reportFooterNote: a.reportFooterNote as string | undefined,
      };
      mutationCalls.push({ fn: name, args });
      return null;
    }
    throw new Error(`Unexpected mutation: ${name}`);
  },
  async query(fn: unknown) {
    const name =
      (fn as { __fn?: string }).__fn ?? new String(fn).toString();
    if (name.includes("employees") && name.includes("list")) {
      return serverEmployees;
    }
    if (name.includes("attendance") && name.includes("listAll")) {
      return serverAttendance;
    }
    if (name.includes("settings") && name.includes("get")) {
      return serverSettings;
    }
    throw new Error(`Unexpected query: ${name}`);
  },
} as unknown as import("convex/react").ConvexReactClient;

import {
  clearAllLocalData,
  enqueueOp,
  getAllAttendance,
  getAllEmployees,
  getMeta,
  getSyncQueue,
  putAttendance,
  putEmployee,
  putSettings,
  type LocalAttendance,
  type LocalEmployee,
} from "../local-db";
import {
  getSyncSnapshot,
  onSyncStateChange,
  pullAll,
  registerConvexClient,
  setPending,
  syncNow,
} from "../sync-client";

function makeEmployee(overrides: Partial<LocalEmployee> = {}): LocalEmployee {
  return {
    id: "loc-emp-1",
    name: "أحمد محمد",
    phone: "07701234567",
    position: "مدرس",
    category: "تدريسي",
    createdAt: 1000,
    updatedAt: 1000,
    dirty: true,
    ...overrides,
  };
}

function makeRecord(overrides: Partial<LocalAttendance> = {}): LocalAttendance {
  return {
    id: "loc-att-1",
    employeeId: "loc-emp-1",
    employeeName: "أحمد محمد",
    date: "2026-09-17",
    status: "present",
    createdAt: 1000,
    updatedAt: 1000,
    dirty: true,
    ...overrides,
  };
}

// Tag fake api functions so the fake client can route them.
vi.mock("@/convex/_generated/api", () => {
  const tag = (path: string) => ({ __fn: path, [path]: true });
  return {
    api: {
      employees: {
        list: tag("employees.list"),
        add: tag("employees.add"),
        update: tag("employees.update"),
        remove: tag("employees.remove"),
      },
      attendance: {
        listAll: tag("attendance.listAll"),
        upsert: tag("attendance.upsert"),
        updateRecord: tag("attendance.updateRecord"),
        removeRecord: tag("attendance.removeRecord"),
      },
      settings: {
        get: tag("settings.get"),
        upsert: tag("settings.upsert"),
      },
      thankYouMessages: {
        list: tag("thankYouMessages.list"),
        add: tag("thankYouMessages.add"),
        remove: tag("thankYouMessages.remove"),
      },
    },
  };
});

beforeEach(async () => {
  await clearAllLocalData();
  mutationCalls.length = 0;
  serverEmployees = [];
  serverAttendance = [];
  serverSettings = null;
  failNextAdd = false;
  registerConvexClient(fakeClient);
  vi.stubGlobal("navigator", { ...navigator, onLine: true });
  setPending(0);
});

describe("sync engine", () => {
  it("reports offline without touching the queue when navigator.onLine is false", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    await enqueueOp({
      id: "op-1",
      kind: "employee.create",
      payload: {},
      queuedAt: 1,
    });

    const seen: string[] = [];
    onSyncStateChange(() => seen.push(getSyncSnapshot().state));
    await syncNow();

    expect(seen).toContain("offline");
    expect(await getSyncQueue()).toHaveLength(1); // untouched
    expect(mutationCalls).toHaveLength(0);
  });

  it("pushes an offline-created employee, maps local id to server id and pulls it back", async () => {
    // Offline: employee + one attendance record created locally
    await putEmployee(makeEmployee());
    await putAttendance(makeRecord());
    await enqueueOp({
      id: "op-1",
      kind: "employee.create",
      payload: {
        name: "أحمد محمد",
        phone: "07701234567",
        position: "مدرس",
        category: "تدريسي",
        localId: "loc-emp-1",
        createdAt: 1000,
        updatedAt: 1000,
      },
      queuedAt: 1,
    });
    await enqueueOp({
      id: "op-2",
      kind: "attendance.upsert",
      payload: {
        employeeId: "loc-emp-1",
        employeeName: "أحمد محمد",
        date: "2026-09-17",
        status: "present",
        localRecordId: "loc-att-1",
        createdAt: 1000,
        updatedAt: 1000,
      },
      queuedAt: 2,
    });

    await syncNow();

    // 1) employee was created on the server exactly once
    const adds = mutationCalls.filter((c) => c.fn === "employees.add");
    expect(adds).toHaveLength(1);

    // 2) attendance upsert was sent with the RESOLVED server employee id
    const upserts = mutationCalls.filter((c) => c.fn === "attendance.upsert");
    expect(upserts).toHaveLength(1);
    expect((upserts[0]!.args as Record<string, unknown>).employeeId).toMatch(
      /^srvEmp/,
    );

    // 3) queue is drained and pending count is zero
    expect(await getSyncQueue()).toHaveLength(0);
    expect(getSyncSnapshot().pendingOps).toBe(0);
    expect(getSyncSnapshot().state).toBe("idle");

    // 4) pulled back: local list keeps the LOCAL employee id and is clean
    const emps = await getAllEmployees();
    expect(emps).toHaveLength(1);
    expect(emps[0]!.id).toBe("loc-emp-1"); // still referenced by local records
    expect(emps[0]!.dirty).toBe(false);

    // 5) attendance reconciled to the server id and no longer dirty
    const atts = await getAllAttendance();
    expect(atts).toHaveLength(1);
    expect(atts[0]!.id).toMatch(/^srvAtt/);
    expect(atts[0]!.employeeId).toBe("loc-emp-1");
    expect(atts[0]!.dirty).toBe(false);

    // 6) id mapping stored
    expect(await getMeta<string>("emp:loc-emp-1")).toMatch(/^srvEmp/);
  });

  it("is idempotent: re-running sync does not duplicate employees", async () => {
    await putEmployee(makeEmployee());
    await enqueueOp({
      id: "op-1",
      kind: "employee.create",
      payload: {
        name: "أحمد محمد",
        phone: "07701234567",
        position: "مدرس",
        category: "تدريسي",
        localId: "loc-emp-1",
        createdAt: 1000,
        updatedAt: 1000,
      },
      queuedAt: 1,
    });

    await syncNow();
    await syncNow(); // nothing left to do
    await syncNow();

    const adds = mutationCalls.filter((c) => c.fn === "employees.add");
    expect(adds).toHaveLength(1);
    expect(serverEmployees).toHaveLength(1);
    expect((await getAllEmployees()).length).toBe(1);
  });

  it("recovers from a server duplicate by mapping to the existing row", async () => {
    await putEmployee(makeEmployee());
    failNextAdd = true; // first create attempt throws DUPLICATE_EMPLOYEE

    await enqueueOp({
      id: "op-1",
      kind: "employee.create",
      payload: {
        name: "أحمد محمد",
        phone: "07701234567",
        position: "مدرس",
        category: "تدريسي",
        localId: "loc-emp-1",
        createdAt: 1000,
        updatedAt: 1000,
      },
      queuedAt: 1,
    });

    // Pre-seed the server with the "already exists" row.
    serverEmployees.push({
      _id: "srvEmpExisting",
      name: "أحمد محمد",
      phone: "07701234567",
      position: "مدرس",
      category: "تدريسي",
      createdAt: 1,
      updatedAt: 1,
    });

    await syncNow();

    // Mapped to the existing server row; no duplicate created.
    expect(await getMeta<string>("emp:loc-emp-1")).toBe("srvEmpExisting");
    expect(serverEmployees).toHaveLength(1);
    expect(getSyncSnapshot().state).toBe("idle");
  });

  it("stops and reports error when a server op fails, keeping the op queued", async () => {
    failNextAdd = true;
    // No matching server row exists, so the duplicate-recovery path rethrows.
    await enqueueOp({
      id: "op-1",
      kind: "employee.create",
      payload: { localId: "loc-emp-1", name: "س", phone: "07700000000" },
      queuedAt: 1,
    });

    const seen: string[] = [];
    onSyncStateChange(() => seen.push(getSyncSnapshot().state));
    await syncNow();

    expect(seen).toContain("error");
    expect(await getSyncQueue()).toHaveLength(1); // op kept for retry
  });

  it("pushes settings to the server", async () => {
    await putSettings({
      id: "school",
      schoolName: "مدرسة الاختبار",
      principalName: "المدير",
      defaultArrivalTime: "08:00",
      lateThreshold: "08:15",
      workingDays: [0, 1, 2],
      updatedAt: 1,
    });
    await enqueueOp({
      id: "op-1",
      kind: "settings.upsert",
      payload: {
        schoolName: "مدرسة الاختبار",
        principalName: "المدير",
        defaultArrivalTime: "08:00",
        lateThreshold: "08:15",
        workingDays: [0, 1, 2],
      },
      queuedAt: 1,
    });

    await syncNow();

    expect(serverSettings?.schoolName).toBe("مدرسة الاختبار");
    expect(serverSettings?.workingDays).toEqual([0, 1, 2]);
    expect(await getSyncQueue()).toHaveLength(0);
  });

  it("delete flows: confirmed server deletions are cleaned up locally on pull", async () => {
    // Server has an employee + record; local cache already knows them.
    serverEmployees.push({
      _id: "srvEmp1",
      name: "خالد",
      phone: "07701112233",
      position: "مدرس",
      category: "تدريسي",
      createdAt: 1,
      updatedAt: 1,
    });
    serverAttendance.push({
      _id: "srvAtt1",
      employeeId: "srvEmp1",
      employeeName: "خالد",
      date: "2026-09-10",
      status: "present",
      createdAt: 1,
      updatedAt: 1,
    });
    await putEmployee({
      id: "srvEmp1",
      name: "خالد",
      phone: "07701112233",
      position: "مدرس",
      category: "تدريسي",
      createdAt: 1,
      updatedAt: 1,
      dirty: false,
    });
    await putAttendance({
      id: "srvAtt1",
      employeeId: "srvEmp1",
      employeeName: "خالد",
      date: "2026-09-10",
      status: "present",
      createdAt: 1,
      updatedAt: 1,
      dirty: false,
    });

    // Simulate a deletion performed on another device / earlier session:
    // the rows are gone from the server but still cached locally.
    serverEmployees = [];
    serverAttendance = [];

    await pullAll();

    expect(await getAllEmployees()).toHaveLength(0);
    expect(await getAllAttendance()).toHaveLength(0);
  });

  it("keeps dirty local records that have not been uploaded yet during pull", async () => {
    serverEmployees.push({
      _id: "srvEmp1",
      name: "خالد",
      phone: "07701112233",
      position: "مدرس",
      category: "تدريسي",
      createdAt: 1,
      updatedAt: 1,
    });
    await putEmployee({
      id: "srvEmp1",
      name: "خالد",
      phone: "07701112233",
      position: "مدرس",
      category: "تدريسي",
      createdAt: 1,
      updatedAt: 1,
      dirty: false,
    });
    // Recorded offline a minute ago, op still queued (not yet uploaded).
    await putAttendance(makeRecord({ employeeId: "srvEmp1", dirty: true }));
    await enqueueOp({
      id: "op-1",
      kind: "attendance.upsert",
      payload: { employeeId: "srvEmp1", date: "2026-09-17" },
      queuedAt: 1,
    });

    await pullAll();

    const atts = await getAllAttendance();
    expect(atts).toHaveLength(1);
    expect(atts[0]!.dirty).toBe(true); // preserved for the next sync
  });
});
