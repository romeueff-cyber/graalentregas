import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { LabelTemplate, LabelElement, LabelTemplateType } from '@/types/labels';

export function useLabelTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['label-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('label_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((t: any) => ({
        ...t,
        width_mm: Number(t.width_mm),
        height_mm: Number(t.height_mm),
        gap_horizontal_mm: Number(t.gap_horizontal_mm),
        gap_vertical_mm: Number(t.gap_vertical_mm),
        elements: (t.elements || []) as LabelElement[],
      })) as LabelTemplate[];
    },
    enabled: !!user,
  });

  const createTemplate = useMutation({
    mutationFn: async (template: {
      name: string;
      type: LabelTemplateType;
      width_mm: number;
      height_mm: number;
      columns: number;
      gap_horizontal_mm: number;
      gap_vertical_mm: number;
      elements: LabelElement[];
    }) => {
      const { data, error } = await supabase
        .from('label_templates')
        .insert({
          ...template,
          elements: template.elements as any,
          created_by_user_id: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label-templates'] });
      toast.success('Modelo criado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao criar modelo');
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LabelTemplate> & { id: string }) => {
      const payload: any = { ...updates };
      if (updates.elements) payload.elements = updates.elements as any;
      delete payload.created_by_user_id;
      delete payload.created_at;
      delete payload.updated_at;

      const { data, error } = await supabase
        .from('label_templates')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label-templates'] });
      toast.success('Modelo atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar modelo');
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('label_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label-templates'] });
      toast.success('Modelo excluído!');
    },
    onError: () => {
      toast.error('Erro ao excluir modelo');
    },
  });

  return { templates, isLoading, createTemplate, updateTemplate, deleteTemplate };
}
