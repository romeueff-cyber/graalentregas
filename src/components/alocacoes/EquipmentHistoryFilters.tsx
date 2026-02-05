import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Search, Filter, X } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface EquipmentHistoryFiltersProps {
  startDate: Date;
  endDate: Date;
  patrimony: string;
  clientName: string;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
  onPatrimonyChange: (value: string) => void;
  onClientNameChange: (value: string) => void;
  onClearFilters: () => void;
}

export function EquipmentHistoryFilters({
  startDate,
  endDate,
  patrimony,
  clientName,
  onStartDateChange,
  onEndDateChange,
  onPatrimonyChange,
  onClientNameChange,
  onClearFilters,
}: EquipmentHistoryFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilters = patrimony.trim() || clientName.trim();

  return (
    <div className="space-y-3">
      {/* Quick date filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onStartDateChange(subDays(new Date(), 7));
            onEndDateChange(new Date());
          }}
          className={cn(
            'text-xs',
            startDate.toDateString() === subDays(new Date(), 7).toDateString() &&
              'bg-primary text-primary-foreground'
          )}
        >
          7 dias
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onStartDateChange(subDays(new Date(), 30));
            onEndDateChange(new Date());
          }}
          className="text-xs"
        >
          30 dias
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onStartDateChange(subDays(new Date(), 90));
            onEndDateChange(new Date());
          }}
          className="text-xs"
        >
          90 dias
        </Button>
      </div>

      {/* Date range pickers */}
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1 justify-start text-xs">
              <CalendarIcon className="w-3 h-3 mr-1" />
              {format(startDate, 'dd/MM/yy', { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={(date) => date && onStartDateChange(date)}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        <span className="self-center text-muted-foreground text-xs">até</span>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1 justify-start text-xs">
              <CalendarIcon className="w-3 h-3 mr-1" />
              {format(endDate, 'dd/MM/yy', { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={(date) => date && onEndDateChange(date)}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Toggle additional filters */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowFilters(!showFilters)}
        className="w-full justify-between text-xs"
      >
        <span className="flex items-center gap-1">
          <Filter className="w-3 h-3" />
          Filtros avançados
        </span>
        {hasActiveFilters && (
          <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded">
            Ativos
          </span>
        )}
      </Button>

      {/* Advanced filters */}
      {showFilters && (
        <div className="space-y-3 p-3 rounded-lg bg-muted/50 border">
          <div className="space-y-1.5">
            <Label className="text-xs">Patrimônio</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por patrimônio..."
                value={patrimony}
                onChange={(e) => onPatrimonyChange(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Cliente</Label>
            <Input
              placeholder="Buscar por cliente..."
              value={clientName}
              onChange={(e) => onClientNameChange(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="w-full text-xs gap-1"
            >
              <X className="w-3 h-3" />
              Limpar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
