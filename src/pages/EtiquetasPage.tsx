import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLabelTemplates } from '@/hooks/useLabelTemplates';
import { LabelEditorCanvas } from '@/components/labels/LabelEditorCanvas';
import { LabelPrintDialog } from '@/components/labels/LabelPrintDialog';
import { TEMPLATE_TYPES } from '@/types/labels';
import type { LabelTemplate, LabelElement, LabelTemplateType } from '@/types/labels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FullPageLoader } from '@/components/ui/loading-spinner';
import { ArrowLeft, Plus, Pencil, Trash2, Printer, Tag, Copy } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function EtiquetasPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate } = useLabelTemplates();

  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LabelTemplate | null>(null);
  const [printTemplate, setPrintTemplate] = useState<LabelTemplate | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<LabelTemplateType>('patrimonio');
  const [widthMm, setWidthMm] = useState(50);
  const [heightMm, setHeightMm] = useState(30);
  const [columns, setColumns] = useState(1);
  const [gapH, setGapH] = useState(2);
  const [gapV, setGapV] = useState(2);
  const [elements, setElements] = useState<LabelElement[]>([]);

  if (authLoading || isLoading) return <FullPageLoader />;
  if (!user) return <Navigate to="/auth" replace />;

  const resetForm = () => {
    setName('');
    setType('patrimonio');
    setWidthMm(50);
    setHeightMm(30);
    setColumns(1);
    setGapH(2);
    setGapV(2);
    setElements([]);
    setEditingTemplate(null);
  };

  const openNewEditor = () => {
    resetForm();
    setShowEditor(true);
  };

  const openEditEditor = (t: LabelTemplate) => {
    setEditingTemplate(t);
    setName(t.name);
    setType(t.type as LabelTemplateType);
    setWidthMm(t.width_mm);
    setHeightMm(t.height_mm);
    setColumns(t.columns);
    setGapH(t.gap_horizontal_mm);
    setGapV(t.gap_vertical_mm);
    setElements(t.elements);
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Informe o nome do modelo');
      return;
    }

    const payload = {
      name,
      type,
      width_mm: widthMm,
      height_mm: heightMm,
      columns,
      gap_horizontal_mm: gapH,
      gap_vertical_mm: gapV,
      elements,
    };

    if (editingTemplate) {
      await updateTemplate.mutateAsync({ id: editingTemplate.id, ...payload });
    } else {
      await createTemplate.mutateAsync(payload);
    }
    setShowEditor(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este modelo de etiqueta?')) return;
    await deleteTemplate.mutateAsync(id);
  };

  const handleDuplicate = async (t: LabelTemplate) => {
    await createTemplate.mutateAsync({
      name: `${t.name} (cópia)`,
      type: t.type as LabelTemplateType,
      width_mm: t.width_mm,
      height_mm: t.height_mm,
      columns: t.columns,
      gap_horizontal_mm: t.gap_horizontal_mm,
      gap_vertical_mm: t.gap_vertical_mm,
      elements: t.elements,
    });
  };

  const typeLabel = (t: string) => TEMPLATE_TYPES.find(tt => tt.value === t)?.label || t;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="glass border-b px-4 py-3 safe-area-top sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-foreground flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Etiquetas
            </h1>
            <p className="text-xs text-muted-foreground">Modelos de etiquetas para impressão</p>
          </div>
          <Button size="sm" onClick={openNewEditor}>
            <Plus className="w-4 h-4 mr-1" /> Novo Modelo
          </Button>
        </div>
      </div>

      {/* Template list */}
      <div className="p-4 space-y-3">
        {templates.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Tag className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>Nenhum modelo de etiqueta criado.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={openNewEditor}>
                <Plus className="w-4 h-4 mr-1" /> Criar primeiro modelo
              </Button>
            </CardContent>
          </Card>
        )}

        {templates.map(t => (
          <Card key={t.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {typeLabel(t.type)} — {t.width_mm}×{t.height_mm}mm — {t.columns} col. — {t.elements.length} elementos
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => setPrintTemplate(t)}>
                  <Printer className="w-3.5 h-3.5 mr-1" /> Imprimir
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEditEditor(t)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDuplicate(t)}>
                  <Copy className="w-3.5 h-3.5 mr-1" /> Duplicar
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(t.id)}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={v => { if (!v) { setShowEditor(false); resetForm(); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Editar Modelo' : 'Novo Modelo de Etiqueta'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Basic config */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <Label>Nome</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do modelo" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={type} onValueChange={v => setType(v as LabelTemplateType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map(tt => (
                      <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dimensions */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <Label className="text-xs">Largura (mm)</Label>
                <Input type="number" value={widthMm} onChange={e => setWidthMm(Number(e.target.value))} min={10} max={200} />
              </div>
              <div>
                <Label className="text-xs">Altura (mm)</Label>
                <Input type="number" value={heightMm} onChange={e => setHeightMm(Number(e.target.value))} min={10} max={200} />
              </div>
              <div>
                <Label className="text-xs">Colunas</Label>
                <Input type="number" value={columns} onChange={e => setColumns(Number(e.target.value))} min={1} max={6} />
              </div>
              <div>
                <Label className="text-xs">Gap H (mm)</Label>
                <Input type="number" value={gapH} onChange={e => setGapH(Number(e.target.value))} min={0} max={20} />
              </div>
              <div>
                <Label className="text-xs">Gap V (mm)</Label>
                <Input type="number" value={gapV} onChange={e => setGapV(Number(e.target.value))} min={0} max={20} />
              </div>
            </div>

            {/* Canvas editor */}
            <LabelEditorCanvas
              template={{ width_mm: widthMm, height_mm: heightMm, type, columns }}
              elements={elements}
              onElementsChange={setElements}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditor(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createTemplate.isPending || updateTemplate.isPending}>
              {editingTemplate ? 'Salvar Alterações' : 'Criar Modelo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print dialog */}
      {printTemplate && (
        <LabelPrintDialog
          open={!!printTemplate}
          onOpenChange={v => { if (!v) setPrintTemplate(null); }}
          template={printTemplate}
        />
      )}
    </div>
  );
}
