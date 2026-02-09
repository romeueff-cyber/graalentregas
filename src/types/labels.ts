export type LabelTemplateType = 'lote_validade' | 'lote_validade_2' | 'patrimonio';

export interface LabelElement {
  id: string;
  type: 'text' | 'date' | 'qrcode' | 'barcode' | 'logo' | 'line';
  label: string;
  x: number; // percentage position
  y: number; // percentage position
  width: number; // percentage
  height: number; // percentage
  fontSize?: number; // pt
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  rotation?: number; // degrees
  content?: string; // static text or placeholder like {{lote}}, {{validade}}, {{patrimonio}}
  format?: string; // date format
}

export interface LabelTemplate {
  id: string;
  name: string;
  type: LabelTemplateType;
  width_mm: number;
  height_mm: number;
  columns: number;
  gap_horizontal_mm: number;
  gap_vertical_mm: number;
  elements: LabelElement[];
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface PrintData {
  [key: string]: string;
}

export const ELEMENT_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'date', label: 'Data' },
  { value: 'qrcode', label: 'QR Code' },
  { value: 'barcode', label: 'Código de Barras' },
  { value: 'logo', label: 'Logo' },
  { value: 'line', label: 'Linha' },
] as const;

export const TEMPLATE_TYPES = [
  { value: 'lote_validade', label: 'Lote - Validade (Modelo 1)' },
  { value: 'lote_validade_2', label: 'Lote - Validade (Modelo 2)' },
  { value: 'patrimonio', label: 'Patrimônio' },
] as const;

export const PLACEHOLDERS: Record<LabelTemplateType, { value: string; label: string }[]> = {
  lote_validade: [
    { value: '{{lote}}', label: 'Número do Lote' },
    { value: '{{fabricacao}}', label: 'Data de Fabricação' },
    { value: '{{validade}}', label: 'Data de Validade' },
  ],
  lote_validade_2: [
    { value: '{{lote}}', label: 'Número do Lote' },
    { value: '{{fabricacao}}', label: 'Data de Fabricação' },
    { value: '{{validade}}', label: 'Data de Validade' },
  ],
  patrimonio: [
    { value: '{{patrimonio}}', label: 'Número do Patrimônio' },
    { value: '{{tipo}}', label: 'Tipo de Equipamento' },
    { value: '{{volume}}', label: 'Volume' },
  ],
};
