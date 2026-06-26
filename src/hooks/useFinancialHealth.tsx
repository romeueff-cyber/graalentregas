import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, startOfDay, addDays, isAfter, isBefore, parseISO, format } from 'date-fns';
import { useClientHealth, type ClientHealthStatus } from './useClientHealth';
import { useEmpresa } from '@/contexts/EmpresaContext';

export interface FinancialBoleto {
  id: string;
  order_number: string;
  customer_name: string;
  customer_document: string | null;
  total_amount: number; // cents
  due_date: string;
  status: string; // PAID | OPEN | LATE | CANCELLED
  created_at: string;
  reconciled: boolean;
}

export interface AgingBucket {
  label: string;
  count: number;
  amount: number; // R$
}

export interface TopDebtor {
  customerName: string;
  totalOpen: number;
  count: number;
  oldestDueDate: string;
  maxDaysLate: number;
}

export interface RedAlertClient {
  customerName: string;
  healthStatus: ClientHealthStatus;
  daysSinceLast: number;
  totalOpen: number;
  count: number;
  maxDaysLate: number;
}

export interface FinancialMetrics {
  // Totais
  totalEmitido: number;
  totalPago: number;
  totalAberto: number;          // OPEN + LATE não pagos
  totalVencido: number;         // LATE
  totalCancelado: number;
  countEmitido: number;
  countPago: number;
  countAberto: number;
  countVencido: number;
  countCancelado: number;

  // Indicadores
  inadimplenciaPct: number;     // vencido / (pago + aberto)
  taxaPagamentoEmDia: number;   // pago no prazo / pagos
  cancelamentoPct: number;
  ticketMedio: number;
  dsoDias: number;              // prazo médio real de recebimento

  // Aging
  aging: AgingBucket[];

  // Fluxo
  aReceber7: number;
  aReceber15: number;
  aReceber30: number;

  // Listas
  topDebtors: TopDebtor[];
  redAlerts: RedAlertClient[];
}

const normalizeName = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

const toReais = (cents: number) => cents / 100;

export function useFinancialHealth(days: number = 180) {
  const { metrics: healthMetrics, isLoading: healthLoading } = useClientHealth(days);
  const { selectedEmpresa, allowedEmpresas } = useEmpresa();
  const empresasFilter = selectedEmpresa != null ? [selectedEmpresa] : allowedEmpresas;

  const { data: boletos, isLoading, error, refetch } = useQuery({
    queryKey: ['financial-health-boletos', days, empresasFilter.join(',')],
    enabled: empresasFilter.length > 0,
    queryFn: async (): Promise<FinancialBoleto[]> => {
      const since = format(addDays(new Date(), -days), 'yyyy-MM-dd');
      let q = supabase
        .from('boletos')
        .select('id, order_number, customer_name, customer_document, total_amount, due_date, status, created_at, reconciled, id_empresa')
        .gte('created_at', since)
        .order('due_date', { ascending: false });
      if (selectedEmpresa != null) {
        q = q.eq('id_empresa', selectedEmpresa);
      } else if (allowedEmpresas.length > 0) {
        q = q.in('id_empresa', allowedEmpresas);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as FinancialBoleto[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const metrics: FinancialMetrics = useMemo(() => {
    const empty: FinancialMetrics = {
      totalEmitido: 0, totalPago: 0, totalAberto: 0, totalVencido: 0, totalCancelado: 0,
      countEmitido: 0, countPago: 0, countAberto: 0, countVencido: 0, countCancelado: 0,
      inadimplenciaPct: 0, taxaPagamentoEmDia: 0, cancelamentoPct: 0, ticketMedio: 0, dsoDias: 0,
      aging: [
        { label: '1–15d', count: 0, amount: 0 },
        { label: '16–30d', count: 0, amount: 0 },
        { label: '31–60d', count: 0, amount: 0 },
        { label: '61–90d', count: 0, amount: 0 },
        { label: '90+d', count: 0, amount: 0 },
      ],
      aReceber7: 0, aReceber15: 0, aReceber30: 0,
      topDebtors: [], redAlerts: [],
    };
    if (!boletos || boletos.length === 0) return empty;

    const today = startOfDay(new Date());
    const in7 = addDays(today, 7);
    const in15 = addDays(today, 15);
    const in30 = addDays(today, 30);

    let totalEmitido = 0, totalPago = 0, totalAberto = 0, totalVencido = 0, totalCancelado = 0;
    let countEmitido = 0, countPago = 0, countAberto = 0, countVencido = 0, countCancelado = 0;
    let aReceber7 = 0, aReceber15 = 0, aReceber30 = 0;

    const aging = [
      { label: '1–15d', count: 0, amount: 0 },
      { label: '16–30d', count: 0, amount: 0 },
      { label: '31–60d', count: 0, amount: 0 },
      { label: '61–90d', count: 0, amount: 0 },
      { label: '90+d', count: 0, amount: 0 },
    ];

    // por cliente (devedores)
    type Acc = { totalOpen: number; count: number; oldestDueDate: string; maxDaysLate: number };
    const byCustomer = new Map<string, Acc>();

    // DSO: média de (data efetiva de pagamento − data de emissão) para PAID.
    // Sem coluna paid_at, usamos updated_at via fallback — aproximação aceitável.
    let dsoSum = 0, dsoCount = 0;

    // Pagamento em dia
    let onTime = 0, paidWithDue = 0;

    boletos.forEach((b) => {
      const amt = toReais(b.total_amount);
      const due = parseISO(b.due_date);
      const created = parseISO(b.created_at);

      countEmitido++;
      totalEmitido += amt;

      if (b.status === 'CANCELLED') {
        countCancelado++;
        totalCancelado += amt;
        return;
      }

      if (b.status === 'PAID') {
        countPago++;
        totalPago += amt;
        paidWithDue++;
        // Aproximação: pago antes ou no vencimento = em dia
        // (sem paid_at, assume pago próximo ao due_date se due >= today, senão atrasado)
        if (!isBefore(due, today)) onTime++;
        return;
      }

      // OPEN ou LATE — em aberto
      countAberto++;
      totalAberto += amt;

      const isLate = isBefore(due, today) || b.status === 'LATE';
      if (isLate) {
        countVencido++;
        totalVencido += amt;
        const lateDays = differenceInDays(today, due);
        let idx = 4;
        if (lateDays <= 15) idx = 0;
        else if (lateDays <= 30) idx = 1;
        else if (lateDays <= 60) idx = 2;
        else if (lateDays <= 90) idx = 3;
        aging[idx].count++;
        aging[idx].amount += amt;

        // devedores
        const key = normalizeName(b.customer_name);
        const acc = byCustomer.get(key) || {
          totalOpen: 0, count: 0, oldestDueDate: b.due_date, maxDaysLate: 0,
        };
        acc.totalOpen += amt;
        acc.count++;
        if (b.due_date < acc.oldestDueDate) acc.oldestDueDate = b.due_date;
        if (lateDays > acc.maxDaysLate) acc.maxDaysLate = lateDays;
        // Guarda nome original (primeira ocorrência)
        if (!(acc as any).displayName) (acc as any).displayName = b.customer_name;
        byCustomer.set(key, acc);
      } else {
        // a receber
        if (!isAfter(due, in7)) aReceber7 += amt;
        if (!isAfter(due, in15)) aReceber15 += amt;
        if (!isAfter(due, in30)) aReceber30 += amt;
      }
    });

    // DSO estimado: usa avg do prazo (due − created) dos pagos como proxy
    boletos.forEach((b) => {
      if (b.status !== 'PAID') return;
      const d = differenceInDays(parseISO(b.due_date), parseISO(b.created_at));
      if (d >= 0 && d <= 180) { dsoSum += d; dsoCount++; }
    });
    const dsoDias = dsoCount > 0 ? Math.round(dsoSum / dsoCount) : 0;

    const baseFin = totalPago + totalAberto;
    const inadimplenciaPct = baseFin > 0 ? (totalVencido / baseFin) * 100 : 0;
    const taxaPagamentoEmDia = paidWithDue > 0 ? (onTime / paidWithDue) * 100 : 0;
    const cancelamentoPct = countEmitido > 0 ? (countCancelado / countEmitido) * 100 : 0;
    const ticketMedio = countEmitido > 0 ? totalEmitido / countEmitido : 0;

    const topDebtors: TopDebtor[] = Array.from(byCustomer.entries())
      .map(([key, v]) => ({
        customerName: (v as any).displayName || key,
        totalOpen: v.totalOpen,
        count: v.count,
        oldestDueDate: v.oldestDueDate,
        maxDaysLate: v.maxDaysLate,
      }))
      .sort((a, b) => b.totalOpen - a.totalOpen)
      .slice(0, 10);

    // Alerta vermelho: cliente parado/risco + tem boleto em aberto
    const healthByName = new Map<string, { status: ClientHealthStatus; daysSinceLast: number }>();
    healthMetrics.rows.forEach((r) => {
      healthByName.set(normalizeName(r.clientName), {
        status: r.status, daysSinceLast: r.daysSinceLast,
      });
    });

    const redAlerts: RedAlertClient[] = [];
    byCustomer.forEach((v, key) => {
      const h = healthByName.get(key);
      if (!h) return;
      if (h.status === 'parado' || h.status === 'risco') {
        redAlerts.push({
          customerName: (v as any).displayName || key,
          healthStatus: h.status,
          daysSinceLast: h.daysSinceLast,
          totalOpen: v.totalOpen,
          count: v.count,
          maxDaysLate: v.maxDaysLate,
        });
      }
    });
    redAlerts.sort((a, b) => b.totalOpen - a.totalOpen);

    return {
      totalEmitido, totalPago, totalAberto, totalVencido, totalCancelado,
      countEmitido, countPago, countAberto, countVencido, countCancelado,
      inadimplenciaPct, taxaPagamentoEmDia, cancelamentoPct, ticketMedio, dsoDias,
      aging, aReceber7, aReceber15, aReceber30,
      topDebtors, redAlerts,
    };
  }, [boletos, healthMetrics.rows]);

  return {
    boletos: boletos || [],
    metrics,
    isLoading: isLoading || healthLoading,
    error,
    refetch,
  };
}
