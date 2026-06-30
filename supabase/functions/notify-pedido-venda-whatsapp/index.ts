import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ZAPSTER_URL = 'https://api.zapsterapi.com/v1/wa/messages';

function normalizeRecipient(recipient: string) {
  const trimmed = recipient.trim();
  if (trimmed.includes('@')) return trimmed;
  if (trimmed.startsWith('120363')) return `${trimmed}@g.us`;
  return trimmed;
}

function fmtDate(input?: string | null) {
  if (!input) return '-';
  const s = String(input).trim();
  if (!s) return '-';
  // já dd/mm/aaaa
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[1]}/${br[2]}/${br[3]}`;
  // yyyy-mm-dd (com ou sem hora)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  // fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return '-';
}

function fmtMoney(v?: number | null) {
  if (v == null) return null;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function buildMessage(
  pedido: Record<string, unknown>,
  itens: Array<Record<string, unknown>>,
  vendedorNome?: string,
  boletosPend: Array<{ total_amount: number; due_date: string; status: string; order_number: string }> = [],
) {
  const produtos = itens.filter((i) => (i.tipo ?? 'produto') === 'produto');
  const equipamentos = itens.filter((i) => i.tipo === 'equipamento');

  const lines: string[] = [];
  const numero = (pedido as { numero_pedido?: number | null }).numero_pedido;
  const numeroFmt = numero != null ? `APP-${String(numero).padStart(3, '0')}` : null;
  lines.push(`🧾 *Novo pedido de venda${numeroFmt ? ` #${numeroFmt}` : ''}*`);
  lines.push('');
  lines.push(`👤 *Cliente:* ${pedido.nome_cliente ?? '-'}`);
  if (vendedorNome) lines.push(`🧑‍💼 *Vendedor:* ${vendedorNome}`);
  lines.push(`📅 *Entrega:* ${fmtDate(pedido.data_entrega as string)}${pedido.horario_entrega ? ` • ${pedido.horario_entrega}` : ''}`);
  lines.push(`📍 *Endereço:* ${pedido.endereco_entrega ?? '-'}`);

  let subtotal = 0;
  let descontoTotal = 0;

  if (produtos.length) {
    lines.push('');
    lines.push('🍺 *Produtos:*');
    for (const i of produtos) {
      const qtd = num(i.quantidade);
      const preco = num(i.preco_unitario);
      const desc = num(i.desconto);
      const totalItem = qtd * preco - desc;
      subtotal += qtd * preco;
      descontoTotal += desc;
      const precoStr = preco > 0 ? ` — ${fmtMoney(preco)}` : '';
      const totalStr = preco > 0 ? ` = *${fmtMoney(totalItem)}*` : '';
      const descStr = desc > 0 ? ` (desc. ${fmtMoney(desc)})` : '';
      const obs = i.observacao ? ` _(${i.observacao})_` : '';
      lines.push(`• ${qtd}x ${i.produto}${precoStr}${descStr}${totalStr}${obs}`);
    }
  }
  if (equipamentos.length) {
    lines.push('');
    lines.push('🛠️ *Equipamentos:*');
    for (const i of equipamentos) {
      const obs = i.observacao ? ` _(${i.observacao})_` : '';
      lines.push(`• ${i.quantidade}x ${i.produto}${obs}`);
    }
  }

  const totalPedido = subtotal - descontoTotal;
  if (subtotal > 0) {
    lines.push('');
    lines.push('💰 *Financeiro*');
    lines.push(`Subtotal: ${fmtMoney(subtotal)}`);
    if (descontoTotal > 0) lines.push(`Desconto: -${fmtMoney(descontoTotal)}`);
    lines.push(`*Total: ${fmtMoney(totalPedido)}*`);
  }

  if (boletosPend.length) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const isAtrasado = (b: { due_date: string; status: string }) =>
      new Date(`${b.due_date}T12:00:00`) < hoje || b.status === 'LATE';
    const totalDevido = boletosPend.reduce((s, b) => s + (b.total_amount || 0) / 100, 0);
    const vencidos = boletosPend.filter(isAtrasado);

    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push(`⚠️ *ATENÇÃO — Cliente possui pendências*`);
    lines.push(`Em aberto: ${boletosPend.length} boleto(s) • ${fmtMoney(totalDevido)}`);
    if (vencidos.length) {
      const totalVenc = vencidos.reduce((s, b) => s + (b.total_amount || 0) / 100, 0);
      lines.push(`🔴 Vencidos: ${vencidos.length} • ${fmtMoney(totalVenc)}`);
    }

    if (vencidos.length) {
      lines.push('');
      lines.push('*Pedidos vencidos:*');
      const vencList = vencidos.slice(0, 5) as Array<typeof vencidos[number] & { detail?: ErpOrderDetail | null }>;
      vencList.forEach((b, idx) => {
        if (idx > 0) lines.push('');
        lines.push(`🔴 *Pedido ${b.order_number}* — ${fmtMoney((b.total_amount || 0) / 100)}`);
        lines.push(`   Vencimento: ${fmtDate(b.due_date)}`);
        const det = b.detail;
        if (det?.delivery_date) lines.push(`   Entregue em: ${fmtDate(det.delivery_date)}`);
        if (det?.items?.length) {
          lines.push(`   Produtos:`);
          for (const i of det.items) lines.push(`     • ${i.quantity}x ${i.product}`);
        }
        if (det?.equipments?.length) {
          lines.push(`   Equipamentos:`);
          for (const e of det.equipments) lines.push(`     • ${e.quantity}x ${e.type}`);
        }
      });
      if (vencidos.length > 5) lines.push(`\n… e mais ${vencidos.length - 5} pedido(s) vencido(s)`);
    }
    lines.push('━━━━━━━━━━━━━━━━━━━━');
  }

  if (pedido.observacoes) {
    lines.push('');
    lines.push(`📝 *Observações:* ${pedido.observacoes}`);
  }

  return lines.join('\n');
}

interface ErpOrderDetail {
  delivery_date?: string | null;
  items?: Array<{ product: string; quantity: number }>;
  equipments?: Array<{ type: string; quantity: number }>;
}

async function fetchErpOrderDetail(orderNumber: string): Promise<ErpOrderDetail | null> {
  const ERP_API_URL = Deno.env.get('ERP_API_URL');
  const ERP_API_KEY = Deno.env.get('ERP_API_KEY');
  if (!ERP_API_URL || !ERP_API_KEY) return null;
  try {
    const url = `${ERP_API_URL.replace(/\/$/, '')}/api/orders/${encodeURIComponent(orderNumber)}`;
    const resp = await fetch(url, { headers: { 'x-api-key': ERP_API_KEY } });
    if (!resp.ok) return null;
    return await resp.json() as ErpOrderDetail;
  } catch (e) {
    console.warn('[notify-pedido-venda-whatsapp] ERP detail falhou', orderNumber, String(e));
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ZAPSTER_API_TOKEN = Deno.env.get('ZAPSTER_API_TOKEN');
    const ZAPSTER_INSTANCE_ID = Deno.env.get('ZAPSTER_INSTANCE_ID');
    const ZAPSTER_GROUP_RECIPIENT_DEFAULT = Deno.env.get('ZAPSTER_GROUP_RECIPIENT');

    if (!ZAPSTER_API_TOKEN || !ZAPSTER_INSTANCE_ID) {
      return new Response(JSON.stringify({ error: 'Zapster não configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await (userClient.auth as { getClaims?: () => Promise<{ data: { claims?: { sub?: string } } | null }> }).getClaims?.() ?? { data: null };
    const userId = claims?.claims?.sub ?? (await userClient.auth.getUser()).data.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const pedidoId = body.pedidoId as string | undefined;
    if (!pedidoId) {
      return new Response(JSON.stringify({ error: 'pedidoId obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Restrict to admin / financeiro / vendedor
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'financeiro', 'vendedor'])
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: pedido, error: pErr } = await admin
      .from('pedidos_venda')
      .select('*, itens:pedidos_venda_itens(*)')
      .eq('id', pedidoId)
      .single();
    if (pErr || !pedido) {
      return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let vendedorNome: string | undefined;
    if (pedido.vendedor_id) {
      const { data: prof } = await admin
        .from('profiles')
        .select('name')
        .eq('id', pedido.vendedor_id)
        .maybeSingle();
      vendedorNome = (prof as { name?: string } | null)?.name;
    }

    // Boletos em aberto/atrasados do cliente (match por nome normalizado)
    const normalize = (s: string) =>
      (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
    const nomeAlvo = normalize(String(pedido.nome_cliente ?? ''));
    let boletosPend: Array<{ total_amount: number; due_date: string; status: string; order_number: string }> = [];
    if (nomeAlvo) {
      const { data: bols } = await admin
        .from('boletos')
        .select('total_amount, due_date, status, order_number, customer_name')
        .in('status', ['OPEN', 'LATE'])
        .order('due_date', { ascending: true });
      boletosPend = ((bols ?? []) as Array<{ customer_name: string; total_amount: number; due_date: string; status: string; order_number: string }>)
        .filter((b) => normalize(b.customer_name) === nomeAlvo);
    }

    // Para cada boleto vencido, busca detalhes do pedido no ERP (limite 5)
    type BoletoComDetalhe = typeof boletosPend[number] & { detail?: ErpOrderDetail | null };
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const enriquecidos: BoletoComDetalhe[] = await Promise.all(
      boletosPend.slice(0, 5).map(async (b) => {
        const vencido = new Date(`${b.due_date}T12:00:00`) < hoje || b.status === 'LATE';
        if (!vencido || !b.order_number) return b;
        const detail = await fetchErpOrderDetail(b.order_number);
        return { ...b, detail };
      }),
    );
    const boletosFinal = [...enriquecidos, ...boletosPend.slice(5)];

    // Recipient por empresa (fallback p/ env padrão)
    let recipientRaw: string | null = ZAPSTER_GROUP_RECIPIENT_DEFAULT ?? null;
    const empresaId = (pedido as { id_empresa?: number }).id_empresa;
    if (empresaId) {
      const { data: cfg } = await admin
        .from('empresa_settings')
        .select('whatsapp_recipient')
        .eq('empresa_id', empresaId)
        .maybeSingle();
      const customRecipient = (cfg as { whatsapp_recipient?: string | null } | null)?.whatsapp_recipient;
      if (customRecipient && customRecipient.trim()) {
        recipientRaw = customRecipient.trim();
      }
    }
    if (!recipientRaw) {
      return new Response(JSON.stringify({ error: 'Destinatário WhatsApp não configurado para esta empresa' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const text = buildMessage(pedido, pedido.itens ?? [], vendedorNome, boletosFinal);
    const recipient = normalizeRecipient(recipientRaw);

    const resp = await fetch(ZAPSTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ZAPSTER_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instance_id: ZAPSTER_INSTANCE_ID,
        recipient,
        text,
      }),
    });
    const respText = await resp.text();
    console.log('[notify-pedido-venda-whatsapp] zapster status', resp.status, 'recipient', recipient, respText.slice(0, 300));

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: 'Zapster falhou', status: resp.status, body: respText }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(respText, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[notify-pedido-venda-whatsapp] erro', e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
