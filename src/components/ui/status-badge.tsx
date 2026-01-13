import { cn } from "@/lib/utils";
import type { EquipmentStatus } from "@/types/database";

interface StatusBadgeProps {
  status: EquipmentStatus;
  className?: string;
}

const statusConfig = {
  ENTREGUE: {
    label: 'Entregue',
    className: 'bg-destructive text-destructive-foreground'
  },
  LIBERADO_PARA_RECOLHA: {
    label: 'Liberado',
    className: 'bg-status-ready text-primary-foreground'
  },
  RECOLHIDO: {
    label: 'Recolhido',
    className: 'bg-status-collected text-primary-foreground'
  }
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
