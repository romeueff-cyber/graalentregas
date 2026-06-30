import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const u = new URL(req.url);
    const token = u.searchParams.get('token');
    if (!token) return json({ error: 'token obrigatório' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data, error } = await admin
      .from('pre_vendas')
      .select('id, token, vendedor_nome, id_empresa, status, expires_at, submitted_at, nome, cpf_cnpj, telefone, email, endereco_cadastro, endereco_entrega, usar_mesmo_endereco, horario_entrega, tolerancia_min, observacoes')
      .eq('token', token)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: 'not_found' }, 404);

    const expired = new Date(data.expires_at).getTime() < Date.now();
    if (expired && data.status === 'pendente') {
      await admin.from('pre_vendas').update({ status: 'expirado' }).eq('id', data.id);
      data.status = 'expirado';
    }

    return json({ ok: true, prevenda: data });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
