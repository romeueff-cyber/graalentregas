import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth check
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('[get-client-equipment] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { clientId } = await req.json();
    if (!clientId || !/^[A-Za-z0-9_-]+$/.test(String(clientId))) {
      return new Response(
        JSON.stringify({ error: 'clientId inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[get-client-equipment] Fetching equipment for client ID: ${clientId}`);

    // Call ERP proxy
    const erpApiUrl = Deno.env.get('ERP_API_URL');
    const erpApiKey = Deno.env.get('ERP_API_KEY');

    if (!erpApiUrl || !erpApiKey) {
      console.error('[get-client-equipment] Missing ERP_API_URL or ERP_API_KEY');
      return new Response(
        JSON.stringify({ error: 'Configuração do ERP ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const proxyUrl = `${erpApiUrl}/api/clients/${encodeURIComponent(String(clientId))}/equipment`;
    console.log(`[get-client-equipment] Calling proxy: ${proxyUrl}`);

    const proxyResponse = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'x-api-key': erpApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!proxyResponse.ok) {
      const errorText = await proxyResponse.text();
      console.error(`[get-client-equipment] Proxy error (${proxyResponse.status}):`, errorText);
      return new Response(
        JSON.stringify({ 
          error: `Erro ao buscar equipamentos: ${proxyResponse.status}`,
          details: errorText 
        }),
        { status: proxyResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const equipments = await proxyResponse.json();
    console.log(`[get-client-equipment] Found ${equipments.length} equipment(s) for client ${clientId}`);

    return new Response(
      JSON.stringify({ equipments }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[get-client-equipment] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
