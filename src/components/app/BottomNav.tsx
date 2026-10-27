import { cn } from "@/lib/utils";
import {
  BarChart3,
  CalendarCheck2,
  Heart,
  Home,
  Settings,
  Users,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router";

const TABS = [
  { path: "/app", label: "الرئيسية", icon: Home, exact: true },
  { path: "/app/attendance", label: "الحضور", icon: CalendarCheck2, exact: false },
  { path: "/app/employees", label: "الموظفين", icon: Users, exact: false },
  { path: "/app/reports", label: "التقارير", icon: BarChart3, exact: false },
  { path: "/app/settings", label: "الإعدادات", icon: Settings, exact: true },
] as const;

export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-md px-3 pb-3">
        <div className="glass-strong flex items-center justify-between rounded-2xl px-2 py-1.5">
          {TABS.map((tab) => {
            const active = tab.exact
              ? pathname === tab.path
              : pathname.startsWith(tab.path);
            const Icon = tab.icon;
            return (
              <button
                key={tab.path}
                type="button"
                onClick={() => navigate(tab.path)}
                className={cn(
                  "flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-all",
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "drop-shadow-sm")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export { TABS };
export const HeartIcon = Heart;
