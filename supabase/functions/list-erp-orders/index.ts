import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, corsHeaders } from "../_shared/auth.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authResult = await verifyAuth(req);
    if ('error' in authResult) {
      return authResult.error;
    }

    console.log(`[list-erp-orders] Authenticated user: ${authResult.userId}`);
    
    const erpApiUrl = Deno.env.get('ERP_API_URL');
    const erpApiKey = Deno.env.get('ERP_API_KEY');

    if (!erpApiUrl || !erpApiKey) {
      console.error('Missing ERP configuration', { hasUrl: !!erpApiUrl, hasKey: !!erpApiKey });
      return new Response(
        JSON.stringify({ error: 'Configuração da API do ERP não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for optional date filter and empresas
    let targetDate: string | null = null;
    let empresas: string | null = null;
    try {
      const body = await req.json();
      targetDate = body.date || null;
      if (Array.isArray(body.empresas) && body.empresas.length > 0) {
        empresas = body.empresas.join(',');
      } else if (typeof body.empresas === 'string' && body.empresas) {
        empresas = body.empresas;
      }
    } catch {
      // No body or invalid JSON, use today's date
    }

    // If no date provided, use today in São Paulo timezone (UTC-3)
    if (!targetDate) {
      const now = new Date();
      targetDate = now.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    }

    console.log(`Fetching orders for date: ${targetDate} empresas: ${empresas ?? 'all'}`);

    const qs = new URLSearchParams({ date: targetDate });
    if (empresas) qs.set('empresas', empresas);

    const response = await fetch(`${erpApiUrl}/api/orders?${qs.toString()}`, {

      method: 'GET',
      headers: {
        'X-API-KEY': erpApiKey,
        'Content-Type': 'application/json',
      },
    });

    console.log(`ERP API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ERP API error:', errorText);
      
      return new Response(
        JSON.stringify({ error: 'Erro ao consultar o ERP', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ordersData = await response.json();
    console.log(`Retrieved ${ordersData.length || 0} orders`);

    return new Response(
      JSON.stringify(ordersData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in list-erp-orders function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
