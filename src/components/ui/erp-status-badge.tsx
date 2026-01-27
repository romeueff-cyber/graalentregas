import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ERPStatusBadgeProps {
  status: string | null;
  className?: string;
}

// Status colors based on ERP STATUS table
const getStatusConfig = (status: string | null): { className: string; label: string } => {
  if (!status) return { className: "bg-muted text-muted-foreground", label: "—" };
  
  const normalizedStatus = status.toUpperCase().trim();
  
  // Green - Positive/Complete statuses
  if (normalizedStatus.includes("ENTREGUE") && !normalizedStatus.includes("NÃO")) {
    return { className: "bg-green-100 text-green-800 border-green-300", label: status };
  }
  if (normalizedStatus.includes("CONCLUIDO") || normalizedStatus.includes("CONCLUÍDO")) {
    return { className: "bg-green-100 text-green-800 border-green-300", label: status };
  }
  if (normalizedStatus.includes("RETORNADO")) {
    return { className: "bg-green-100 text-green-800 border-green-300", label: status };
  }
  
  // Blue - In progress/Invoiced
  if (normalizedStatus.includes("FATURADO")) {
    return { className: "bg-blue-100 text-blue-800 border-blue-300", label: status };
  }
  if (normalizedStatus.includes("ALOCADO")) {
    return { className: "bg-blue-100 text-blue-800 border-blue-300", label: status };
  }
  
  // Orange - Waiting/Pending
  if (normalizedStatus.includes("A ENTREGAR")) {
    return { className: "bg-orange-100 text-orange-800 border-orange-300", label: status };
  }
  if (normalizedStatus.includes("EXPEDIÇÃO") || normalizedStatus.includes("EXPEDICAO")) {
    return { className: "bg-orange-100 text-orange-800 border-orange-300", label: status };
  }
  if (normalizedStatus.includes("SEPARADO")) {
    return { className: "bg-purple-100 text-purple-800 border-purple-300", label: status };
  }
  if (normalizedStatus.includes("SEPARAÇÃO") || normalizedStatus.includes("SEPARACAO")) {
    return { className: "bg-amber-100 text-amber-800 border-amber-300", label: status };
  }
  
  // Yellow - Liberado/Ready
  if (normalizedStatus.includes("LIBERADO")) {
    return { className: "bg-yellow-100 text-yellow-800 border-yellow-300", label: status };
  }
  if (normalizedStatus.includes("ANÁLISE") || normalizedStatus.includes("ANALISE")) {
    return { className: "bg-yellow-100 text-yellow-800 border-yellow-300", label: status };
  }
  
  // Red - Problems/Alerts
  if (normalizedStatus.includes("ATRASAD")) {
    return { className: "bg-red-100 text-red-800 border-red-300", label: status };
  }
  if (normalizedStatus.includes("RECUSAD")) {
    return { className: "bg-red-100 text-red-800 border-red-300", label: status };
  }
  if (normalizedStatus.includes("BLOQUEADO")) {
    return { className: "bg-red-100 text-red-800 border-red-300", label: status };
  }
  if (normalizedStatus.includes("PENDENTE")) {
    return { className: "bg-red-100 text-red-800 border-red-300", label: status };
  }
  
  // Gray - Cancelled/Inactive
  if (normalizedStatus.includes("CANCELADO")) {
    return { className: "bg-gray-100 text-gray-500 border-gray-300 line-through", label: status };
  }
  if (normalizedStatus.includes("DEVOLVIDO")) {
    return { className: "bg-gray-100 text-gray-600 border-gray-300", label: status };
  }
  
  // Default
  return { className: "bg-muted text-muted-foreground border-border", label: status };
};

export function ERPStatusBadge({ status, className }: ERPStatusBadgeProps) {
  const config = getStatusConfig(status);
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "text-[9px] px-1.5 py-0 h-4 font-medium whitespace-nowrap border",
        config.className,
        className
      )}
      title={status || undefined}
    >
      {config.label.length > 12 ? config.label.substring(0, 12) + "…" : config.label}
    </Badge>
  );
}
