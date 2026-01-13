import { cn } from "@/lib/utils";
import { Sun, Sunset, Moon } from "lucide-react";
import type { CollectionPeriod } from "@/types/database";

interface PeriodBadgeProps {
  period: CollectionPeriod;
  className?: string;
}

const periodConfig = {
  MANHA: {
    label: 'Manhã',
    icon: Sun,
    className: 'bg-amber-100 text-amber-800'
  },
  TARDE: {
    label: 'Tarde',
    icon: Sunset,
    className: 'bg-orange-100 text-orange-800'
  },
  NOITE: {
    label: 'Noite',
    icon: Moon,
    className: 'bg-indigo-100 text-indigo-800'
  }
};

export function PeriodBadge({ period, className }: PeriodBadgeProps) {
  const config = periodConfig[period];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        config.className,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
