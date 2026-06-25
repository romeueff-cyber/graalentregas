// Constantes das empresas do ERP (multi-tenant interno)
export const EMPRESAS = {
  GRAAL: 1,
  GROTT: 3,
} as const;

export type EmpresaId = 1 | 3;

export const EMPRESA_OPTIONS: { id: EmpresaId; nome: string; abrev: string; color: string }[] = [
  { id: 1, nome: 'Graal Beer',  abrev: 'GRAAL', color: 'hsl(38 92% 50%)' },  // âmbar
  { id: 3, nome: 'Grott Beer',  abrev: 'GROTT', color: 'hsl(160 84% 39%)' }, // verde
];

export function getEmpresaLabel(id?: number | null): string {
  return EMPRESA_OPTIONS.find(e => e.id === id)?.nome ?? `Empresa ${id ?? '?'}`;
}

export function getEmpresaAbrev(id?: number | null): string {
  return EMPRESA_OPTIONS.find(e => e.id === id)?.abrev ?? '—';
}

export function getEmpresaColor(id?: number | null): string {
  return EMPRESA_OPTIONS.find(e => e.id === id)?.color ?? 'hsl(var(--muted))';
}
