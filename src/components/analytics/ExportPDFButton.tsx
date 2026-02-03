import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { DeliveryMetrics, HygieneMetrics } from '@/hooks/useAnalyticsData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExportPDFButtonProps {
  deliveryMetrics: DeliveryMetrics;
  hygieneMetrics: HygieneMetrics;
  activeTab: 'entregas' | 'higienizacao' | 'entregadores';
}

export function ExportPDFButton({ deliveryMetrics, hygieneMetrics, activeTab }: ExportPDFButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const generatePDF = async () => {
    setIsExporting(true);
    try {
      const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      
      // Create HTML content for PDF
      let content: string;
      if (activeTab === 'entregas') {
        content = generateDeliveryReport(deliveryMetrics, today);
      } else if (activeTab === 'higienizacao') {
        content = generateHygieneReport(hygieneMetrics, today);
      } else {
        // For driver tab, use delivery report as base (driver metrics shown in UI)
        content = generateDeliveryReport(deliveryMetrics, today);
      }

      // Open print dialog
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Não foi possível abrir a janela de impressão');
      }

      printWindow.document.write(content);
      printWindow.document.close();
      
      // Wait for content to load then print
      printWindow.onload = () => {
        printWindow.print();
      };

      toast.success('Relatório gerado! Use Ctrl+P para salvar como PDF.');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar relatório');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={generatePDF}
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <FileText className="w-4 h-4 mr-2" />
      )}
      Exportar PDF
    </Button>
  );
}

function generateDeliveryReport(metrics: DeliveryMetrics, date: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Relatório de Entregas - Graal Beer</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #f59e0b; padding-bottom: 20px; }
        .header h1 { color: #f59e0b; font-size: 24px; margin-bottom: 8px; }
        .header p { color: #666; font-size: 14px; }
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
        .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; }
        .kpi .value { font-size: 28px; font-weight: bold; color: #1a1a1a; }
        .kpi .label { font-size: 11px; color: #666; text-transform: uppercase; margin-top: 4px; }
        .section { margin-bottom: 32px; }
        .section h2 { font-size: 16px; color: #374151; margin-bottom: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
        th { background: #f9fafb; font-weight: 600; }
        .footer { margin-top: 40px; text-align: center; color: #999; font-size: 11px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🍺 Graal Beer - Relatório de Entregas</h1>
        <p>Período: Últimos 7 dias | Gerado em: ${date}</p>
      </div>

      <div class="kpis">
        <div class="kpi">
          <div class="value">${metrics.totalDeliveries}</div>
          <div class="label">Entregas</div>
        </div>
        <div class="kpi">
          <div class="value">${metrics.totalCollected}</div>
          <div class="label">Recolhidos</div>
        </div>
        <div class="kpi">
          <div class="value">${metrics.avgCollectionDays}d</div>
          <div class="label">Tempo Médio</div>
        </div>
        <div class="kpi">
          <div class="value">${metrics.confirmationRate}%</div>
          <div class="label">Taxa Confirmação</div>
        </div>
      </div>

      <div class="section">
        <h2>Entregas por Dia</h2>
        <table>
          <thead>
            <tr>
              <th>Dia</th>
              <th>Quantidade</th>
            </tr>
          </thead>
          <tbody>
            ${metrics.deliveriesPerDay.map(d => `
              <tr>
                <td>${d.label} (${d.date})</td>
                <td>${d.count}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2>Distribuição por Status</h2>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Quantidade</th>
            </tr>
          </thead>
          <tbody>
            ${metrics.statusDistribution.map(s => `
              <tr>
                <td>${s.status}</td>
                <td>${s.count}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2>Resumo</h2>
        <p><strong>${metrics.pendingCollection}</strong> equipamentos aguardando recolha no total.</p>
      </div>

      <div class="footer">
        <p>Graal Beer - Sistema de Gestão de Entregas</p>
      </div>
    </body>
    </html>
  `;
}

function generateHygieneReport(metrics: HygieneMetrics, date: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Relatório de Higienização - Graal Beer</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #22c55e; padding-bottom: 20px; }
        .header h1 { color: #22c55e; font-size: 24px; margin-bottom: 8px; }
        .header p { color: #666; font-size: 14px; }
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
        .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; }
        .kpi .value { font-size: 28px; font-weight: bold; color: #1a1a1a; }
        .kpi .label { font-size: 11px; color: #666; text-transform: uppercase; margin-top: 4px; }
        .kpi.danger .value { color: #ef4444; }
        .section { margin-bottom: 32px; }
        .section h2 { font-size: 16px; color: #374151; margin-bottom: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
        th { background: #f9fafb; font-weight: 600; }
        .footer { margin-top: 40px; text-align: center; color: #999; font-size: 11px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🧼 Graal Beer - Relatório de Higienização</h1>
        <p>Período: Últimos 7 dias | Gerado em: ${date}</p>
      </div>

      <div class="kpis">
        <div class="kpi">
          <div class="value">${metrics.totalClients}</div>
          <div class="label">Clientes</div>
        </div>
        <div class="kpi">
          <div class="value">${metrics.totalEquipment}</div>
          <div class="label">Equipamentos</div>
        </div>
        <div class="kpi">
          <div class="value">${metrics.servicesCompleted}</div>
          <div class="label">Serviços</div>
        </div>
        <div class="kpi ${metrics.overdueCleanings > 0 ? 'danger' : ''}">
          <div class="value">${metrics.overdueCleanings}</div>
          <div class="label">Atrasados</div>
        </div>
      </div>

      <div class="section">
        <h2>Serviços por Dia</h2>
        <table>
          <thead>
            <tr>
              <th>Dia</th>
              <th>Quantidade</th>
            </tr>
          </thead>
          <tbody>
            ${metrics.cleaningsByDay.map(d => `
              <tr>
                <td>${d.label} (${d.date})</td>
                <td>${d.count}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2>Equipamentos por Tipo</h2>
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Quantidade</th>
            </tr>
          </thead>
          <tbody>
            ${metrics.equipmentByType.map(e => `
              <tr>
                <td>${e.type}</td>
                <td>${e.count}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2>Tipos de Serviço</h2>
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Quantidade</th>
            </tr>
          </thead>
          <tbody>
            ${metrics.servicesByType.map(s => `
              <tr>
                <td>${s.type}</td>
                <td>${s.count}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2>Resumo</h2>
        <p><strong>${metrics.upcomingCleanings}</strong> limpezas programadas para os próximos 7 dias.</p>
      </div>

      <div class="footer">
        <p>Graal Beer - Sistema de Gestão de Higienização</p>
      </div>
    </body>
    </html>
  `;
}
