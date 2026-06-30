import { useRef, useCallback, useState, useEffect } from 'react';
import type { LabelTemplate, LabelElement, PrintData, LabelTemplateType } from '@/types/labels';
import { PLACEHOLDERS } from '@/types/labels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import QRCode from 'qrcode';

interface LabelPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: LabelTemplate;
}

function resolveContent(content: string, data: Record<string, string>): string {
  let resolved = content;
  Object.entries(data).forEach(([key, value]) => {
    resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  });
  return resolved;
}

export function LabelPrintDialog({ open, onOpenChange, template }: LabelPrintDialogProps) {
  const storageKey = `label-print-data-${template.id}`;
  const [copies, setCopies] = useState(1);
  const [printData, setPrintData] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
  const printRef = useRef<HTMLDivElement>(null);

  // Persist print data to localStorage
  useEffect(() => {
    if (Object.keys(printData).length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(printData));
    }
  }, [printData, storageKey]);

  // Determine placeholders: from elements + from template type definition
  const placeholders = new Set<string>();
  // Always include all placeholders defined for this template type
  const templateType = (template.type || 'patrimonio') as LabelTemplateType;
  const typePlaceholders = PLACEHOLDERS[templateType] || [];
  typePlaceholders.forEach(p => {
    const match = p.value.match(/\{\{(\w+)\}\}/);
    if (match) placeholders.add(match[1]);
  });
  // Also scan elements for any additional custom placeholders
  template.elements.forEach(el => {
    const matches = (el.content || '').matchAll(/\{\{(\w+)\}\}/g);
    for (const m of matches) placeholders.add(m[1]);
  });

  // Generate QR codes when data changes
  useEffect(() => {
    const qrElements = template.elements.filter(el => el.type === 'qrcode');
    if (qrElements.length === 0) return;

    const genQR = async () => {
      const urls: Record<string, string> = {};
      for (const el of qrElements) {
        const content = resolveContent(el.content || '', printData) || 'EMPTY';
        try {
          urls[el.id] = await QRCode.toDataURL(content, { width: 200, margin: 1 });
        } catch {
          urls[el.id] = '';
        }
      }
      setQrDataUrls(urls);
    };
    genQR();
  }, [template.elements, printData]);

  const handlePrint = useCallback(() => {
    if (!printRef.current) return;

    const widthMm = template.width_mm;
    const heightMm = template.height_mm;
    const cols = template.columns;
    const gapH = template.gap_horizontal_mm;
    const gapV = template.gap_vertical_mm;
    const totalWidthMm = widthMm * cols + gapH * (cols - 1);

    // Build print HTML
    const labelsHtml: string[] = [];
    for (let i = 0; i < copies; i++) {
      const elHtml = template.elements.map(el => {
        const resolved = resolveContent(el.content || '', printData);
        const style = `
          position: absolute;
          left: ${el.x}%;
          top: ${el.y}%;
          width: ${el.width}%;
          height: ${el.height}%;
          font-size: ${el.fontSize || 8}pt;
          font-weight: ${el.fontWeight || 'normal'};
          text-align: ${el.textAlign || 'center'};
          ${el.rotation ? `transform: rotate(${el.rotation}deg);` : ''}
          display: flex;
          align-items: center;
          justify-content: ${el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : 'center'};
          overflow: visible;
          white-space: nowrap;
          line-height: 1.1;
        `;

        if (el.type === 'line') {
          return `<div style="${style}; border-bottom: 1px solid black; height: 0;"></div>`;
        }
        if (el.type === 'qrcode') {
          const src = qrDataUrls[el.id] || '';
          return `<div style="${style}"><img src="${src}" style="width:100%;height:100%;object-fit:contain;" /></div>`;
        }
        if (el.type === 'logo') {
          if (el.content) {
            return `<div style="${style}"><img src="${el.content}" style="width:100%;height:100%;object-fit:contain;" /></div>`;
          }
          return `<div style="${style}; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 8pt; color: #999;">Logo</div>`;
        }
        const safeResolved = String(resolved ?? '').replace(/[&<>"']/g, (m) => (
          { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m
        ));
        return `<div style="${style}">${safeResolved}</div>`;
      }).join('');

      labelsHtml.push(`<div style="position:relative;width:${widthMm}mm;height:${heightMm}mm;overflow:hidden;box-sizing:border-box;">${elHtml}</div>`);
    }

    // Arrange in columns
    const rows: string[] = [];
    for (let i = 0; i < labelsHtml.length; i += cols) {
      const rowLabels = labelsHtml.slice(i, i + cols);
      rows.push(`<div style="display:flex;gap:${gapH}mm;margin-bottom:${gapV}mm;">${rowLabels.join('')}</div>`);
    }

    const printContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @page {
      size: ${totalWidthMm}mm auto;
      margin: 0;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
    }
    * { box-sizing: border-box; }
  </style>
</head>
<body>${rows.join('')}</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=600,height=400');
    if (!printWindow) {
      toast.error('Popup bloqueado. Permita popups para imprimir.');
      return;
    }
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  }, [template, copies, printData, qrDataUrls]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Imprimir: {template.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Data fields */}
          {Array.from(placeholders).map(ph => (
            <div key={ph}>
              <Label className="capitalize">{ph.replace(/_/g, ' ')}</Label>
              <Input
                value={printData[ph] || ''}
                onChange={e => setPrintData(prev => ({ ...prev, [ph]: e.target.value }))}
                placeholder={`Informe ${ph}`}
              />
            </div>
          ))}

          <div>
            <Label>Quantidade de cópias</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={copies}
              onChange={e => setCopies(Math.max(1, Number(e.target.value)))}
            />
          </div>

          {/* Preview */}
          <div className="border rounded p-2 bg-white overflow-auto">
            <div className="text-xs text-muted-foreground mb-1">Pré-visualização (1 etiqueta)</div>
            <div
              ref={printRef}
              className="relative mx-auto border border-dashed"
              style={{
                width: template.width_mm * 3,
                height: template.height_mm * 3,
              }}
            >
              {template.elements.map(el => {
                const resolved = resolveContent(el.content || '', printData);
                const style: React.CSSProperties = {
                  position: 'absolute',
                  left: `${el.x}%`,
                  top: `${el.y}%`,
                  width: `${el.width}%`,
                  height: `${el.height}%`,
                  fontSize: `${(el.fontSize || 10) * 0.8}px`,
                  fontWeight: el.fontWeight,
                  textAlign: el.textAlign as any,
                  transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : 'center',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.1,
                };

                if (el.type === 'line') return <div key={el.id} style={{ ...style, borderBottom: '1px solid black', height: 0 }} />;
                if (el.type === 'qrcode' && qrDataUrls[el.id]) return <div key={el.id} style={style}><img src={qrDataUrls[el.id]} className="w-full h-full object-contain" /></div>;
                if (el.type === 'logo' && el.content) return <div key={el.id} style={style}><img src={el.content} className="w-full h-full object-contain" alt="Logo" /></div>;
                if (el.type === 'logo') return <div key={el.id} style={style} className="border border-dashed text-[8px] text-muted-foreground flex items-center justify-center">Logo</div>;
                return <div key={el.id} style={style}><span className="truncate">{resolved || el.label}</span></div>;
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Imprimir {copies} cópia{copies > 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
