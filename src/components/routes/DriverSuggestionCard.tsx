import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Users, Package, Clock, Loader2 } from 'lucide-react';
import type { DriverSuggestion } from '@/types/routes';

interface DriverSuggestionCardProps {
  suggestion: DriverSuggestion;
  isLoading?: boolean;
}

export function DriverSuggestionCard({ suggestion, isLoading }: DriverSuggestionCardProps) {
  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              Analisando entregas com IA...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Sugestão da IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Entregadores recomendados:</span>
          <Badge variant="default" className="text-lg px-3 py-1">
            {suggestion.recommendedDriverCount}
          </Badge>
        </div>
        
        <p className="text-xs text-muted-foreground">
          {suggestion.reasoning}
        </p>

        {suggestion.driversNeeded.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            {suggestion.driversNeeded.map((driver, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Users className="w-3 h-3 text-muted-foreground" />
                  <span>Entregador {driver.driverIndex + 1}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {driver.estimatedStops}
                  </span>
                  <span>{driver.estimatedVolume}L</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {driver.estimatedEndTime}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
