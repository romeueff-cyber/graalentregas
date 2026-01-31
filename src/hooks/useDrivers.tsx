import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Driver {
  id: string;
  name: string;
  email: string;
}

export function useDrivers() {
  const { data: drivers = [], isLoading, error } = useQuery({
    queryKey: ['drivers'],
    queryFn: async (): Promise<Driver[]> => {
      // Fetch users with 'entregador' role
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'entregador');

      if (rolesError) {
        console.error('Error fetching driver roles:', rolesError);
        throw rolesError;
      }

      if (!roles || roles.length === 0) return [];

      const driverIds = roles.map(r => r.user_id);
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', driverIds);

      if (profilesError) {
        console.error('Error fetching driver profiles:', profilesError);
        throw profilesError;
      }

      return profiles || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    drivers,
    isLoading,
    error,
  };
}
