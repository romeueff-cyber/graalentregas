export type HygieneEquipmentType = 'chopeira' | 'geladeira' | 'balcao';

export type ChoperiaModelo = '30L_1VIA' | '50L_1VIA' | '50L_2VIAS' | '90L_1VIA' | '90L_2VIAS' | '90L_3VIAS';
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
  modelo_chopeira: string | null;
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
  geladeira: 'Geladeira',
  balcao: 'Balcão',
};

export const choperaModeloLabels: Record<ChoperiaModelo, string> = {
  '30L_1VIA': '30L/h - 1 via',
  '50L_1VIA': '50L/h - 1 via',
  '50L_2VIAS': '50L/h - 2 vias',
  '90L_1VIA': '90L/h - 1 via',
  '90L_2VIAS': '90L/h - 2 vias',
  '90L_3VIAS': '90L/h - 3 vias',
};

export const serviceTypeLabels: Record<HygieneServiceType, string> = {
  limpeza: 'Limpeza',
  troca: 'Troca',
};
