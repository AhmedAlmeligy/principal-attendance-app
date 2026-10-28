import { Button } from "@/components/ui/button";
import { LogoAvatar } from "@/components/app/LogoAvatar";
import { useApp } from "@/providers/app-provider";
import { cn } from "@/lib/utils";
import { syncNow } from "@/lib/sync-client";
import { CloudCheck, CloudOff, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

function SyncChip() {
  const { syncState, pendingOps, net, refresh } = useApp();
  const [spinning, setSpinning] = useState(false);

  const label =
    net === "offline"
      ? "غير متصل"
      : syncState === "syncing"
        ? "جاري المزامنة"
        : syncState === "error"
          ? "تعذر المزامنة"
          : pendingOps > 0
            ? `بانتظار المزامنة (${pendingOps})`
            : "تمت المزامنة";

  const handleManualSync = async () => {
    setSpinning(true);
    try {
      await refresh();
      await syncNow();
      await refresh();
    } finally {
      setSpinning(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleManualSync}
      className={cn(
        "glass-chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-transform active:scale-95",
        net === "offline"
          ? "dark:text-amber-300 text-amber-700"
          : syncState === "error"
            ? "text-destructive"
            : "text-primary",
      )}
    >
      {net === "offline" ? (
        <CloudOff className="size-3.5" />
      ) : syncState === "syncing" || spinning ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : syncState === "error" ? (
        <RefreshCw className="size-3.5" />
      ) : (
        <CloudCheck className="size-3.5" />
      )}
      <span>{label}</span>
    </button>
  );
}

export function AppHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { settings } = useApp();
  const navigate = useNavigate();

  return (
    <header className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-extrabold tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <SyncChip />
        <Button
          variant="ghost"
          size="icon"
          className="glass-chip size-9 overflow-hidden rounded-full p-0"
          onClick={() => navigate("/app/settings")}
          aria-label="الملف الشخصي والإعدادات"
        >
          {settings.principalPhoto ? (
            <img
              src={settings.principalPhoto}
              alt="صورة المدير"
              className="size-9 rounded-full object-cover"
            />
          ) : (
            <LogoAvatar className="size-9" />
          )}
        </Button>
      </div>
    </header>
  );
}
