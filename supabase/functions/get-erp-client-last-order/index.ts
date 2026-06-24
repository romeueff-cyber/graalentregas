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

    const target = `${ERP_API_URL.replace(/\/$/, '')}/api/clients/${encodeURIComponent(clientId)}/last-order`;
    console.log('[get-erp-client-last-order] GET', target);

    const r = await fetch(target, { headers: { 'x-api-key': ERP_API_KEY } });
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[get-erp-client-last-order] error', e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
