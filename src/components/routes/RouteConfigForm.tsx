import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Users, MapPin, Clock, Play, Loader2, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RouteConfig } from '@/types/routes';

// Graal Beer default location (can be changed)
const DEFAULT_START = {
  lat: -23.5505,
  lng: -46.6333,
  address: 'Cervejaria Graal Beer',
};

interface RouteConfigFormProps {
  deliveryCount: number;
  onOptimize: (config: RouteConfig, date: string) => void;
  isOptimizing: boolean;
  progress: number;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

export function RouteConfigForm({ 
  deliveryCount, 
  onOptimize, 
  isOptimizing,
  progress,
  selectedDate,
  onDateChange,
}: RouteConfigFormProps) {
  const [driverCount, setDriverCount] = useState(2);
  const [serviceTime, setServiceTime] = useState(30);
  const [workStartTime, setWorkStartTime] = useState('08:00');
  const [workEndTime, setWorkEndTime] = useState('18:00');
  const [startAddress, setStartAddress] = useState(DEFAULT_START.address);
  const [startLocation, setStartLocation] = useState({ lat: DEFAULT_START.lat, lng: DEFAULT_START.lng });

  const handleOptimize = () => {
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    onOptimize({
      driverCount,
      startLocation,
      startAddress,
      serviceTimeMinutes: serviceTime,
      workStartTime,
      workEndTime,
    }, dateString);
  };

  // Calculate estimated orders per driver
  const ordersPerDriver = Math.ceil(deliveryCount / driverCount);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5" />
          Configuração das Rotas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4" />
            Data das Entregas
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR }) : "Selecione a data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && onDateChange(date)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Driver Count */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Número de Entregadores</Label>
            <span className="text-2xl font-bold text-primary">{driverCount}</span>
          </div>
          <Slider
            value={[driverCount]}
            onValueChange={([value]) => setDriverCount(value)}
            min={1}
            max={8}
            step={1}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            ~{ordersPerDriver} entregas por entregador
          </p>
        </div>

        {/* Service Time */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Tempo por Entrega</Label>
            <span className="text-lg font-semibold">{serviceTime} min</span>
          </div>
          <Slider
            value={[serviceTime]}
            onValueChange={([value]) => setServiceTime(value)}
            min={10}
            max={60}
            step={5}
            className="w-full"
          />
        </div>

        {/* Work Hours */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Início
            </Label>
            <Input
              type="time"
              value={workStartTime}
              onChange={(e) => setWorkStartTime(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Fim</Label>
            <Input
              type="time"
              value={workEndTime}
              onChange={(e) => setWorkEndTime(e.target.value)}
            />
          </div>
        </div>

        {/* Start Location */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <MapPin className="w-4 h-4" />
            Ponto de Partida
          </Label>
          <Input
            value={startAddress}
            onChange={(e) => setStartAddress(e.target.value)}
            placeholder="Endereço de saída"
          />
          <p className="text-xs text-muted-foreground">
            Todas as rotas iniciam deste ponto
          </p>
        </div>

        {/* Summary */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total de entregas:</span>
            <span className="font-medium">{deliveryCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Entregadores:</span>
            <span className="font-medium">{driverCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tempo estimado de trabalho:</span>
            <span className="font-medium">{workStartTime} - {workEndTime}</span>
          </div>
        </div>

        {/* Optimize Button */}
        <Button 
          className="w-full" 
          size="lg"
          onClick={handleOptimize}
          disabled={isOptimizing || deliveryCount === 0}
        >
          {isOptimizing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Otimizando... {progress}%
            </>
          ) : (
            <>
              <Play className="w-5 h-5 mr-2" />
              Gerar Rotas Otimizadas
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
