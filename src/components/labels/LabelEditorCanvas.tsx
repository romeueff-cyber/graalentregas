import { useState, useRef, useCallback, useEffect } from 'react';
import type { LabelElement, LabelTemplate, LabelTemplateType } from '@/types/labels';
import { ELEMENT_TYPES, PLACEHOLDERS } from '@/types/labels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Trash2, Plus, Move, RotateCw, Type, QrCode, Barcode, Image, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LabelEditorCanvasProps {
  template: Partial<LabelTemplate>;
  elements: LabelElement[];
  onElementsChange: (elements: LabelElement[]) => void;
  printData?: Record<string, string>;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function resolveContent(content: string, data: Record<string, string>): string {
  let resolved = content;
  Object.entries(data).forEach(([key, value]) => {
    resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  });
  return resolved;
}

export function LabelEditorCanvas({ template, elements, onElementsChange, printData = {} }: LabelEditorCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; elX: number; elY: number } | null>(null);

  const widthMm = template.width_mm || 50;
  const heightMm = template.height_mm || 30;

  // Scale dynamically so the canvas is always at least 400px wide for readability
  const minCanvasWidth = 400;
  const scale = Math.max(3, minCanvasWidth / widthMm);
  const canvasWidth = widthMm * scale;
  const canvasHeight = heightMm * scale;

  const selectedElement = elements.find(el => el.id === selectedId) || null;

  const updateElement = useCallback((id: string, updates: Partial<LabelElement>) => {
    onElementsChange(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  }, [elements, onElementsChange]);

  // Logo upload handler
  const handleLogoUpload = useCallback((id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      updateElement(id, { content: dataUrl });
    };
    reader.readAsDataURL(file);
  }, [updateElement]);

  const addElement = useCallback((type: LabelElement['type']) => {
    const newEl: LabelElement = {
      id: generateId(),
      type,
      label: type === 'text' ? 'Texto' : type === 'qrcode' ? 'QR Code' : type === 'barcode' ? 'Código' : type === 'logo' ? 'Logo' : type === 'line' ? 'Linha' : 'Data',
      x: 10,
      y: 10,
      width: type === 'qrcode' ? 25 : type === 'logo' ? 20 : type === 'line' ? 80 : 40,
      height: type === 'qrcode' ? 40 : type === 'logo' ? 30 : type === 'line' ? 2 : 15,
      fontSize: type === 'line' ? 0 : 10,
      fontWeight: 'normal',
      textAlign: 'center',
      rotation: 0,
      content: type === 'text' ? 'Texto' : type === 'date' ? '{{fabricacao}}' : type === 'qrcode' ? '{{patrimonio}}' : '',
    };
    onElementsChange([...elements, newEl]);
    setSelectedId(newEl.id);
  }, [elements, onElementsChange]);

  const removeElement = useCallback((id: string) => {
    onElementsChange(elements.filter(el => el.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [elements, onElementsChange, selectedId]);

  // Drag handling
  const handleMouseDown = useCallback((e: React.MouseEvent, el: LabelElement) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(el.id);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragging({ id: el.id, startX: e.clientX, startY: e.clientY, elX: el.x, elY: el.y });
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = ((e.clientX - dragging.startX) / rect.width) * 100;
      const dy = ((e.clientY - dragging.startY) / rect.height) * 100;
      const newX = Math.max(0, Math.min(95, dragging.elX + dx));
      const newY = Math.max(0, Math.min(95, dragging.elY + dy));
      updateElement(dragging.id, { x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 });
    };
    const handleMouseUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, updateElement]);

  // Touch handling for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent, el: LabelElement) => {
    e.stopPropagation();
    setSelectedId(el.id);
    const touch = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragging({ id: el.id, startX: touch.clientX, startY: touch.clientY, elX: el.x, elY: el.y });
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const handleTouchMove = (e: TouchEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const touch = e.touches[0];
      const dx = ((touch.clientX - dragging.startX) / rect.width) * 100;
      const dy = ((touch.clientY - dragging.startY) / rect.height) * 100;
      const newX = Math.max(0, Math.min(95, dragging.elX + dx));
      const newY = Math.max(0, Math.min(95, dragging.elY + dy));
      updateElement(dragging.id, { x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 });
    };
    const handleTouchEnd = () => setDragging(null);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [dragging, updateElement]);

  const renderElement = (el: LabelElement) => {
    const resolved = el.content ? resolveContent(el.content, printData) : '';
    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${el.x}%`,
      top: `${el.y}%`,
      width: `${el.width}%`,
      height: `${el.height}%`,
      fontSize: el.fontSize ? `${el.fontSize}px` : undefined,
      fontWeight: el.fontWeight,
      textAlign: el.textAlign as any,
      transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
      cursor: 'move',
      userSelect: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : 'center',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
    };

    const isSelected = selectedId === el.id;

    if (el.type === 'line') {
      return (
        <div
          key={el.id}
          style={{ ...style, borderBottom: '1px solid black', height: '0px' }}
          className={cn('transition-shadow', isSelected && 'ring-2 ring-primary')}
          onMouseDown={e => handleMouseDown(e, el)}
          onTouchStart={e => handleTouchStart(e, el)}
          onClick={() => setSelectedId(el.id)}
        />
      );
    }

    if (el.type === 'qrcode') {
      return (
        <div
          key={el.id}
          style={style}
          className={cn('border border-dashed border-muted-foreground/50 bg-muted/20 flex items-center justify-center', isSelected && 'ring-2 ring-primary')}
          onMouseDown={e => handleMouseDown(e, el)}
          onTouchStart={e => handleTouchStart(e, el)}
          onClick={() => setSelectedId(el.id)}
        >
          <QrCode className="w-full h-full p-1 text-foreground" />
        </div>
      );
    }

    if (el.type === 'barcode') {
      return (
        <div
          key={el.id}
          style={style}
          className={cn('border border-dashed border-muted-foreground/50 bg-muted/20 flex items-center justify-center', isSelected && 'ring-2 ring-primary')}
          onMouseDown={e => handleMouseDown(e, el)}
          onTouchStart={e => handleTouchStart(e, el)}
          onClick={() => setSelectedId(el.id)}
        >
          <Barcode className="w-full h-full p-1 text-foreground" />
        </div>
      );
    }

    if (el.type === 'logo') {
      return (
        <div
          key={el.id}
          style={style}
          className={cn('border border-dashed border-muted-foreground/50 bg-muted/20 flex items-center justify-center', isSelected && 'ring-2 ring-primary')}
          onMouseDown={e => handleMouseDown(e, el)}
          onTouchStart={e => handleTouchStart(e, el)}
          onClick={() => setSelectedId(el.id)}
        >
          {el.content ? (
            <img src={el.content} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <Image className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
      );
    }

    return (
      <div
        key={el.id}
        style={style}
        className={cn('transition-shadow', isSelected && 'ring-2 ring-primary rounded-sm')}
        onMouseDown={e => handleMouseDown(e, el)}
        onTouchStart={e => handleTouchStart(e, el)}
        onClick={() => setSelectedId(el.id)}
      >
        <span className="truncate">{resolved || el.label}</span>
      </div>
    );
  };

  const templateType = (template.type || 'patrimonio') as LabelTemplateType;

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Canvas */}
      <div className="flex-1 flex flex-col items-center gap-3">
        <div className="text-xs text-muted-foreground">
          {widthMm}mm × {heightMm}mm — Clique e arraste para posicionar
        </div>
        <div
          ref={canvasRef}
          className="relative border-2 border-dashed border-foreground/30 bg-white"
          style={{ width: canvasWidth, height: canvasHeight, minWidth: canvasWidth }}
          onClick={() => setSelectedId(null)}
        >
          {elements.map(renderElement)}
        </div>

        {/* Add element buttons */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => addElement('text')}>
            <Type className="w-3.5 h-3.5 mr-1" /> Texto
          </Button>
          <Button size="sm" variant="outline" onClick={() => addElement('qrcode')}>
            <QrCode className="w-3.5 h-3.5 mr-1" /> QR Code
          </Button>
          <Button size="sm" variant="outline" onClick={() => addElement('barcode')}>
            <Barcode className="w-3.5 h-3.5 mr-1" /> Cód. Barras
          </Button>
          <Button size="sm" variant="outline" onClick={() => addElement('logo')}>
            <Image className="w-3.5 h-3.5 mr-1" /> Logo
          </Button>
          <Button size="sm" variant="outline" onClick={() => addElement('line')}>
            <Minus className="w-3.5 h-3.5 mr-1" /> Linha
          </Button>
        </div>
      </div>

      {/* Properties panel */}
      <div className="w-full lg:w-64 space-y-3 border rounded-lg p-3 bg-card">
        <h4 className="text-sm font-semibold">Propriedades</h4>
        {selectedElement ? (
          <div className="space-y-3">
            {selectedElement.type === 'logo' ? (
              <div>
                <Label className="text-xs">Imagem do Logo</Label>
                <Input
                  type="file"
                  accept="image/*"
                  className="h-8 text-sm"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(selectedElement.id, file);
                  }}
                />
                {selectedElement.content && (
                  <img src={selectedElement.content} alt="Preview" className="mt-2 max-h-16 object-contain border rounded" />
                )}
              </div>
            ) : (
              <div>
                <Label className="text-xs">Conteúdo</Label>
                <Input
                  value={selectedElement.content || ''}
                  onChange={e => updateElement(selectedElement.id, { content: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
            )}

            {/* Placeholders */}
            <div>
              <Label className="text-xs">Inserir campo</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {PLACEHOLDERS[templateType]?.map(p => (
                  <Button
                    key={p.value}
                    size="sm"
                    variant="secondary"
                    className="h-6 text-[10px] px-2"
                    onClick={() => updateElement(selectedElement.id, {
                      content: (selectedElement.content || '') + p.value
                    })}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Fonte (px)</Label>
                <Input
                  type="number"
                  value={selectedElement.fontSize || 10}
                  onChange={e => updateElement(selectedElement.id, { fontSize: Number(e.target.value) })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Peso</Label>
                <Select
                  value={selectedElement.fontWeight || 'normal'}
                  onValueChange={v => updateElement(selectedElement.id, { fontWeight: v as 'normal' | 'bold' })}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="bold">Negrito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Alinhamento</Label>
              <Select
                value={selectedElement.textAlign || 'center'}
                onValueChange={v => updateElement(selectedElement.id, { textAlign: v as any })}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Esquerda</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="right">Direita</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Largura (%)</Label>
                <Input
                  type="number"
                  value={selectedElement.width}
                  onChange={e => updateElement(selectedElement.id, { width: Number(e.target.value) })}
                  className="h-8 text-sm"
                  min={5} max={100}
                />
              </div>
              <div>
                <Label className="text-xs">Altura (%)</Label>
                <Input
                  type="number"
                  value={selectedElement.height}
                  onChange={e => updateElement(selectedElement.id, { height: Number(e.target.value) })}
                  className="h-8 text-sm"
                  min={2} max={100}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Rotação: {selectedElement.rotation || 0}°</Label>
              <Slider
                value={[selectedElement.rotation || 0]}
                onValueChange={([v]) => updateElement(selectedElement.id, { rotation: v })}
                min={0} max={360} step={90}
              />
            </div>

            <Button size="sm" variant="destructive" className="w-full" onClick={() => removeElement(selectedElement.id)}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Selecione um elemento no canvas para editar suas propriedades.</p>
        )}
      </div>
    </div>
  );
}
