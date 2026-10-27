import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface LocalEmployee {
  id: string;
  name: string;
  phone: string;
  position: string;
  category: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  /** true when created/edited locally and not yet confirmed by the server */
  dirty?: boolean;
  /** local tombstone waiting for server delete */
  deleted?: boolean;
}

export interface LocalAttendance {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  time?: string;
  status: "present" | "late" | "absent" | "permission";
  notes?: string;
  createdAt: number;
  updatedAt: number;
  /** true when created/edited locally and not yet confirmed by the server */
  dirty?: boolean;
  /** local tombstone waiting for server delete */
  deleted?: boolean;
}

export interface LocalSettings {
  id: "school";
  schoolName: string;
  principalName: string;
  defaultArrivalTime: string;
  lateThreshold: string;
  workingDays: number[];
  reportFooterNote?: string;
  theme?: "light" | "dark";
  principalPhoto?: string;
  updatedAt: number;
}

export type SyncQueueOp = {
  id: string;
  kind:
    | "employee.create"
    | "employee.update"
    | "employee.delete"
    | "attendance.upsert"
    | "attendance.update"
    | "attendance.delete"
    | "settings.upsert"
    | "message.add"
    | "message.delete";
  payload: Record<string, unknown>;
  queuedAt: number;
};

interface HaderDB extends DBSchema {
  employees: { value: LocalEmployee; key: string; indexes: { by_name: string } };
  attendance: { value: LocalAttendance; key: string; indexes: { by_date: string } };
  settings: { value: LocalSettings; key: string };
  syncQueue: { value: SyncQueueOp; key: string };
  meta: { value: { key: string; value: unknown }; key: string };
}

const DB_NAME = "hader-principal-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<HaderDB>> | null = null;

function getDB(): Promise<IDBPDatabase<HaderDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HaderDB>(DB_NAME, DB_VERSION, {
      upgrade(db: IDBPDatabase<HaderDB>) {
        if (!db.objectStoreNames.contains("employees")) {
          const store = db.createObjectStore("employees", { keyPath: "id" });
          store.createIndex("by_name", "name");
        }
        if (!db.objectStoreNames.contains("attendance")) {
          const store = db.createObjectStore("attendance", { keyPath: "id" });
          store.createIndex("by_date", "date");
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("syncQueue")) {
          db.createObjectStore("syncQueue", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

// ---- employees ----
export async function getAllEmployees(): Promise<LocalEmployee[]> {
  const db = await getDB();
  return db.getAll("employees");
}

export async function putEmployee(e: LocalEmployee): Promise<void> {
  const db = await getDB();
  await db.put("employees", e);
}

export async function putEmployees(list: LocalEmployee[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("employees", "readwrite");
  await Promise.all([...list.map((e) => tx.store.put(e)), tx.done]);
}

export async function deleteEmployeeLocal(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("employees", id);
}

// ---- attendance ----
export async function getAllAttendance(): Promise<LocalAttendance[]> {
  const db = await getDB();
  return db.getAll("attendance");
}

export async function getAttendanceByDate(
  date: string,
): Promise<LocalAttendance[]> {
  const db = await getDB();
  return db.getAllFromIndex("attendance", "by_date", date);
}

export async function putAttendance(r: LocalAttendance): Promise<void> {
  const db = await getDB();
  await db.put("attendance", r);
}

export async function putAttendanceList(list: LocalAttendance[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("attendance", "readwrite");
  await Promise.all([...list.map((r) => tx.store.put(r)), tx.done]);
}

export async function deleteAttendanceLocal(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("attendance", id);
}

// ---- settings ----
export async function getLocalSettings(): Promise<LocalSettings | undefined> {
  const db = await getDB();
  return db.get("settings", "school");
}

export async function putSettings(s: LocalSettings): Promise<void> {
  const db = await getDB();
  await db.put("settings", { ...s, id: "school" as const });
}

// ---- sync queue ----
export async function enqueueOp(op: SyncQueueOp): Promise<void> {
  const db = await getDB();
  await db.put("syncQueue", op);
}

export async function getSyncQueue(): Promise<SyncQueueOp[]> {
  const db = await getDB();
  return db.getAll("syncQueue");
}

export async function dequeueOp(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("syncQueue", id);
}

// ---- maintenance ----
/** Wipe every local store (employees, attendance, settings, queue, meta). */
export async function clearAllLocalData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ["employees", "attendance", "settings", "syncQueue", "meta"],
    "readwrite",
  );
  await Promise.all([
    tx.objectStore("employees").clear(),
    tx.objectStore("attendance").clear(),
    tx.objectStore("settings").clear(),
    tx.objectStore("syncQueue").clear(),
    tx.objectStore("meta").clear(),
    tx.done,
  ]);
}

// ---- meta ----
export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const row = await db.get("meta", key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put("meta", { key, value });
}

export async function deleteMeta(key: string): Promise<void> {
  const db = await getDB();
  await db.delete("meta", key);
}
