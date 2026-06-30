import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const idEmpresa = Number(body?.id_empresa);
    if (!idEmpresa) return json({ error: 'id_empresa obrigatório' }, 400);

    const admin = createClient(url, svc);
    const { data: profile } = await admin.from('profiles').select('name').eq('id', userId).maybeSingle();

    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await admin
      .from('pre_vendas')
      .insert({
        token,
        vendedor_id: userId,
        vendedor_nome: profile?.name ?? null,
        id_empresa: idEmpresa,
        expires_at: expiresAt,
        status: 'pendente',
      })
      .select('id, token, expires_at')
      .single();
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, id: data.id, token: data.token, expires_at: data.expires_at });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
