import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import {
  clearAllLocalData,
  deleteAttendanceLocal,
  deleteEmployeeLocal,
  enqueueOp,
  getAllAttendance,
  getAllEmployees,
  getAttendanceByDate,
  getLocalSettings,
  getMeta,
  getSyncQueue,
  putAttendance,
  putAttendanceList,
  putEmployee,
  putEmployees,
  putSettings,
  setMeta,
  type LocalAttendance,
  type LocalEmployee,
} from "../local-db";

function makeEmployee(overrides: Partial<LocalEmployee> = {}): LocalEmployee {
  return {
    id: "locEmp1",
    name: "أحمد محمد",
    phone: "07701234567",
    position: "مدرس",
    category: "تدريسي",
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeRecord(overrides: Partial<LocalAttendance> = {}): LocalAttendance {
  return {
    id: "locAtt1",
    employeeId: "locEmp1",
    employeeName: "أحمد محمد",
    date: "2026-09-17",
    status: "present",
    createdAt: 1000,
    updatedAt: 1000,
    dirty: true,
    ...overrides,
  };
}

beforeEach(async () => {
  // fresh stores per test (avoids spec-level open-connection delete hangs)
  await clearAllLocalData();
});

describe("employees store", () => {
  it("round-trips an employee", async () => {
    const emp = makeEmployee();
    await putEmployee(emp);
    const all = await getAllEmployees();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: "locEmp1", name: "أحمد محمد" });
  });

  it("bulk-put preserves dirty flags and overwrites by id", async () => {
    await putEmployees([
      makeEmployee({ id: "a", dirty: true }),
      makeEmployee({ id: "b", dirty: false }),
    ]);
    await putEmployee(makeEmployee({ id: "a", name: "معدّل", dirty: false }));
    const all = await getAllEmployees();
    expect(all).toHaveLength(2);
    const a = all.find((e) => e.id === "a");
    expect(a?.name).toBe("معدّل");
    expect(a?.dirty).toBe(false);
  });

  it("deletes by id only", async () => {
    await putEmployees([makeEmployee({ id: "a" }), makeEmployee({ id: "b" })]);
    await deleteEmployeeLocal("a");
    const all = await getAllEmployees();
    expect(all.map((e) => e.id)).toEqual(["b"]);
  });
});

describe("attendance store", () => {
  it("round-trips a record and indexes by date", async () => {
    await putAttendance(makeRecord());
    await putAttendance(makeRecord({ id: "locAtt2", date: "2026-09-18" }));

    const all = await getAllAttendance();
    expect(all).toHaveLength(2);

    const byDay = await getAttendanceByDate("2026-09-17");
    expect(byDay).toHaveLength(1);
    expect(byDay[0]!.id).toBe("locAtt1");
  });

  it("returns only the requested date", async () => {
    await putAttendanceList([
      makeRecord({ id: "1", date: "2026-09-01" }),
      makeRecord({ id: "2", date: "2026-09-01" }),
      makeRecord({ id: "3", date: "2026-10-01" }),
    ]);
    expect(await getAttendanceByDate("2026-09-01")).toHaveLength(2);
    expect(await getAttendanceByDate("2026-10-01")).toHaveLength(1);
  });

  it("upserting the same employee+date replaces rather than duplicates", async () => {
    // app-level contract: the provider looks the record up by date and patches
    await putAttendance(makeRecord({ status: "present", time: "08:00" }));
    await putAttendance(
      makeRecord({ status: "late", time: "08:20", updatedAt: 2000 }),
    );
    const all = await getAllAttendance();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ status: "late", time: "08:20" });
  });

  it("deletes by id", async () => {
    await putAttendance(makeRecord({ id: "keep" }));
    await putAttendance(makeRecord({ id: "drop", date: "2026-09-18" }));
    await deleteAttendanceLocal("drop");
    expect(await getAllAttendance()).toHaveLength(1);
  });
});

describe("settings store", () => {
  it("upserts the singleton row", async () => {
    await putSettings({
      id: "school",
      schoolName: "مدرسة أولى",
      principalName: "المدير",
      defaultArrivalTime: "08:00",
      lateThreshold: "08:15",
      workingDays: [0, 1],
      updatedAt: 1,
    });
    await putSettings({
      id: "school",
      schoolName: "مدرسة ثانية",
      principalName: "المدير الجديد",
      defaultArrivalTime: "07:30",
      lateThreshold: "07:45",
      workingDays: [0, 1, 2],
      updatedAt: 2,
    });
    const s = await getLocalSettings();
    expect(s?.schoolName).toBe("مدرسة ثانية");
    expect(s?.workingDays).toEqual([0, 1, 2]);
  });
});

describe("sync queue and meta", () => {
  it("enqueues ops with their payload and dequeues by id", async () => {
    await enqueueOp({
      id: "op-1",
      kind: "employee.create",
      payload: { name: "أ", phone: "07700000000", localId: "locEmp1" },
      queuedAt: 1,
    });
    await enqueueOp({
      id: "op-2",
      kind: "attendance.upsert",
      payload: { employeeId: "locEmp1", date: "2026-09-17" },
      queuedAt: 2,
    });

    let queue = await getSyncQueue();
    expect(queue).toHaveLength(2);
    expect(queue[0]!.kind).toBe("employee.create");
    expect(queue[0]!.payload.localId).toBe("locEmp1");

    const { dequeueOp } = await import("../local-db");
    await dequeueOp("op-1");
    queue = await getSyncQueue();
    expect(queue.map((o) => o.id)).toEqual(["op-2"]);
  });

  it("stores and reads meta values", async () => {
    expect(await getMeta<string>("emp:locEmp1")).toBeUndefined();
    await setMeta("emp:locEmp1", "serverId123");
    expect(await getMeta<string>("emp:locEmp1")).toBe("serverId123");
  });

  it("persists data across a database handle reopen (restart test)", async () => {
    await putEmployee(makeEmployee());
    await putAttendance(makeRecord());

    // Simulate app restart: reopen the same named database.
    const { openDB } = await import("idb");
    const db = await openDB("hader-principal-db", 1);
    expect(await db.getAll("employees")).toHaveLength(1);
    expect(await db.getAll("attendance")).toHaveLength(1);
    db.close();
  });
});
