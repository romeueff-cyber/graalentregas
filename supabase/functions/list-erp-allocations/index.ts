import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const erpApiUrl = Deno.env.get('ERP_API_URL');
    const erpApiKey = Deno.env.get('ERP_API_KEY');

    if (!erpApiUrl || !erpApiKey) {
      return new Response(
        JSON.stringify({ error: 'Configuração do ERP ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const empresas = url.searchParams.get('empresas') ?? '';
    const proxyUrl = `${erpApiUrl}/api/allocations${empresas ? `?empresas=${encodeURIComponent(empresas)}` : ''}`;
    console.log(`[list-erp-allocations] Calling proxy: ${proxyUrl}`);

    const proxyResponse = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'x-api-key': erpApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!proxyResponse.ok) {
      const errorText = await proxyResponse.text();
      console.error(`[list-erp-allocations] Proxy error (${proxyResponse.status}):`, errorText);
      return new Response(
        JSON.stringify({ error: `Erro ao buscar alocações: ${proxyResponse.status}`, details: errorText }),
        { status: proxyResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allocations = await proxyResponse.json();
    console.log(`[list-erp-allocations] Found ${Array.isArray(allocations) ? allocations.length : 0} allocation(s)`);

    return new Response(
      JSON.stringify({ allocations }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[list-erp-allocations] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
