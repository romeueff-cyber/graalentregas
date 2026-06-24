// Sincroniza clientes do ERP vinculados ao vendedor (vendedor_clientes_erp)
// para a tabela clientes_vendedor (cache local + fonte única de verdade no app).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ERP_API_URL = Deno.env.get('ERP_API_URL');
    const ERP_API_KEY = Deno.env.get('ERP_API_KEY');

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Valida usuário via claims (mais rápido / estável)
    const { data: claims } = await (userClient.auth as any).getClaims?.() ?? { data: null };
    const userId = claims?.claims?.sub
      ?? (await userClient.auth.getUser()).data.user?.id;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) vínculos ERP do vendedor
    const { data: vincs, error: vErr } = await admin
      .from('vendedor_clientes_erp')
      .select('id_cliente_erp, nome_cliente')
      .eq('vendedor_id', userId);
    if (vErr) throw vErr;

    if (!vincs || vincs.length === 0) {
      return new Response(JSON.stringify({ synced: 0, total: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) clientes_vendedor já existentes para este vendedor (por id_cliente_erp)
    const { data: existentes } = await admin
      .from('clientes_vendedor')
      .select('id_cliente_erp')
      .eq('vendedor_id', userId)
      .not('id_cliente_erp', 'is', null);
    const jaExistem = new Set((existentes ?? []).map((r: any) => r.id_cliente_erp));

    // 3) Para cada vínculo NOVO, busca detalhes no ERP e insere
    const novos: any[] = [];
    let synced = 0;

    for (const v of vincs) {
      if (jaExistem.has(v.id_cliente_erp)) continue;

      let nome = v.nome_cliente || `Cliente ${v.id_cliente_erp}`;
      let nomeFantasia: string | null = null;
      let cpfCnpj = '';

      // Tenta enriquecer com dados do ERP (não bloqueia se ERP estiver fora)
      if (ERP_API_URL && ERP_API_KEY) {
        try {
          const u = `${ERP_API_URL.replace(/\/$/, '')}/api/clients?client_id=${encodeURIComponent(v.id_cliente_erp)}`;
          const r = await fetch(u, { headers: { 'x-api-key': ERP_API_KEY }, signal: AbortSignal.timeout(5000) });
          if (r.ok) {
            const arr = await r.json();
            const c = Array.isArray(arr) ? arr[0] : arr;
            if (c) {
              nome = c.name || nome;
              nomeFantasia = c.nickname || null;
              cpfCnpj = c.document || '';
            }
          }
        } catch (e) {
          console.warn('[sync-vendedor-clients] ERP fetch falhou para', v.id_cliente_erp, String(e));
        }
      }

      novos.push({
        vendedor_id: userId,
        nome,
        nome_fantasia: nomeFantasia,
        cpf_cnpj: cpfCnpj,
        endereco: '(endereço será informado no pedido)',
        id_cliente_erp: v.id_cliente_erp,
        origem: 'erp',
      });
    }

    if (novos.length > 0) {
      const { error: insErr, count } = await admin
        .from('clientes_vendedor')
        .upsert(novos, { onConflict: 'vendedor_id,id_cliente_erp', count: 'exact' });
      if (insErr) throw insErr;
      synced = count ?? novos.length;
    }

    return new Response(JSON.stringify({ synced, total: vincs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[sync-vendedor-clients] erro', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
