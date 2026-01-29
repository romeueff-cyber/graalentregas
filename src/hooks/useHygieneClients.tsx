import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { 
  HygieneClient, 
  HygieneEquipment, 
  HygieneService, 
  HygieneClientWithEquipments,
  HygieneMapLocation,
  HygieneEquipmentType,
  HygieneServiceType
} from '@/types/hygiene';
import { getUrgencyLevel } from '@/types/hygiene';
import { differenceInDays, parseISO } from 'date-fns';

export function useHygieneClients() {
  const [clients, setClients] = useState<HygieneClientWithEquipments[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchClients = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('hygiene_clients')
        .select('*')
        .order('nome_cliente');

      if (clientsError) throw clientsError;

      // Fetch all equipment
      const { data: equipmentData, error: equipmentError } = await supabase
        .from('hygiene_equipment')
        .select('*')
        .eq('ativo', true);

      if (equipmentError) throw equipmentError;

      // Combine clients with their equipment
      const clientsWithEquipments: HygieneClientWithEquipments[] = (clientsData || []).map(client => ({
        ...client,
        equipments: (equipmentData || []).filter(eq => eq.client_id === client.id),
      }));

      setClients(clientsWithEquipments);
    } catch (error) {
      console.error('Error fetching hygiene clients:', error);
      toast({
        title: 'Erro ao carregar clientes',
        description: 'Não foi possível carregar a lista de clientes.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Create a new client
  const createClient = async (clientData: Omit<HygieneClient, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('hygiene_clients')
        .insert(clientData)
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Cliente cadastrado com sucesso!' });
      await fetchClients();
      return data;
    } catch (error) {
      console.error('Error creating client:', error);
      toast({
        title: 'Erro ao cadastrar cliente',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Update a client
  const updateClient = async (id: string, updates: Partial<HygieneClient>) => {
    try {
      const { error } = await supabase
        .from('hygiene_clients')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Cliente atualizado!' });
      await fetchClients();
    } catch (error) {
      console.error('Error updating client:', error);
      toast({
        title: 'Erro ao atualizar cliente',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Delete a client
  const deleteClient = async (id: string) => {
    try {
      const { error } = await supabase
        .from('hygiene_clients')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Cliente removido!' });
      await fetchClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast({
        title: 'Erro ao remover cliente',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Add equipment to a client
  const addEquipment = async (equipment: Omit<HygieneEquipment, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('hygiene_equipment')
        .insert(equipment)
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Equipamento adicionado!' });
      await fetchClients();
      return data;
    } catch (error) {
      console.error('Error adding equipment:', error);
      toast({
        title: 'Erro ao adicionar equipamento',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Update equipment
  const updateEquipment = async (id: string, updates: Partial<HygieneEquipment>) => {
    try {
      const { error } = await supabase
        .from('hygiene_equipment')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Equipamento atualizado!' });
      await fetchClients();
    } catch (error) {
      console.error('Error updating equipment:', error);
      toast({
        title: 'Erro ao atualizar equipamento',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Delete (deactivate) equipment
  const deleteEquipment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('hygiene_equipment')
        .update({ ativo: false })
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Equipamento removido!' });
      await fetchClients();
    } catch (error) {
      console.error('Error deleting equipment:', error);
      toast({
        title: 'Erro ao remover equipamento',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Register a service (cleaning or replacement)
  const registerService = async (serviceData: Omit<HygieneService, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('hygiene_services')
        .insert(serviceData)
        .select()
        .single();

      if (error) throw error;

      const serviceLabel = serviceData.tipo_servico === 'limpeza' ? 'Limpeza' : 'Troca';
      toast({ title: `${serviceLabel} registrada com sucesso!` });
      await fetchClients();
      return data;
    } catch (error) {
      console.error('Error registering service:', error);
      toast({
        title: 'Erro ao registrar serviço',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Get service history for an equipment
  const getServiceHistory = async (equipmentId: string): Promise<HygieneService[]> => {
    try {
      const { data, error } = await supabase
        .from('hygiene_services')
        .select('*')
        .eq('equipment_id', equipmentId)
        .order('data_servico', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching service history:', error);
      return [];
    }
  };

  // Calculate map locations with urgency levels
  const mapLocations = useMemo((): HygieneMapLocation[] => {
    const today = new Date();
    
    return clients.map(client => {
      // Find the nearest cleaning date among all equipment
      let nearestCleaningDate: string | null = null;
      let minDaysUntil: number | null = null;

      client.equipments.forEach(eq => {
        if (eq.proxima_limpeza) {
          const nextDate = parseISO(eq.proxima_limpeza);
          const daysUntil = differenceInDays(nextDate, today);
          
          if (minDaysUntil === null || daysUntil < minDaysUntil) {
            minDaysUntil = daysUntil;
            nearestCleaningDate = eq.proxima_limpeza;
          }
        }
      });

      return {
        id: client.id,
        clientId: client.id,
        clientName: client.nome_cliente,
        lat: client.latitude,
        lng: client.longitude,
        equipmentCount: client.equipments.length,
        nextCleaningDate: nearestCleaningDate,
        daysUntilCleaning: minDaysUntil,
        urgencyLevel: getUrgencyLevel(minDaysUntil),
      };
    });
  }, [clients]);

  // Summary counts for header
  const summary = useMemo(() => {
    const today = new Date();
    let next7Days = 0;
    let overdue = 0;

    clients.forEach(client => {
      client.equipments.forEach(eq => {
        if (eq.proxima_limpeza) {
          const nextDate = parseISO(eq.proxima_limpeza);
          const daysUntil = differenceInDays(nextDate, today);
          
          if (daysUntil < 0) {
            overdue++;
          } else if (daysUntil <= 7) {
            next7Days++;
          }
        }
      });
    });

    return { next7Days, overdue, totalClients: clients.length };
  }, [clients]);

  return {
    clients,
    isLoading,
    mapLocations,
    summary,
    fetchClients,
    createClient,
    updateClient,
    deleteClient,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    registerService,
    getServiceHistory,
  };
}
