import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { toast } from 'sonner';

export interface ClientNote {
  id: string;
  client_name: string;
  note: string;
  follow_up_date: string | null;
  resolved: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ['client-notes'];

export function useClientNotes(clientName?: string) {
  const qc = useQueryClient();

  const { data: allNotes = [], isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_notes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ClientNote[];
    },
    staleTime: 60 * 1000,
  });

  const notes = useMemo(() => {
    if (!clientName) return allNotes;
    const norm = clientName.trim().toLowerCase();
    return allNotes.filter(n => n.client_name.trim().toLowerCase() === norm);
  }, [allNotes, clientName]);

  const createNote = useMutation({
    mutationFn: async (input: { client_name: string; note: string; follow_up_date?: string | null }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('client_notes')
        .insert({
          client_name: input.client_name.trim(),
          note: input.note.trim(),
          follow_up_date: input.follow_up_date || null,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ClientNote;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Nota criada');
    },
    onError: (e: any) => {
      console.error(e);
      toast.error('Erro ao criar nota');
    },
  });

  const updateNote = useMutation({
    mutationFn: async (input: { id: string; note?: string; follow_up_date?: string | null; resolved?: boolean }) => {
      const patch: any = {};
      if (input.note !== undefined) patch.note = input.note.trim();
      if (input.follow_up_date !== undefined) patch.follow_up_date = input.follow_up_date || null;
      if (input.resolved !== undefined) patch.resolved = input.resolved;
      const { data, error } = await supabase
        .from('client_notes')
        .update(patch)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as ClientNote;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: any) => {
      console.error(e);
      toast.error('Erro ao atualizar nota');
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Nota removida');
    },
    onError: (e: any) => {
      console.error(e);
      toast.error('Erro ao remover nota');
    },
  });

  // Build a map: clientName(lowercase) -> { hasOpen, hasDueOrOverdue }
  const indicators = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const map = new Map<string, { hasOpen: boolean; hasDueOrOverdue: boolean }>();
    allNotes.forEach(n => {
      if (n.resolved) return;
      const key = n.client_name.trim().toLowerCase();
      const prev = map.get(key) || { hasOpen: false, hasDueOrOverdue: false };
      prev.hasOpen = true;
      if (n.follow_up_date) {
        const d = new Date(n.follow_up_date + 'T12:00:00');
        if (d <= today) prev.hasDueOrOverdue = true;
      }
      map.set(key, prev);
    });
    return map;
  }, [allNotes]);

  return {
    notes,
    allNotes,
    isLoading,
    error,
    createNote,
    updateNote,
    deleteNote,
    indicators,
  };
}
