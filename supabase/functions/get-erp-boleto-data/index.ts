import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, corsHeaders } from "../_shared/auth.ts";

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function hasAnyAddressDetails(data: any): boolean {
  const address = data?.address_details;
  return Boolean(address && (address.street || address.neighborhood || address.city || address.state || address.zip_code));
}

function mergeOrderAddressDetails(data: any, orderData: any) {
  const orderAddress = orderData?.address_details || orderData?.address || {};

  return {
    ...data,
    address: data?.address || orderData?.address || null,
    location: data?.location || orderData?.location || null,
    address_details: {
      street: data?.address_details?.street || orderAddress.street || '',
      number: data?.address_details?.number || orderAddress.number || '',
      complement: data?.address_details?.complement || orderAddress.complement || '',
      neighborhood: data?.address_details?.neighborhood || orderAddress.neighborhood || '',
      city: data?.address_details?.city || orderAddress.city || '',
      state: data?.address_details?.state || orderAddress.state || '',
      zip_code: data?.address_details?.zip_code || orderAddress.zip_code || orderAddress.zipCode || '',
    },
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication (any authenticated user)
    const authResult = await verifyAuth(req);
    if ('error' in authResult) {
      return authResult.error;
    }

    console.log(`[get-erp-boleto-data] Authenticated user: ${authResult.userId}`);
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

    let data = await response.json();

    // Some deployed ERP proxies still return the boleto payload without address.
    // Query the regular order endpoint as fallback so the frontend can send a
    // complete customer address to Cora and avoid REC-0030.
    if (!hasAnyAddressDetails(data)) {
      try {
        const orderResponse = await fetch(`${erpApiUrl}/api/orders/${encodeURIComponent(orderNumber)}`, {
          method: 'GET',
          headers: {
            'x-api-key': erpApiKey,
            'Content-Type': 'application/json',
          },
        });

        if (orderResponse.ok) {
          const orderData = await orderResponse.json();
          data = mergeOrderAddressDetails(data, orderData);
        } else {
          await orderResponse.text();
        }
      } catch (fallbackError) {
        console.warn('[ERP Boleto] Address fallback failed:', fallbackError instanceof Error ? fallbackError.message : fallbackError);
      }
    }

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
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
