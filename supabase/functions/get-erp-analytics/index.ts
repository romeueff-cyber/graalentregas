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

    console.log(`[get-erp-analytics] Authenticated user: ${authResult.userId}`);
    
    const erpApiUrl = Deno.env.get('ERP_API_URL');
    const erpApiKey = Deno.env.get('ERP_API_KEY');

    if (!erpApiUrl || !erpApiKey) {
      console.error('Missing ERP configuration', { hasUrl: !!erpApiUrl, hasKey: !!erpApiKey });
      return new Response(
        JSON.stringify({ error: 'Configuração da API do ERP não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for date range
    let startDate: string;
    let endDate: string;
    
    try {
      const body = await req.json();
      startDate = body.start_date;
      endDate = body.end_date;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Parâmetros start_date e end_date são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros start_date e end_date são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching analytics for period: ${startDate} to ${endDate}`);

    const url = `${erpApiUrl}/api/orders/analytics?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
    
    const response = await fetch(url, {
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

    const analyticsData = await response.json();
    console.log(`Retrieved ${analyticsData.length || 0} orders for analytics`);

    return new Response(
      JSON.stringify(analyticsData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-erp-analytics function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
