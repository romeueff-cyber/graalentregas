import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MapPin, Loader2, WifiOff, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { enqueueVisit, type VisitAttempt } from '@/lib/visit-queue';
import { Badge } from '@/components/ui/badge';

const REASONS = [
  { value: 'cliente_ausente', label: 'Cliente ausente' },
  { value: 'equipamento_em_uso', label: 'Equipamento em uso' },
  { value: 'recusou_devolucao', label: 'Recusou devolução' },
  { value: 'endereco_nao_encontrado', label: 'Endereço não encontrado' },
  { value: 'outro', label: 'Outro motivo' },
];

interface VisitAttemptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VisitAttemptDialog({ open, onOpenChange }: VisitAttemptDialogProps) {
  const { user, profile } = useAuth();
  const [clientName, setClientName] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isOnline = navigator.onLine;

  // Capture GPS when dialog opens
  useEffect(() => {
    if (!open) return;
    captureGPS();
    // Reset form
    setClientName('');
    setOrderNumber('');
    setReason('');
    setNotes('');
  }, [open]);

  const captureGPS = async () => {
    setGpsLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        });
      });
      setGps({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    } catch {
      toast.error('Não foi possível capturar GPS. Verifique as permissões.');
      setGps(null);
    } finally {
      setGpsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id || !gps || !clientName.trim() || !reason) {
      toast.error('Preencha o cliente, motivo e aguarde o GPS.');
      return;
    }

    setSubmitting(true);
    const visit: VisitAttempt = {
      id: crypto.randomUUID(),
      userId: user.id,
      userName: profile?.name || user.email || 'Desconhecido',
      clientName: clientName.trim().toUpperCase(),
      orderNumber: orderNumber.trim() || undefined,
      reason,
      notes: notes.trim() || undefined,
      latitude: gps.lat,
      longitude: gps.lng,
      accuracy: gps.accuracy,
      capturedAt: new Date().toISOString(),
    };

    try {
      if (isOnline) {
        const { error } = await supabase.from('visit_attempts').insert({
          id: visit.id,
          user_id: visit.userId,
          user_name: visit.userName,
          client_name: visit.clientName,
          order_number: visit.orderNumber || null,
          reason: visit.reason,
          notes: visit.notes || null,
          latitude: visit.latitude,
          longitude: visit.longitude,
          accuracy: visit.accuracy,
          captured_at: visit.capturedAt,
        });
        if (error) throw error;
        toast.success('Visita registrada com sucesso!');
      } else {
        await enqueueVisit(visit);
        toast.info('Visita salva offline. Será sincronizada quando houver internet.');
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error('[VisitAttempt] Error:', err);
      // Fallback to offline queue
      await enqueueVisit(visit);
      toast.info('Erro ao enviar. Visita salva offline.');
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Registrar Visita
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* GPS Status */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50">
            {gpsLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Capturando localização...</span>
              </>
            ) : gps ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">
                  GPS: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                  {gps.accuracy && <span className="ml-1">(±{Math.round(gps.accuracy)}m)</span>}
                </span>
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 text-destructive" />
                <span className="text-sm text-destructive">GPS indisponível</span>
                <Button variant="ghost" size="sm" onClick={captureGPS}>Tentar novamente</Button>
              </>
            )}
            {!isOnline && (
              <Badge variant="outline" className="ml-auto text-xs">
                <WifiOff className="w-3 h-3 mr-1" />
                Offline
              </Badge>
            )}
          </div>

          {/* Client Name */}
          <div className="space-y-2">
            <Label htmlFor="visit-client">Nome do Cliente *</Label>
            <Input
              id="visit-client"
              placeholder="Ex: HOTEL VALE DAS PEDRAS"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>

          {/* Order Number */}
          <div className="space-y-2">
            <Label htmlFor="visit-order">Nº do Pedido (opcional)</Label>
            <Input
              id="visit-order"
              placeholder="Ex: 7103"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              inputMode="numeric"
            />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Motivo *</Label>
            <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
              {REASONS.map((r) => (
                <div key={r.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
                  <Label htmlFor={`reason-${r.value}`} className="cursor-pointer font-normal">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="visit-notes">Observações</Label>
            <Textarea
              id="visit-notes"
              placeholder="Detalhes adicionais..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !gps || !clientName.trim() || !reason}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <MapPin className="w-4 h-4 mr-2" />
            )}
            Registrar Visita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
