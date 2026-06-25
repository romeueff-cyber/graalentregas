import { useEmpresa } from '@/contexts/EmpresaContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';
import { EMPRESA_OPTIONS } from '@/lib/empresas';

/**
 * Seletor compacto de empresa.
 * Só aparece se o usuário tem acesso a mais de uma empresa.
 */
export function EmpresaSelector({ className = '' }: { className?: string }) {
  const { allowedEmpresas, selectedEmpresa, setSelectedEmpresa, hasMultiple } = useEmpresa();

  if (!hasMultiple || !selectedEmpresa) return null;

  const opts = EMPRESA_OPTIONS.filter(o => allowedEmpresas.includes(o.id));

  return (
    <Select value={String(selectedEmpresa)} onValueChange={(v) => setSelectedEmpresa(Number(v) as any)}>
      <SelectTrigger className={`h-9 w-auto gap-2 ${className}`}>
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opts.map(o => (
          <SelectItem key={o.id} value={String(o.id)}>
            <span className="flex items-center gap-2">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: o.color }}
              />
              {o.nome}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
