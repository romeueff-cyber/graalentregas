export type AppRole = 'admin' | 'entregador';

export type EquipmentStatus = 'ENTREGUE' | 'LIBERADO_PARA_RECOLHA' | 'RECOLHIDO';

export type CollectionPeriod = 'MANHA' | 'TARDE' | 'NOITE';

export type SyncStatus = 'synced' | 'pending';

export interface Profile {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Equipment {
  id: string;
  nome_cliente: string;
  pedido_dia: string;
  periodo_recolha: CollectionPeriod;
  observacoes: string | null;
  foto_local_path: string | null;
  foto_url: string | null;
  latitude: number;
  longitude: number;
  data_entrega: string;
  data_prevista_recolha: string;
  data_real_recolha: string | null;
  status: EquipmentStatus;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface Settings {
  id: string;
  dias_exibir_recolhido: number;
  updated_at: string;
}

export interface EquipmentWithCreator extends Equipment {
  creator_name?: string;
}
