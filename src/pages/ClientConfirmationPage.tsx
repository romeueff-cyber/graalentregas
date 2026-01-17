import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Beer, CheckCircle2, Calendar, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/date-utils';

interface EquipmentData {
  nome_cliente: string;
  pedido_dia: string;
  data_entrega: string | null;
  already_confirmed: boolean;
  status: string;
}

const periodOptions = [
  { value: 'DIA_TODO', label: 'Dia Todo', description: 'Qualquer horário' },
  { value: 'MANHA', label: 'Manhã', description: '08:00 - 12:00' },
  { value: 'TARDE', label: 'Tarde', description: '12:00 - 18:00' },
  { value: 'NOITE', label: 'Noite', description: '18:00 - 22:00' },
];

export default function ClientConfirmationPage() {
  const { token } = useParams<{ token: string }>();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [equipment, setEquipment] = useState<EquipmentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('DIA_TODO');

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!token) {
      setError('Link inválido');
      setIsLoading(false);
      return;
    }

    fetchEquipmentData();
  }, [token]);

  const fetchEquipmentData = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-equipment-by-token', {
        body: null,
        headers: {},
      });

      // Use fetch directly since we need query params
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-equipment-by-token?token=${token}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Erro ao carregar dados');
        return;
      }

      setEquipment(result);
      
      if (result.already_confirmed) {
        setSuccess(true);
      }
    } catch (err) {
      console.error('Error fetching equipment:', err);
      setError('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate) {
      setError('Selecione uma data');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirm-by-client`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            data_prevista_recolha: selectedDate,
            periodo_recolha: selectedPeriod,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (result.already_confirmed) {
          setSuccess(true);
        } else {
          setError(result.error || 'Erro ao confirmar');
        }
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error('Error confirming:', err);
      setError('Erro ao confirmar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-white">
        <LoadingSpinner text="Carregando..." />
      </div>
    );
  }

  // Error state (invalid token)
  if (error && !equipment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-white p-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Link Inválido</h1>
        <p className="text-gray-600 text-center max-w-sm">
          Este link não é válido ou já expirou. Entre em contato com o entregador.
        </p>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white p-4">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-scale-in">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirmado!</h1>
        <p className="text-gray-600 text-center max-w-sm mb-4">
          A liberação foi confirmada com sucesso. O entregador será notificado.
        </p>
        {equipment && (
          <div className="bg-white rounded-xl p-4 shadow-md border">
            <p className="text-sm text-gray-600">Pedido: <span className="font-medium text-gray-900">{equipment.pedido_dia}</span></p>
            <p className="text-sm text-gray-600">Cliente: <span className="font-medium text-gray-900">{equipment.nome_cliente}</span></p>
          </div>
        )}
      </div>
    );
  }

  // Confirmation form
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-6 pb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Beer className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">Graal Beer</h1>
        </div>
        <p className="text-center text-amber-100">Confirmação de Liberação</p>
      </div>

      {/* Card */}
      <div className="px-4 -mt-6">
        <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md mx-auto">
          {/* Equipment info */}
          <div className="mb-6 pb-6 border-b">
            <h2 className="font-semibold text-gray-900 text-lg mb-3">Dados da Entrega</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Cliente:</span>
                <span className="font-medium text-gray-900">{equipment?.nome_cliente}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Pedido:</span>
                <span className="font-medium text-gray-900">{equipment?.pedido_dia}</span>
              </div>
              {equipment?.data_entrega && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Entregue em:</span>
                  <span className="font-medium text-gray-900">{formatDate(equipment.data_entrega)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date selection */}
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-2 text-gray-700">
                <Calendar className="w-4 h-4" />
                Data da Recolha
              </Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={today}
                required
                className="h-12"
              />
            </div>

            {/* Period selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-gray-700">
                <Clock className="w-4 h-4" />
                Melhor Horário
              </Label>
              <RadioGroup
                value={selectedPeriod}
                onValueChange={setSelectedPeriod}
                className="grid grid-cols-2 gap-3"
              >
                {periodOptions.map((option) => (
                  <div key={option.value}>
                    <RadioGroupItem
                      value={option.value}
                      id={option.value}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={option.value}
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-gray-200 p-3 cursor-pointer transition-all peer-data-[state=checked]:border-amber-500 peer-data-[state=checked]:bg-amber-50 hover:border-amber-300"
                    >
                      <span className="font-medium text-gray-900">{option.label}</span>
                      <span className="text-xs text-gray-500">{option.description}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit button */}
            <Button
              type="submit"
              disabled={isSubmitting || !selectedDate}
              className="w-full h-14 text-lg bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            >
              {isSubmitting ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Confirmar Liberação
                </>
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-gray-400 text-xs p-6">
        Graal Beer © {new Date().getFullYear()}
      </div>
    </div>
  );
}