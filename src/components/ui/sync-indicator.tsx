import { cn } from "@/lib/utils";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

interface SyncIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
  className?: string;
}

export function SyncIndicator({ isOnline, isSyncing, className }: SyncIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isSyncing ? (
        <div className="flex items-center gap-1.5 text-primary">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-xs font-medium">Sincronizando...</span>
        </div>
      ) : isOnline ? (
        <div className="flex items-center gap-1.5 text-status-ready">
          <Wifi className="w-4 h-4" />
          <span className="text-xs font-medium">Online</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <WifiOff className="w-4 h-4" />
          <span className="text-xs font-medium">Offline</span>
        </div>
      )}
    </div>
  );
}
