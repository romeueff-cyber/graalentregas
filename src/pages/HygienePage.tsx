import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useHygieneClients } from '@/hooks/useHygieneClients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FullPageLoader } from '@/components/ui/loading-spinner';
import { HygieneClientCard } from '@/components/hygiene/HygieneClientCard';
import { HygieneClientDialog } from '@/components/hygiene/HygieneClientDialog';
import { HygieneServiceDialog } from '@/components/hygiene/HygieneServiceDialog';
import { SprayCanIcon } from '@/components/icons';
import {
  Plus,
  ArrowLeft,
  Search,
  AlertTriangle,
  CalendarClock,
  Users,
} from 'lucide-react';
import type { HygieneClientWithEquipments, HygieneEquipmentWithServices } from '@/types/hygiene';

export default function HygienePage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { 
    clients, 
    isLoading, 
    summary,
    createClient,
    updateClient,
    deleteClient,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    registerService,
    getServiceHistory,
  } = useHygieneClients();

  const [searchQuery, setSearchQuery] = useState('');
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<HygieneClientWithEquipments | null>(null);
  const [serviceDialogData, setServiceDialogData] = useState<{
    open: boolean;
    equipment: HygieneEquipmentWithServices | null;
    clientName: string;
  }>({ open: false, equipment: null, clientName: '' });

  if (authLoading || isLoading) {
    return <FullPageLoader />;
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  const filteredClients = clients.filter(client =>
    client.nome_cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.endereco.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddClient = () => {
    setEditingClient(null);
    setShowClientDialog(true);
  };

  const handleEditClient = (client: HygieneClientWithEquipments) => {
    setEditingClient(client);
    setShowClientDialog(true);
  };

  const handleRegisterService = (equipment: HygieneEquipmentWithServices, clientName: string) => {
    setServiceDialogData({ open: true, equipment, clientName });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="glass border-b px-4 py-3 safe-area-top sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <SprayCanIcon className="w-5 h-5 text-primary" />
            <h1 className="font-semibold text-foreground">Agenda de Higienização</h1>
          </div>
        </div>

        {/* Summary */}
        <div className="flex gap-2 mt-3 text-xs overflow-x-auto pb-1">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary whitespace-nowrap">
            <Users className="w-3.5 h-3.5" />
            <span className="font-medium">{summary.totalClients} clientes</span>
          </div>
          {summary.next7Days > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-status-waiting/10 border border-status-waiting/20 text-status-waiting whitespace-nowrap">
              <CalendarClock className="w-3.5 h-3.5" />
              <span className="font-medium">{summary.next7Days} nos próximos 7 dias</span>
            </div>
          )}
          {summary.overdue > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive whitespace-nowrap">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="font-medium">{summary.overdue} atrasadas</span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente ou endereço..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Client List */}
      <div className="p-4 space-y-3 pb-24">
        {filteredClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <SprayCanIcon className="w-12 h-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            </p>
            {!searchQuery && (
              <Button onClick={handleAddClient}>
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar Cliente
              </Button>
            )}
          </div>
        ) : (
          filteredClients.map((client) => (
            <HygieneClientCard
              key={client.id}
              client={client}
              onEdit={handleEditClient}
              onDelete={deleteClient}
              onAddEquipment={addEquipment}
              onEditEquipment={updateEquipment}
              onDeleteEquipment={deleteEquipment}
              onRegisterService={handleRegisterService}
              getServiceHistory={getServiceHistory}
            />
          ))
        )}
      </div>

      {/* FAB - Add Client */}
      <Button
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-xl bg-gradient-primary hover:opacity-90"
        onClick={handleAddClient}
      >
        <Plus className="w-6 h-6" />
      </Button>

      {/* Client Dialog */}
      <HygieneClientDialog
        open={showClientDialog}
        onOpenChange={setShowClientDialog}
        client={editingClient}
        onSave={async (data) => {
          if (editingClient) {
            await updateClient(editingClient.id, data);
          } else {
            await createClient(data as any);
          }
          setShowClientDialog(false);
        }}
      />

      {/* Service Registration Dialog */}
      <HygieneServiceDialog
        open={serviceDialogData.open}
        onOpenChange={(open) => setServiceDialogData(prev => ({ ...prev, open }))}
        equipment={serviceDialogData.equipment}
        clientName={serviceDialogData.clientName}
        onSave={async (data) => {
          await registerService(data as any);
          setServiceDialogData({ open: false, equipment: null, clientName: '' });
        }}
      />
    </div>
  );
}
