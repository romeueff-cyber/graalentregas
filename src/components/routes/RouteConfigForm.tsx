import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Users, MapPin, Clock, Play, Loader2, CalendarIcon, Sun, Moon, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RouteConfig, RoutePeriod } from '@/types/routes';

// Graal Beer default location - Jaraguá do Sul
const DEFAULT_START = {
  lat: -26.4853,
  lng: -49.0686,
  address: 'Rua Pedro Francisco Freiberger, 56 - Três Rios do Sul, Jaraguá do Sul - SC',
};

interface RouteConfigFormProps {
  deliveryCount: number;
  onOptimize: (config: RouteConfig, date: string) => void;
  isOptimizing: boolean;
  progress: number;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  suggestedDriverCount?: number;
}

export function RouteConfigForm({ 
  deliveryCount, 
  onOptimize, 
  isOptimizing,
  progress,
  selectedDate,
  onDateChange,
  suggestedDriverCount,
}: RouteConfigFormProps) {
  const [driverCount, setDriverCount] = useState(suggestedDriverCount || 2);
  const [serviceTime, setServiceTime] = useState(30);
  const [workStartTime, setWorkStartTime] = useState('08:00');
  const [workEndTime, setWorkEndTime] = useState('12:00');
  const [startAddress, setStartAddress] = useState(DEFAULT_START.address);
  const [startLocation, setStartLocation] = useState({ lat: DEFAULT_START.lat, lng: DEFAULT_START.lng });
  const [period, setPeriod] = useState<RoutePeriod>('manha');
  const [isGeocodingStart, setIsGeocodingStart] = useState(false);

  // Update driver count when AI suggestion changes
  useEffect(() => {
    if (suggestedDriverCount && suggestedDriverCount !== driverCount) {
      setDriverCount(suggestedDriverCount);
    }
  }, [suggestedDriverCount]);

  // Update work hours based on period
  useEffect(() => {
    if (period === 'manha') {
      setWorkStartTime('08:00');
      setWorkEndTime('12:00');
    } else {
      setWorkStartTime('13:00');
      setWorkEndTime('18:00');
    }
  }, [period]);

  // Geocode start address when it changes
  const geocodeStartAddress = async () => {
    if (!startAddress || typeof google === 'undefined' || !google.maps?.Geocoder) return;
    
    setIsGeocodingStart(true);
    try {
      const geocoder = new google.maps.Geocoder();
      const result = await new Promise<google.maps.GeocoderResult[] | null>((resolve) => {
        geocoder.geocode({ address: startAddress + ', Brasil' }, (results, status) => {
          if (status === 'OK' && results) {
            resolve(results);
          } else {
            resolve(null);
          }
        });
      });

      if (result && result[0]) {
        const location = result[0].geometry.location;
        setStartLocation({ lat: location.lat(), lng: location.lng() });
        console.log('Start location geocoded:', location.lat(), location.lng());
      }
    } catch (err) {
      console.error('Error geocoding start address:', err);
    } finally {
      setIsGeocodingStart(false);
    }
  };

  // Geocode on mount if using default address
  useEffect(() => {
    if (startAddress === DEFAULT_START.address) {
      geocodeStartAddress();
    }
  }, []);

  const handleOptimize = () => {
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    onOptimize({
      driverCount,
      startLocation,
      startAddress,
      serviceTimeMinutes: serviceTime,
      workStartTime,
      workEndTime,
      period,
      vehicleCapacityLiters: 400,
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

        {/* Period Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Período das Rotas</Label>
          <RadioGroup
            value={period}
            onValueChange={(value) => setPeriod(value as RoutePeriod)}
            className="grid grid-cols-2 gap-3"
          >
            <div>
              <RadioGroupItem
                value="manha"
                id="manha"
                className="peer sr-only"
              />
              <Label
                htmlFor="manha"
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all",
                  period === 'manha' 
                    ? "border-primary bg-primary/5" 
                    : "border-muted hover:border-muted-foreground/30"
                )}
              >
                <Sun className="w-6 h-6 mb-2 text-amber-500" />
                <span className="font-medium">Manhã</span>
                <span className="text-xs text-muted-foreground">08:00 - 12:00</span>
              </Label>
            </div>
            <div>
              <RadioGroupItem
                value="tarde_noite"
                id="tarde_noite"
                className="peer sr-only"
              />
              <Label
                htmlFor="tarde_noite"
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all",
                  period === 'tarde_noite' 
                    ? "border-primary bg-primary/5" 
                    : "border-muted hover:border-muted-foreground/30"
                )}
              >
                <Moon className="w-6 h-6 mb-2 text-indigo-500" />
                <span className="font-medium">Tarde/Noite</span>
                <span className="text-xs text-muted-foreground">13:00 - 18:00</span>
              </Label>
            </div>
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            Entregas sem horário fixo serão incluídas na tarde se selecionado manhã
          </p>
        </div>
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
