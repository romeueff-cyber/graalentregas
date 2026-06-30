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

    const { productId, clientId } = await req.json();
    if (!productId || !/^[A-Za-z0-9_-]+$/.test(String(productId))) {
      return new Response(JSON.stringify({ error: 'productId inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (clientId && !/^[A-Za-z0-9_-]+$/.test(String(clientId))) {
      return new Response(JSON.stringify({ error: 'clientId inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const base = ERP_API_URL.replace(/\/$/, '');
    const qs = clientId ? `?clientId=${encodeURIComponent(String(clientId))}` : '';
    const target = `${base}/api/products/${encodeURIComponent(String(productId))}/price${qs}`;

    const resp = await fetch(target, { headers: { 'x-api-key': ERP_API_KEY } });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[get-erp-product-price] error', e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
