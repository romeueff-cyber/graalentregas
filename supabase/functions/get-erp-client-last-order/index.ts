import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { verifyAuth } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authResult = await verifyAuth(req);
  if ('error' in authResult) return authResult.error;

  try {
    const ERP_API_URL = Deno.env.get('ERP_API_URL');
    const ERP_API_KEY = Deno.env.get('ERP_API_KEY');
    if (!ERP_API_URL || !ERP_API_KEY) {
      return new Response(JSON.stringify({ error: 'ERP not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { clientId } = await req.json();
    if (!clientId || !/^[A-Za-z0-9_-]+$/.test(String(clientId))) {
      return new Response(JSON.stringify({ error: 'clientId inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const base = ERP_API_URL.replace(/\/$/, '');
    const headers = { 'x-api-key': ERP_API_KEY };

    const lastTarget = `${base}/api/clients/${encodeURIComponent(String(clientId))}/last-order`;
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

    const orderNumber = (lastJson as { order_number?: string | number }).order_number;
    if (orderNumber) {
      try {
        const detailTarget = `${base}/api/orders/${encodeURIComponent(String(orderNumber))}`;
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
