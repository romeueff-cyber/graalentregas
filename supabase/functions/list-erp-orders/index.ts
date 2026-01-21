import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const erpApiUrl = Deno.env.get('ERP_API_URL');
    const erpApiKey = Deno.env.get('ERP_API_KEY');

    if (!erpApiUrl || !erpApiKey) {
      console.error('Missing ERP configuration', { hasUrl: !!erpApiUrl, hasKey: !!erpApiKey });
      return new Response(
        JSON.stringify({ error: 'Configuração da API do ERP não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for optional date filter
    let targetDate: string | null = null;
    try {
      const body = await req.json();
      targetDate = body.date || null;
    } catch {
      // No body or invalid JSON, use today's date
    }

    // If no date provided, use today
    if (!targetDate) {
      const today = new Date();
      targetDate = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    console.log(`Fetching orders for date: ${targetDate}`);

    const response = await fetch(`${erpApiUrl}/api/orders?date=${encodeURIComponent(targetDate)}`, {
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
