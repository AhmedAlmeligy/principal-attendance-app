import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  DataProvider,
  useData,
  type AttendanceRecord,
  type Employee,
} from "./data-provider";
import { onSyncStateChange, getSyncSnapshot, syncNow } from "@/lib/sync-client";
import {
  enqueueOp,
  getSyncQueue,
  getAllAttendance,
  getAllEmployees,
  putAttendance,
  putEmployee,
  putSettings,
  getAttendanceByDate,
  deleteAttendanceLocal,
  deleteEmployeeLocal,
  type LocalAttendance,
  type LocalEmployee,
  type SyncQueueOp,
} from "@/lib/local-db";
import { dateKey } from "@/lib/datetime";
import type { AppSettings } from "@/lib/types";

type NetState = "online" | "offline";
type AttStatus = "present" | "late" | "absent" | "permission";

interface AppContextValue {
  employees: Employee[];
  attendance: AttendanceRecord[];
  settings: AppSettings;
  hydrated: boolean;
  net: NetState;
  syncState: "idle" | "syncing" | "offline" | "error";
  pendingOps: number;
  refresh: () => Promise<void>;
  queueOp: (op: {
    kind: SyncQueueOp["kind"];
    payload: Record<string, unknown>;
  }) => Promise<void>;
  recordAttendance: (input: {
    employeeId: string;
    employeeName: string;
    date: string;
    time?: string;
    status: AttStatus;
    notes?: string;
  }) => Promise<void>;
  updateAttendance: (input: {
    id: string;
    time?: string;
    status: AttStatus;
    notes?: string;
  }) => Promise<void>;
  addEmployee: (input: {
    name: string;
    phone: string;
    position: string;
    category: string;
    notes?: string;
  }) => Promise<void>;
  updateEmployee: (input: {
    id: string;
    name: string;
    phone: string;
    position: string;
    category: string;
    notes?: string;
  }) => Promise<void>;
  deleteEmployee: (input: { id: string; withHistory: boolean }) => Promise<void>;
  saveSettings: (input: AppSettings) => Promise<void>;
  byDate: (date: string) => Promise<AttendanceRecord[]>;
  getEmployee: (id: string) => Employee | undefined;
}

const AppContext = createContext<AppContextValue | null>(null);

function useAppInternal(): AppContextValue {
  const { employees, attendance, settings, hydrated, refresh } = useData();
  const [net, setNet] = useState<NetState>(
    typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline",
  );
  const [syncState, setSyncState] =
    useState<AppContextValue["syncState"]>("idle");
  const [pendingOps, setPendingOpsState] = useState(0);

  useEffect(() => {
    const online = () => setNet("online");
    const offline = () => setNet("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  useEffect(() => {
    return onSyncStateChange(() => {
      const snap = getSyncSnapshot();
      setSyncState(snap.state);
      setPendingOpsState(snap.pendingOps);
    });
  }, []);

  useEffect(() => {
    if (net !== "online") return;
    let cancelled = false;
    void (async () => {
      const q = await getSyncQueue();
      if (cancelled) return;
      setPendingOpsState(q.length);
      await syncNow();
    })();
    return () => {
      cancelled = true;
    };
  }, [net]);

  const queueOp = useCallback(
    async (op: { kind: SyncQueueOp["kind"]; payload: Record<string, unknown> }) => {
      await enqueueOp({
        id: crypto.randomUUID(),
        kind: op.kind,
        payload: op.payload,
        queuedAt: Date.now(),
      });
      const q = await getSyncQueue();
      setPendingOpsState(q.length);
      if (navigator.onLine) {
        void syncNow();
      }
    },
    [],
  );

  const recordAttendance = useCallback(
    async (input: {
      employeeId: string;
      employeeName: string;
      date: string;
      time?: string;
      status: AttStatus;
      notes?: string;
    }) => {
      const now = Date.now();
      const existing = await getAttendanceByDate(input.date);
      const match = existing.find(
        (r) => r.employeeId === input.employeeId && !r.deleted,
      );
      if (match) {
        const updated: LocalAttendance = {
          ...match,
          time: input.time,
          status: input.status,
          notes: input.notes,
          updatedAt: now,
          dirty: true,
        };
        await putAttendance(updated);
        await queueOp({
          kind: match.dirty ? "attendance.update" : "attendance.upsert",
          payload: match.dirty
            ? {
                id: match.id,
                time: input.time,
                status: input.status,
                notes: input.notes,
                updatedAt: now,
              }
            : {
                employeeId: input.employeeId,
                employeeName: match.employeeName,
                date: input.date,
                time: input.time,
                status: input.status,
                notes: input.notes,
                createdAt: match.createdAt,
                updatedAt: now,
              },
        });
      } else {
        const record: LocalAttendance = {
          id: crypto.randomUUID(),
          employeeId: input.employeeId,
          employeeName: input.employeeName,
          date: input.date,
          time: input.time,
          status: input.status,
          notes: input.notes,
          createdAt: now,
          updatedAt: now,
          dirty: true,
        };
        await putAttendance(record);
        await queueOp({
          kind: "attendance.upsert",
          payload: {
            employeeId: input.employeeId,
            employeeName: input.employeeName,
            date: input.date,
            time: input.time,
            status: input.status,
            notes: input.notes,
            localRecordId: record.id,
            createdAt: now,
            updatedAt: now,
          },
        });
      }
      await refresh();
    },
    [queueOp, refresh],
  );

  const updateAttendance = useCallback(
    async (input: { id: string; time?: string; status: AttStatus; notes?: string }) => {
      const all = await getAllAttendance();
      const record = all.find((r) => r.id === input.id);
      const now = Date.now();
      if (record) {
        await putAttendance({
          ...record,
          time: input.time,
          status: input.status,
          notes: input.notes,
          updatedAt: now,
          dirty: true,
        });
      }
      await queueOp({
        kind: record?.dirty ? "attendance.update" : "attendance.upsert",
        payload: record?.dirty
          ? {
              id: input.id,
              time: input.time,
              status: input.status,
              notes: input.notes,
              updatedAt: now,
            }
          : {
              employeeId: record?.employeeId ?? "",
              employeeName: record?.employeeName ?? "",
              date: record?.date ?? dateKey(new Date()),
              time: input.time,
              status: input.status,
              notes: input.notes,
              createdAt: record?.createdAt ?? now,
              updatedAt: now,
            },
      });
      await refresh();
    },
    [queueOp, refresh],
  );

  const addEmployee = useCallback(
    async (input: {
      name: string;
      phone: string;
      position: string;
      category: string;
      notes?: string;
    }) => {
      const now = Date.now();
      const id = crypto.randomUUID();
      const employee: LocalEmployee = {
        id,
        name: input.name,
        phone: input.phone,
        position: input.position,
        category: input.category,
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
        dirty: true,
      };
      await putEmployee(employee);
      await queueOp({
        kind: "employee.create",
        payload: { ...input, localId: id, createdAt: now, updatedAt: now },
      });
      await refresh();
    },
    [queueOp, refresh],
  );

  const updateEmployee = useCallback(
    async (input: {
      id: string;
      name: string;
      phone: string;
      position: string;
      category: string;
      notes?: string;
    }) => {
      const all = await getAllEmployees();
      const existing = all.find((e) => e.id === input.id);
      const now = Date.now();
      const employee: LocalEmployee = {
        id: input.id,
        name: input.name,
        phone: input.phone,
        position: input.position,
        category: input.category,
        notes: input.notes,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        dirty: true,
      };
      await putEmployee(employee);
      await queueOp({
        kind: existing?.dirty ? "employee.create" : "employee.update",
        payload: { ...input, updatedAt: now },
      });
      await refresh();
    },
    [queueOp, refresh],
  );

  const deleteEmployee = useCallback(
    async (input: { id: string; withHistory: boolean }) => {
      const atts = await getAllAttendance();
      const mine = atts.filter((a) => a.employeeId === input.id);
      if (input.withHistory) {
        for (const a of mine) {
          await deleteAttendanceLocal(a.id);
          if (!a.dirty) {
            await queueOp({ kind: "attendance.delete", payload: { id: a.id } });
          }
        }
      }
      const employees = await getAllEmployees();
      const emp = employees.find((e) => e.id === input.id);
      if (emp?.dirty) {
        // never synced to server: remove locally only
        await deleteEmployeeLocal(input.id);
      } else {
        if (emp) {
          await putEmployee({ ...emp, deleted: true, updatedAt: Date.now() });
        }
        await queueOp({ kind: "employee.delete", payload: { id: input.id } });
      }
      await refresh();
    },
    [queueOp, refresh],
  );

  const saveSettings = useCallback(
    async (input: AppSettings) => {
      const now = Date.now();
      await putSettings({ ...input, id: "school", updatedAt: now });
      await queueOp({ kind: "settings.upsert", payload: { ...input } });
      await refresh();
    },
    [queueOp, refresh],
  );

  const byDate = useCallback(async (date: string) => {
    return (await getAttendanceByDate(date)).filter((r) => !r.deleted);
  }, []);

  const getEmployee = useCallback(
    (id: string) => employees.find((e) => e.id === id),
    [employees],
  );

  return {
    employees,
    attendance,
    settings,
    hydrated,
    net,
    syncState,
    pendingOps,
    refresh,
    queueOp,
    recordAttendance,
    updateAttendance,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    saveSettings,
    byDate,
    getEmployee,
  };
}

function AppInner({ children }: { children: ReactNode }) {
  const value = useAppInternal();
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <DataProvider>
      <AppInner>{children}</AppInner>
    </DataProvider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
