import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEquipments } from '@/hooks/useEquipments';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { PeriodBadge } from '@/components/ui/period-badge';
import { LoadingSpinner, FullPageLoader } from '@/components/ui/loading-spinner';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  User, 
  Package, 
  Navigation,
  CheckCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { allEquipments, confirmCollection, isLoading } = useEquipments();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const equipment = allEquipments.find(e => e.id === id);

  const handleConfirmCollection = async () => {
    if (!equipment) return;
    
    setIsConfirming(true);
    try {
      await confirmCollection(equipment.id);
      setShowConfirmDialog(false);
    } finally {
      setIsConfirming(false);
    }
  };

  const openRoute = () => {
    if (!equipment) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${equipment.latitude},${equipment.longitude}`;
    window.open(url, '_blank');
  };

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!equipment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground mb-4">Equipamento não encontrado</p>
        <Button onClick={() => navigate('/')}>Voltar</Button>
      </div>
    );
  }

  const formatDate = (date: string) => {
    return format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  const formatDateTime = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  return (
    <div className="min-h-screen bg-background pb-safe-area-bottom">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b px-4 py-3 safe-area-top">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{equipment.nome_cliente}</h1>
            <StatusBadge status={equipment.status} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Info Cards */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" />
              Informações do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Nome</p>
              <p className="font-medium">{equipment.nome_cliente}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pedido do Dia</p>
              <p className="font-medium">{equipment.pedido_dia}</p>
            </div>
            {equipment.observacoes && (
              <div>
                <p className="text-sm text-muted-foreground">Observações</p>
                <p className="font-medium">{equipment.observacoes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" />
              Recolha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Data Prevista</p>
                <p className="font-medium">{formatDate(equipment.data_prevista_recolha)}</p>
              </div>
              <PeriodBadge period={equipment.periodo_recolha} />
            </div>
            {equipment.data_real_recolha && (
              <div>
                <p className="text-sm text-muted-foreground">Data Real da Recolha</p>
                <p className="font-medium text-status-ready">
                  {formatDateTime(equipment.data_real_recolha)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Histórico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Entregador</p>
              <p className="font-medium">{equipment.creator_name || 'Desconhecido'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data da Entrega</p>
              <p className="font-medium">{formatDateTime(equipment.data_entrega)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Photo */}
        {equipment.foto_local_path && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Foto do Local</CardTitle>
            </CardHeader>
            <CardContent>
              <img
                src={equipment.foto_local_path}
                alt="Foto do local"
                className="w-full rounded-lg"
              />
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <Button
            className="w-full h-14 gap-2"
            variant="outline"
            onClick={openRoute}
          >
            <Navigation className="w-5 h-5" />
            Obter Rota
            <ExternalLink className="w-4 h-4" />
          </Button>

          {equipment.status !== 'RECOLHIDO' && (
            <Button
              className="w-full h-14 gap-2 bg-status-ready hover:bg-status-ready/90"
              onClick={() => setShowConfirmDialog(true)}
            >
              <CheckCircle className="w-5 h-5" />
              Confirmar Recolha
            </Button>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Recolha</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja confirmar a recolha do equipamento de {equipment.nome_cliente}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCollection}
              disabled={isConfirming}
              className="bg-status-ready hover:bg-status-ready/90"
            >
              {isConfirming ? <LoadingSpinner size="sm" /> : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
