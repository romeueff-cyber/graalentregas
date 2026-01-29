export type HygieneEquipmentType = 'chopeira' | 'kegotater';
export type HygieneServiceType = 'limpeza' | 'troca';

export interface HygieneClient {
  id: string;
  nome_cliente: string;
  telefone_cliente: string | null;
  endereco: string;
  latitude: number;
  longitude: number;
  intervalo_limpeza_dias: number;
  observacoes: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface HygieneEquipment {
  id: string;
  client_id: string;
  tipo_equipamento: HygieneEquipmentType;
  numero_serie: string;
  ultima_limpeza: string | null;
  proxima_limpeza: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface HygieneService {
  id: string;
  equipment_id: string;
  tipo_servico: HygieneServiceType;
  data_servico: string;
  foto_url: string | null;
  observacoes: string | null;
  motivo_troca: string | null;
  novo_numero_serie: string | null;
  executado_por_user_id: string;
  created_at: string;
}

export interface HygieneClientWithEquipments extends HygieneClient {
  equipments: HygieneEquipmentWithServices[];
}

export interface HygieneEquipmentWithServices extends HygieneEquipment {
  services?: HygieneService[];
  client?: HygieneClient;
}

// For map display
export interface HygieneMapLocation {
  id: string;
  clientId: string;
  clientName: string;
  lat: number;
  lng: number;
  equipmentCount: number;
  nextCleaningDate: string | null;
  daysUntilCleaning: number | null;
  urgencyLevel: 'green' | 'yellow' | 'orange' | 'red';
}

// Calculate days until next cleaning
export function getDaysUntilNextCleaning(proximaLimpeza: string | null): number | null {
  if (!proximaLimpeza) return null;
  const nextDate = new Date(proximaLimpeza);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  nextDate.setHours(0, 0, 0, 0);
  const diffTime = nextDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Calculate urgency level based on days until cleaning
export function getUrgencyLevel(daysUntil: number | null): 'green' | 'yellow' | 'orange' | 'red' {
  if (daysUntil === null) return 'green';
  if (daysUntil <= 2) return 'red';
  if (daysUntil <= 7) return 'orange';
  if (daysUntil <= 15) return 'yellow';
  return 'green';
}

export function getUrgencyColor(level: 'green' | 'yellow' | 'orange' | 'red'): string {
  switch (level) {
    case 'red': return 'hsl(0 72% 51%)';
    case 'orange': return 'hsl(25 95% 53%)';
    case 'yellow': return 'hsl(48 96% 53%)';
    case 'green': return 'hsl(142 71% 45%)';
  }
}

export const equipmentTypeLabels: Record<HygieneEquipmentType, string> = {
  chopeira: 'Chopeira',
  kegotater: 'Kegotater',
};

export const serviceTypeLabels: Record<HygieneServiceType, string> = {
  limpeza: 'Limpeza',
  troca: 'Troca',
};
