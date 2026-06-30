import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface Payload {
  token: string;
  nome: string;
  cpf_cnpj: string;
  telefone?: string;
  email?: string;
  endereco_cadastro: string;
  endereco_cadastro_lat?: number | null;
  endereco_cadastro_lng?: number | null;
  usar_mesmo_endereco: boolean;
  endereco_entrega?: string;
  endereco_entrega_lat?: number | null;
  endereco_entrega_lng?: number | null;
  horario_entrega?: string;
  tolerancia_min?: number;
  observacoes?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = (await req.json()) as Payload;
    if (!body?.token) return json({ error: 'token obrigatório' }, 400);
    if (!body.nome?.trim() || !body.cpf_cnpj?.trim() || !body.endereco_cadastro?.trim()) {
      return json({ error: 'Nome, CPF/CNPJ e endereço são obrigatórios' }, 400);
    }
    if (body.nome.length > 200 || body.cpf_cnpj.length > 30) return json({ error: 'campos muito longos' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: row, error: e1 } = await admin
      .from('pre_vendas')
      .select('id, status, expires_at')
      .eq('token', body.token)
      .maybeSingle();
    if (e1) return json({ error: e1.message }, 500);
    if (!row) return json({ error: 'link inválido' }, 404);
    if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: 'link expirado' }, 410);
    if (row.status !== 'pendente') return json({ error: 'link já utilizado' }, 409);

    const usarMesmo = !!body.usar_mesmo_endereco;
    const enderecoEntrega = usarMesmo ? body.endereco_cadastro : (body.endereco_entrega ?? '');
    const latEntrega = usarMesmo ? body.endereco_cadastro_lat ?? null : body.endereco_entrega_lat ?? null;
    const lngEntrega = usarMesmo ? body.endereco_cadastro_lng ?? null : body.endereco_entrega_lng ?? null;

    const { error: e2 } = await admin
      .from('pre_vendas')
      .update({
        nome: body.nome.trim(),
        cpf_cnpj: body.cpf_cnpj.trim(),
        telefone: body.telefone?.trim() || null,
        email: body.email?.trim() || null,
        endereco_cadastro: body.endereco_cadastro.trim(),
        endereco_cadastro_lat: body.endereco_cadastro_lat ?? null,
        endereco_cadastro_lng: body.endereco_cadastro_lng ?? null,
        usar_mesmo_endereco: usarMesmo,
        endereco_entrega: enderecoEntrega,
        endereco_entrega_lat: latEntrega,
        endereco_entrega_lng: lngEntrega,
        horario_entrega: body.horario_entrega ?? null,
        tolerancia_min: body.tolerancia_min ?? 30,
        observacoes: body.observacoes?.trim() || null,
        status: 'enviado',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (e2) return json({ error: e2.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
