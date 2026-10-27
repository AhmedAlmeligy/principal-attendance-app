import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { syncNow } from "@/lib/sync-client";
import {
  getAllAttendance,
  getAllEmployees,
  getLocalSettings,
  setMeta,
  getMeta,
} from "@/lib/local-db";
import type { LocalAttendance, LocalEmployee } from "@/lib/local-db";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/types";

export type Employee = LocalEmployee;
export type AttendanceRecord = LocalAttendance;

interface DataContextValue {
  employees: Employee[];
  attendance: AttendanceRecord[];
  settings: AppSettings;
  hydrated: boolean;
  refresh: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    const [emps, atts, st] = await Promise.all([
      getAllEmployees(),
      getAllAttendance(),
      getLocalSettings(),
    ]);
    setEmployees(emps.filter((e) => !e.deleted));
    setAttendance(atts.filter((a) => !a.deleted));
    if (st) {
      setSettings({
        schoolName: st.schoolName,
        principalName: st.principalName,
        defaultArrivalTime: st.defaultArrivalTime,
        lateThreshold: st.lateThreshold,
        workingDays: st.workingDays,
        reportFooterNote: st.reportFooterNote,
        theme: st.theme,
        principalPhoto: st.principalPhoto,
      });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  const value = useMemo(
    () => ({ employees, attendance, settings, hydrated, refresh }),
    [employees, attendance, settings, hydrated, refresh],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

/** Kick a background sync then refresh local state. */
export function useTriggerSync() {
  return useCallback(async () => {
    await syncNow();
  }, []);
}

/** Record initial boot meta (used for diagnostics). */
export async function touchBootMeta() {
  const last = await getMeta<number>("lastBoot");
  await setMeta("lastBoot", Date.now());
  return last;
}
