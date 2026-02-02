import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderNumber } = await req.json();

    if (!orderNumber) {
      throw new Error('Número do pedido é obrigatório');
    }

    const erpApiUrl = Deno.env.get('ERP_API_URL');
    const erpApiKey = Deno.env.get('ERP_API_KEY');

    if (!erpApiUrl || !erpApiKey) {
      throw new Error('Configuração do ERP não encontrada');
    }

    console.log(`[ERP Boleto] Fetching data for order: ${orderNumber}`);

    // Call the ERP proxy endpoint
    const url = `${erpApiUrl}/api/orders/${encodeURIComponent(orderNumber)}/boleto`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': erpApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const responseText = await response.text();
      const parsed = tryParseJson(responseText) as any;
      const contentType = response.headers.get('content-type') || '';

      console.error('[ERP Boleto] Upstream error', {
        url,
        status: response.status,
        contentType,
        bodyPreview: responseText?.slice?.(0, 400),
      });

      // Prefer explicit message from proxy when present
      const proxyError = parsed?.error ?? parsed?.message;

      // Detect missing endpoint (Express default 404)
      const looksLikeMissingRoute =
        response.status === 404 &&
        ((/Cannot\s+GET\s+\/api\//i).test(responseText) ||
          (/Cannot\s+GET/i).test(responseText) ||
          (!contentType.includes('application/json') && (/not\s+found/i).test(responseText)));

      if (looksLikeMissingRoute) {
        // This directly answers the common “proxy em produção?” doubt.
        return new Response(
          JSON.stringify({
            error:
              'O proxy respondeu 404 para /api/orders/:orderNumber/boleto. Isso indica que o endpoint /boleto pode não existir na versão do server.js em produção (ou não foi reiniciado corretamente).',
            upstream_status: response.status,
            upstream_preview: responseText?.slice?.(0, 300) || null,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // 404 here often means “no boleto data/payment terms for this order”, not “order doesn't exist”.
      if (response.status === 404) {
        return new Response(
          JSON.stringify({
            error:
              proxyError ||
              'Não encontrei dados de boleto para este pedido no ERP (verifique se a forma de pagamento é boleto e se existem condições de pagamento cadastradas).',
            upstream_status: response.status,
            upstream_preview: responseText?.slice?.(0, 300) || null,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (proxyError) {
        return new Response(
          JSON.stringify({
            error: String(proxyError),
            upstream_status: response.status,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: `Erro ao consultar ERP: ${response.status}`,
          upstream_status: response.status,
          upstream_preview: responseText?.slice?.(0, 300) || null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();
    console.log('[ERP Boleto] Data received:', JSON.stringify(data));

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[ERP Boleto] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        // Avoid non-2xx here so the frontend can show the real message.
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
