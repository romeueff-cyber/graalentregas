import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  className,
  variant = 'default',
}: KPICardProps) {
  const variantStyles = {
    default: 'border-border',
    success: 'border-status-collected/30 bg-status-collected/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
    danger: 'border-destructive/30 bg-destructive/5',
  };

  return (
    <Card className={cn('relative overflow-hidden', variantStyles[variant], className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && trendValue && (
              <div className={cn(
                'flex items-center gap-1 text-xs font-medium',
                trend === 'up' && 'text-status-collected',
                trend === 'down' && 'text-destructive',
                trend === 'neutral' && 'text-muted-foreground'
              )}>
                {trend === 'up' && '↑'}
                {trend === 'down' && '↓'}
                {trendValue}
              </div>
            )}
          </div>
          <div className={cn(
            'p-2 rounded-lg',
            variant === 'default' && 'bg-primary/10 text-primary',
            variant === 'success' && 'bg-status-collected/10 text-status-collected',
            variant === 'warning' && 'bg-amber-500/10 text-amber-600',
            variant === 'danger' && 'bg-destructive/10 text-destructive',
          )}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
