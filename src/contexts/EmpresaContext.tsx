import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { EmpresaId, EMPRESAS } from '@/lib/empresas';

interface EmpresaContextValue {
  /** Empresas que o usuário pode acessar. Admins veem todas. */
  allowedEmpresas: EmpresaId[];
  /** Empresa ativa para filtragem (única). Default = primeira permitida. */
  selectedEmpresa: EmpresaId | null;
  setSelectedEmpresa: (id: EmpresaId) => void;
  /** True se o usuário tem acesso a mais de uma empresa (mostra seletor). */
  hasMultiple: boolean;
  isLoading: boolean;
}

const EmpresaContext = createContext<EmpresaContextValue | undefined>(undefined);

const STORAGE_KEY = 'graal_selected_empresa';

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['user-empresas', user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<EmpresaId[]> => {
      if (isAdmin) return [EMPRESAS.GRAAL, EMPRESAS.GROTT];
      const { data, error } = await supabase
        .from('user_companies')
        .select('empresa_id')
        .eq('user_id', user!.id);
      if (error) throw error;
      const ids = (data ?? []).map((r: any) => r.empresa_id as EmpresaId);
      return ids.length > 0 ? ids : [EMPRESAS.GRAAL];
    },
  });

  const allowedEmpresas = useMemo<EmpresaId[]>(() => data ?? [], [data]);

  const [selectedEmpresa, setSelectedEmpresaState] = useState<EmpresaId | null>(null);

  useEffect(() => {
    if (!allowedEmpresas.length) return;
    const stored = Number(localStorage.getItem(STORAGE_KEY)) as EmpresaId;
    if (stored && allowedEmpresas.includes(stored)) {
      setSelectedEmpresaState(stored);
    } else {
      setSelectedEmpresaState(allowedEmpresas[0]);
    }
  }, [allowedEmpresas]);

  const setSelectedEmpresa = (id: EmpresaId) => {
    setSelectedEmpresaState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  };

  return (
    <EmpresaContext.Provider
      value={{
        allowedEmpresas,
        selectedEmpresa,
        setSelectedEmpresa,
        hasMultiple: allowedEmpresas.length > 1,
        isLoading,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa(): EmpresaContextValue {
  const ctx = useContext(EmpresaContext);
  if (!ctx) throw new Error('useEmpresa precisa estar dentro de EmpresaProvider');
  return ctx;
}
