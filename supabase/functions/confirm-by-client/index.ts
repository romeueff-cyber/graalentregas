import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Token validity in days
const TOKEN_VALIDITY_DAYS = 30;

interface ConfirmRequest {
  token: string;
  data_prevista_recolha: string;
  periodo_recolha: 'DIA_TODO' | 'MANHA' | 'TARDE' | 'NOITE';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only accept POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ConfirmRequest = await req.json();
    const { token, data_prevista_recolha, periodo_recolha } = body;

    // Validate inputs - check token exists and is proper UUID format
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!token || typeof token !== 'string' || !UUID_REGEX.test(token)) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data_prevista_recolha || !periodo_recolha) {
      return new Response(
        JSON.stringify({ error: 'Data e período são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data_prevista_recolha)) {
      return new Response(
        JSON.stringify({ error: 'Formato de data inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate period
    const validPeriods = ['DIA_TODO', 'MANHA', 'TARDE', 'NOITE'];
    if (!validPeriods.includes(periodo_recolha)) {
      return new Response(
        JSON.stringify({ error: 'Período inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for bypassing RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find equipment by token (not used yet)
    const { data: equipment, error: fetchError } = await supabase
      .from('equipments')
      .select('id, nome_cliente, pedido_dia, token_used_at, cliente_ira_avisar, token_created_at')
      .eq('confirmation_token', token)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching equipment:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar equipamento' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!equipment) {
      return new Response(
        JSON.stringify({ error: 'Link inválido ou expirado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    if (equipment.token_created_at) {
      const tokenAge = Date.now() - new Date(equipment.token_created_at).getTime();
      const maxAge = TOKEN_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
      
      if (tokenAge > maxAge) {
        console.log(`Token expired for equipment ${equipment.id}. Token age: ${Math.floor(tokenAge / (24 * 60 * 60 * 1000))} days`);
        return new Response(
          JSON.stringify({ 
            error: 'Este link expirou. Entre em contato com o entregador para receber um novo link.',
            expired: true 
          }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if token was already used
    if (equipment.token_used_at) {
      return new Response(
        JSON.stringify({ error: 'Este link já foi utilizado', already_confirmed: true }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update equipment status
    const { error: updateError } = await supabase
      .from('equipments')
      .update({
        status: 'LIBERADO_PARA_RECOLHA',
        data_prevista_recolha,
        periodo_recolha,
        cliente_ira_avisar: false, // No longer waiting for client
        token_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', equipment.id);

    if (updateError) {
      console.error('Error updating equipment:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao confirmar liberação' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Equipment ${equipment.id} confirmed by client. New date: ${data_prevista_recolha}, period: ${periodo_recolha}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Liberação confirmada com sucesso!',
        cliente: equipment.nome_cliente,
        pedido: equipment.pedido_dia
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
