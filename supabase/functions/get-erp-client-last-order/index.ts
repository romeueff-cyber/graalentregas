import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const ERP_API_URL = Deno.env.get('ERP_API_URL');
    const ERP_API_KEY = Deno.env.get('ERP_API_KEY');
    if (!ERP_API_URL || !ERP_API_KEY) {
      return new Response(JSON.stringify({ error: 'ERP not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { clientId } = await req.json();
    if (!clientId) {
      return new Response(JSON.stringify({ error: 'clientId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const base = ERP_API_URL.replace(/\/$/, '');
    const headers = { 'x-api-key': ERP_API_KEY };

    // 1) Último pedido do cliente
    const lastTarget = `${base}/api/clients/${encodeURIComponent(clientId)}/last-order`;
    console.log('[get-erp-client-last-order] GET', lastTarget);
    const lastResp = await fetch(lastTarget, { headers });
    const lastText = await lastResp.text();
    if (!lastResp.ok) {
      return new Response(lastText, {
        status: lastResp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let lastJson: Record<string, unknown> | null = null;
    try { lastJson = JSON.parse(lastText); } catch { lastJson = null; }
    if (!lastJson) {
      return new Response('null', { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2) Buscar detalhes do pedido (que já contém o endereço completo, mesmo na API antiga)
    const orderNumber = (lastJson as { order_number?: string | number }).order_number;
    if (orderNumber) {
      try {
        const detailTarget = `${base}/api/orders/${encodeURIComponent(String(orderNumber))}`;
        console.log('[get-erp-client-last-order] GET', detailTarget);
        const detResp = await fetch(detailTarget, { headers });
        if (detResp.ok) {
          const det = await detResp.json();
          const addrDetails = det?.address_details ?? null;
          if (addrDetails) {
            lastJson.address = det.address ?? null;
            lastJson.address_details = addrDetails;
            lastJson.phone = det.phone ?? null;
          }
        }
      } catch (e) {
        console.warn('[get-erp-client-last-order] detalhe falhou', String(e));
      }
    }

    return new Response(JSON.stringify(lastJson), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[get-erp-client-last-order] error', e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
