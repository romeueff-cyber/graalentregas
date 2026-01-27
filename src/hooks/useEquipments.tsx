import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { equipmentStorage, settingsStorage, isOnline } from '@/lib/offline-storage';
import type { Equipment, EquipmentWithCreator, Settings } from '@/types/database';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export function useEquipments() {
  const { user } = useAuth();
  const [equipments, setEquipments] = useState<EquipmentWithCreator[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch equipments from server or local storage
  const fetchEquipments = useCallback(async () => {
    if (!user) return;

    try {
      if (isOnline()) {
        // Fetch from server (avoid PostgREST join that depends on FK constraints)
        const { data, error } = await supabase
          .from('equipments')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const creatorIds = Array.from(
          new Set((data || []).map((e: any) => e.created_by_user_id).filter(Boolean))
        );

        let profilesById = new Map<string, string>();
        if (creatorIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', creatorIds);

          if (profilesError) throw profilesError;

          profilesById = new Map(
            (profilesData || []).map((p: any) => [p.id as string, p.name as string])
          );
        }

        const equipmentsWithCreator: EquipmentWithCreator[] = (data || []).map((e: any) => ({
          ...e,
          creator_name: profilesById.get(e.created_by_user_id) || 'Desconhecido',
        }));

        setEquipments(equipmentsWithCreator);

        // Save raw equipments (without creator_name) to local storage for offline use
        await equipmentStorage.save((data || []) as Equipment[]);
      } else {
        // Load from local storage
        const localData = await equipmentStorage.getAll();
        setEquipments(localData);
      }
    } catch (error) {
      console.error('Error fetching equipments:', error);
      
      // Try to load from local storage on error
      const localData = await equipmentStorage.getAll();
      if (localData.length > 0) {
        setEquipments(localData);
        toast.info('Usando dados offline');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      if (isOnline()) {
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .single();

        if (error) throw error;
        
        setSettings(data as Settings);
        await settingsStorage.save(data as Settings);
      } else {
        const localSettings = await settingsStorage.get();
        if (localSettings) {
          setSettings(localSettings);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      const localSettings = await settingsStorage.get();
      if (localSettings) {
        setSettings(localSettings);
      }
    }
  }, []);

  // Sync pending equipments
  const syncPending = useCallback(async () => {
    if (!isOnline() || !user) return;

    setIsSyncing(true);
    try {
      const pending = await equipmentStorage.getPending();
      
      for (const equipment of pending) {
        const { error } = await supabase
          .from('equipments')
          .upsert(equipment);

        if (!error) {
          await equipmentStorage.removePending(equipment.id);
        }
      }

      if (pending.length > 0) {
        toast.success(`${pending.length} registro(s) sincronizado(s)`);
        await fetchEquipments();
      }
    } catch (error) {
      console.error('Error syncing:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [user, fetchEquipments]);

  // Create equipment
  const createEquipment = async (data: Omit<Equipment, 'id' | 'created_at' | 'updated_at' | 'data_entrega' | 'data_real_recolha' | 'sync_status' | 'created_by_user_id' | 'confirmation_token' | 'token_used_at'> & { status?: Equipment['status'] }) => {
    if (!user) throw new Error('Usuário não autenticado');

    // Default status is ENTREGUE, but can be overridden (e.g., for growler/barril orders)
    const initialStatus = data.status || 'ENTREGUE';
    const isCollected = initialStatus === 'RECOLHIDO';

    const newEquipment: Equipment = {
      id: crypto.randomUUID(),
      ...data,
      data_entrega: new Date().toISOString(),
      data_real_recolha: isCollected ? new Date().toISOString() : null,
      status: initialStatus,
      sync_status: isOnline() ? 'synced' : 'pending',
      created_by_user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      confirmation_token: crypto.randomUUID(),
      token_used_at: null,
    };

    try {
      if (isOnline()) {
        const { error } = await supabase
          .from('equipments')
          .insert(newEquipment);

        if (error) throw error;
        
        // Update ERP status to 19 (Entregue) - fire and forget, don't block the flow
        supabase.functions.invoke('update-erp-order-status', {
          body: { orderNumber: data.pedido_dia, status: 19 }
        }).then(({ error: erpError }) => {
          if (erpError) {
            console.warn('Failed to update ERP status:', erpError);
          } else {
            console.log('ERP status updated to 19 for order:', data.pedido_dia);
          }
        }).catch(err => {
          console.warn('ERP status update error:', err);
        });
        
        toast.success('Entrega registrada com sucesso!');
      } else {
        await equipmentStorage.addPending(newEquipment);
        await equipmentStorage.updateLocal(newEquipment);
        toast.info('Entrega salva offline. Será sincronizada quando houver internet.');
      }

      await fetchEquipments();
      return newEquipment;
    } catch (error: any) {
      console.error('Error creating equipment:', error);
      toast.error('Erro ao registrar entrega: ' + error.message);
      throw error;
    }
  };

  // Update equipment
  const updateEquipment = async (id: string, data: Partial<Equipment>) => {
    try {
      const syncStatus: 'synced' | 'pending' = isOnline() ? 'synced' : 'pending';
      const updatedData = {
        ...data,
        updated_at: new Date().toISOString(),
        sync_status: syncStatus
      };

      if (isOnline()) {
        const { error } = await supabase
          .from('equipments')
          .update(updatedData)
          .eq('id', id);

        if (error) throw error;
        toast.success('Registro atualizado!');
      } else {
        const equipments = await equipmentStorage.getAll();
        const equipment = equipments.find(e => e.id === id);
        if (equipment) {
          const updated = { ...equipment, ...updatedData } as Equipment;
          await equipmentStorage.updateLocal(updated);
          await equipmentStorage.addPending(updated);
        }
        toast.info('Atualização salva offline.');
      }

      await fetchEquipments();
    } catch (error: any) {
      console.error('Error updating equipment:', error);
      toast.error('Erro ao atualizar: ' + error.message);
      throw error;
    }
  };

  // Confirm collection using database function
  const confirmCollection = async (id: string) => {
    try {
      if (isOnline()) {
        const { data, error } = await supabase.rpc('confirm_collection', {
          _equipment_id: id
        });

        if (error) throw error;
        toast.success('Recolha confirmada!');
      } else {
        // Offline: queue update locally
        await updateEquipment(id, {
          status: 'RECOLHIDO',
          data_real_recolha: new Date().toISOString()
        });
        return;
      }

      await fetchEquipments();
    } catch (error: any) {
      console.error('Error confirming collection:', error);
      toast.error('Erro ao confirmar recolha: ' + error.message);
      throw error;
    }
  };

  // Delete equipment (admin only via edge function)
  const deleteEquipment = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-equipment', {
        body: { equipmentId: id }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Entrega excluída com sucesso!');
      await fetchEquipments();
    } catch (error: any) {
      console.error('Error deleting equipment:', error);
      toast.error('Erro ao excluir entrega: ' + error.message);
      throw error;
    }
  };

  // Filter visible equipments (collected items within visibility period)
  const getVisibleEquipments = useCallback(() => {
    const diasExibir = settings?.dias_exibir_recolhido || 7;
    const now = new Date();

    return equipments.filter(equipment => {
      if (equipment.status !== 'RECOLHIDO') {
        return true;
      }

      // Check if collected within visibility period
      if (equipment.data_real_recolha) {
        const collectedDate = new Date(equipment.data_real_recolha);
        const diffDays = Math.floor((now.getTime() - collectedDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= diasExibir;
      }

      return true;
    });
  }, [equipments, settings]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchEquipments();
      fetchSettings();
    }
  }, [user, fetchEquipments, fetchSettings]);

  // Listen for online status changes
  useEffect(() => {
    const handleOnline = () => {
      toast.success('Conexão restaurada');
      syncPending();
    };

    const handleOffline = () => {
      toast.warning('Sem conexão. Modo offline ativado.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPending]);

  return {
    equipments: getVisibleEquipments(),
    allEquipments: equipments,
    settings,
    isLoading,
    isSyncing,
    isOnline: isOnline(),
    fetchEquipments,
    createEquipment,
    updateEquipment,
    confirmCollection,
    deleteEquipment,
    syncPending
  };
}
