import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ZAPSTER_URL = 'https://api.zapsterapi.com/v1/wa/messages';

function normalizeRecipient(recipient: string) {
  const trimmed = recipient.trim();
  if (trimmed.includes('@')) return trimmed;
  if (trimmed.startsWith('120363')) return `${trimmed}@g.us`;
  return trimmed;
}

function fmtDate(iso?: string | null) {
  if (!iso) return '-';
  try {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

function fmtMoney(v?: number | null) {
  if (v == null) return null;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildMessage(pedido: Record<string, unknown>, itens: Array<Record<string, unknown>>, vendedorNome?: string) {
  const produtos = itens.filter((i) => (i.tipo ?? 'produto') === 'produto');
  const equipamentos = itens.filter((i) => i.tipo === 'equipamento');

  const lines: string[] = [];
  lines.push('🧾 *Novo pedido de venda*');
  lines.push('');
  lines.push(`👤 *Cliente:* ${pedido.nome_cliente ?? '-'}`);
  if (vendedorNome) lines.push(`🧑‍💼 *Vendedor:* ${vendedorNome}`);
  lines.push(`📅 *Entrega:* ${fmtDate(pedido.data_entrega as string)}${pedido.horario_entrega ? ` • ${pedido.horario_entrega}` : ''}`);
  lines.push(`📍 *Endereço:* ${pedido.endereco_entrega ?? '-'}`);

  if (produtos.length) {
    lines.push('');
    lines.push('🍺 *Produtos:*');
    for (const i of produtos) {
      const preco = fmtMoney(i.preco_unitario as number | undefined);
      const obs = i.observacao ? ` _(${i.observacao})_` : '';
      lines.push(`• ${i.quantidade}x ${i.produto}${preco ? ` — ${preco}` : ''}${obs}`);
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
  if (pedido.observacoes) {
    lines.push('');
    lines.push(`📝 *Observações:* ${pedido.observacoes}`);
  }
  return lines.join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ZAPSTER_API_TOKEN = Deno.env.get('ZAPSTER_API_TOKEN');
    const ZAPSTER_INSTANCE_ID = Deno.env.get('ZAPSTER_INSTANCE_ID');
    const ZAPSTER_GROUP_RECIPIENT = Deno.env.get('ZAPSTER_GROUP_RECIPIENT');

    if (!ZAPSTER_API_TOKEN || !ZAPSTER_INSTANCE_ID || !ZAPSTER_GROUP_RECIPIENT) {
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

    const text = buildMessage(pedido, pedido.itens ?? [], vendedorNome);
    const recipient = normalizeRecipient(ZAPSTER_GROUP_RECIPIENT);

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
