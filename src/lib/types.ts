export const APP_STATUS = {
  present: "present",
  late: "late",
  absent: "absent",
  permission: "permission",
} as const;

export type AttendanceStatus =
  (typeof APP_STATUS)[keyof typeof APP_STATUS];

export interface Employee {
  id: string;
  name: string;
  phone: string;
  position: string;
  category: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  status: AttendanceStatus;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type ThemeSetting = "light" | "dark";

export interface AppSettings {
  schoolName: string;
  principalName: string;
  defaultArrivalTime: string; // HH:MM
  lateThreshold: string; // HH:MM
  workingDays: number[]; // 0=Sunday ... 6=Saturday
  reportFooterNote?: string;
  /** App appearance — persisted with settings and synced to the cloud. */
  theme?: ThemeSetting;
  /** Principal profile photo as a small data URL (downscaled to ≤256px). */
  principalPhoto?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  schoolName: "مدرستي",
  principalName: "مدير المدرسة",
  defaultArrivalTime: "08:00",
  lateThreshold: "08:15",
  workingDays: [0, 1, 2, 3, 4],
};

export const THANK_YOU_PRESETS: string[] = [
  "شكراً لجهودك والتزامك.",
  "نقدر جهودك وتفانيك في العمل.",
  "شكراً على عطائك وجهودك المستمرة.",
];

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "حضور",
  late: "تأخير",
  absent: "غياب",
  permission: "مأذونية",
};

export interface CategoryMeta {
  value: string;
  label: string;
}

export const EMPLOYEE_CATEGORIES: CategoryMeta[] = [
  { value: "تدريسي", label: "تدريسي" },
  { value: "إداري", label: "إداري" },
  { value: "خدمات", label: "خدمات" },
  { value: "أخرى", label: "أخرى" },
];
