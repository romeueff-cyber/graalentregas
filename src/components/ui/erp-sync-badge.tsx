import { cn } from "@/lib/utils";
import { Database, RefreshCw, WifiOff, Check, AlertCircle } from "lucide-react";
import { formatLastSync, type ERPCacheStatus } from "@/lib/erp-cache";

interface ERPSyncBadgeProps {
  cacheStatus: ERPCacheStatus | null;
  isOnline: boolean;
  isSyncing: boolean;
  onRefresh?: () => void;
  className?: string;
}

export function ERPSyncBadge({ 
  cacheStatus, 
  isOnline, 
  isSyncing, 
  onRefresh,
  className 
}: ERPSyncBadgeProps) {
  // Syncing state
  if (isSyncing) {
    return (
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium",
        className
      )}>
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span>Sincronizando...</span>
      </div>
    );
  }

  // Offline with cache
  if (!isOnline && cacheStatus?.hasCache) {
    return (
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full bg-warning/10 text-warning text-xs font-medium",
        className
      )}>
        <WifiOff className="w-3.5 h-3.5" />
        <span>Offline • {formatLastSync(cacheStatus.lastSync)}</span>
      </div>
    );
  }

  // Offline without cache
  if (!isOnline && !cacheStatus?.hasCache) {
    return (
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-medium",
        className
      )}>
        <AlertCircle className="w-3.5 h-3.5" />
        <span>Offline • Sem dados</span>
      </div>
    );
  }

  // Online with fresh cache
  if (!cacheStatus?.isStale && cacheStatus?.hasCache) {
    return (
      <button
        onClick={onRefresh}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-full bg-status-ready/10 text-status-ready text-xs font-medium",
          "hover:bg-status-ready/20 transition-colors",
          className
        )}
      >
        <Check className="w-3.5 h-3.5" />
        <span>Sync: {formatLastSync(cacheStatus.lastSync)}</span>
      </button>
    );
  }

  // Online with stale or no cache
  return (
    <button
      onClick={onRefresh}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium",
        "hover:bg-muted/80 transition-colors",
        className
      )}
    >
      <Database className="w-3.5 h-3.5" />
      <span>{cacheStatus?.hasCache ? formatLastSync(cacheStatus.lastSync) : 'Carregar dados'}</span>
    </button>
  );
}
