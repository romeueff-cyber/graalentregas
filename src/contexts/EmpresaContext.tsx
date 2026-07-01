import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { EmpresaId, EMPRESAS } from '@/lib/empresas';

interface EmpresaContextValue {
  /** Empresas que o usuário pode acessar. Admins veem todas. */
  allowedEmpresas: EmpresaId[];
  /** Empresa ativa para filtragem. null = todas as permitidas. */
  selectedEmpresa: EmpresaId | null;
  setSelectedEmpresa: (id: EmpresaId | null) => void;
  /** True se o usuário tem acesso a mais de uma empresa (mostra seletor). */
  hasMultiple: boolean;
  isLoading: boolean;
}

const EmpresaContext = createContext<EmpresaContextValue | undefined>(undefined);

const STORAGE_KEY = 'graal_selected_empresa';

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['user-empresas', user?.id, isAdmin],
    enabled: !!user,
    staleTime: 0,
    queryFn: async (): Promise<EmpresaId[]> => {
      const { data, error } = await supabase
        .from('user_companies')
        .select('empresa_id')
        .eq('user_id', user!.id);
      if (error) throw error;
      const ids = (data ?? []).map((r: any) => r.empresa_id as EmpresaId);
      // Admin também respeita as empresas marcadas no cadastro do usuário.
      // Se um admin antigo ainda não tiver configuração, mantém acesso total para não bloquear o sistema.
      if (ids.length > 0) return ids;
      if (isAdmin) return [EMPRESAS.GRAAL, EMPRESAS.GROTT];
      return [];
    },
  });

  const allowedEmpresas = useMemo<EmpresaId[]>(() => data ?? [], [data]);

  const [selectedEmpresa, setSelectedEmpresaState] = useState<EmpresaId | null>(null);

  useEffect(() => {
    setSelectedEmpresaState(null);
  }, [user?.id]);

  useEffect(() => {
    if (!allowedEmpresas.length) {
      setSelectedEmpresaState(null);
      return;
    }
    const signatureKey = `${STORAGE_KEY}__sig`;
    const currentSig = [...allowedEmpresas].sort().join(',');
    const lastSig = localStorage.getItem(signatureKey);
    // Se o conjunto de empresas mudou (ex.: admin ganhou acesso a uma nova empresa),
    // resetamos para "Todas" para evitar continuar filtrando pela anterior.
    if (lastSig !== currentSig) {
      localStorage.setItem(signatureKey, currentSig);
      localStorage.setItem(STORAGE_KEY, 'all');
      setSelectedEmpresaState(allowedEmpresas.length > 1 ? null : allowedEmpresas[0]);
      return;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'all') {
      setSelectedEmpresaState(null);
      return;
    }
    const stored = Number(raw) as EmpresaId;
    if (stored && allowedEmpresas.includes(stored)) {
      setSelectedEmpresaState(stored);
    } else {
      setSelectedEmpresaState(allowedEmpresas.length > 1 ? null : allowedEmpresas[0]);
    }
  }, [allowedEmpresas]);

  const setSelectedEmpresa = (id: EmpresaId | null) => {
    setSelectedEmpresaState(id);
    localStorage.setItem(STORAGE_KEY, id == null ? 'all' : String(id));
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
