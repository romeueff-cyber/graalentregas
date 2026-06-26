import { verifyAuth, corsHeaders } from '../_shared/auth.ts';

const ERP_EMPRESAS = [1, 3];

function companyFromClientProducts(client: Record<string, unknown>): number | null {
  const fields = [
    client.empresa,
    client.company,
    client.last_product,
    client.last_order_product,
    client.ultimo_produto,
    client.produto,
  ];
  const products = Array.isArray(client.items) ? client.items : Array.isArray(client.products) ? client.products : [];
  for (const item of products) {
    if (item && typeof item === 'object') {
      const itemRecord = item as Record<string, unknown>;
      fields.push(itemRecord.product, itemRecord.description, itemRecord.PRODUTO, itemRecord.DESCRICAO);
    } else {
      fields.push(item);
    }
  }
  const text = fields.map((v) => String(v ?? '')).join(' ').toUpperCase();
  if (text.includes('GROTT')) return 3;
  return null;
}

async function inferCompanyFromLastOrder(
  client: Record<string, unknown>,
  erpBaseUrl: string,
  erpApiKey: string,
): Promise<void> {
  const directCompany = Number(client.id_empresa ?? client.ID_EMPRESA);
  if (Number.isFinite(directCompany) && ERP_EMPRESAS.includes(directCompany)) {
    client.id_empresa = directCompany;
    return;
  }

  const fromPayload = companyFromClientProducts(client);
  if (fromPayload != null) {
    client.id_empresa = fromPayload;
    return;
  }

  const clientId = client.id ?? client.ID_CLIENTE ?? client.client_id;
  if (!clientId) {
    client.id_empresa = 1;
    return;
  }

  try {
    const lastTarget = `${erpBaseUrl.replace(/\/$/, '')}/api/clients/${encodeURIComponent(String(clientId))}/last-order`;
    const resp = await fetch(lastTarget, {
      headers: { 'x-api-key': erpApiKey },
      signal: AbortSignal.timeout(4000),
    });
    if (resp.ok) {
      const lastOrder = await resp.json();
      const inferred = companyFromClientProducts(lastOrder as Record<string, unknown>);
      client.id_empresa = inferred ?? 1;
      return;
    }
  } catch (e) {
    console.warn('[list-erp-clients] fallback last-order failed', String(e));
  }

  client.id_empresa = 1;
}

function parseEmpresas(value: string | null): number[] {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => ERP_EMPRESAS.includes(n));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authResult = await verifyAuth(req);
    if ('error' in authResult) return authResult.error;

    const ERP_API_URL = Deno.env.get('ERP_API_URL');
    const ERP_API_KEY = Deno.env.get('ERP_API_KEY');
    if (!ERP_API_URL || !ERP_API_KEY) {
      return new Response(JSON.stringify({ error: 'ERP not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const qs = new URLSearchParams();
    for (const k of ['vendedor_id', 'client_id', 'search', 'limit']) {
      const v = url.searchParams.get(k);
      if (v) qs.set(k, v);
    }

    const { userId, supabase } = authResult;
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    const { data: companies, error: companiesError } = await supabase
      .from('user_companies')
      .select('empresa_id')
      .eq('user_id', userId);
    if (companiesError) throw companiesError;

    const configuredEmpresas = (companies ?? [])
      .map((row) => Number(row.empresa_id))
      .filter((n) => ERP_EMPRESAS.includes(n));

    // Mesmo admin respeita as empresas marcadas no cadastro.
    // Admin sem configuração mantém acesso total para não bloquear usuários antigos.
    const allowedEmpresas = configuredEmpresas.length > 0
      ? configuredEmpresas
      : roleData
        ? ERP_EMPRESAS
        : [];

    const requestedEmpresas = parseEmpresas(url.searchParams.get('empresas'));
    const effectiveEmpresas = requestedEmpresas.length > 0
      ? requestedEmpresas.filter((id) => allowedEmpresas.includes(id))
      : allowedEmpresas;

    if (effectiveEmpresas.length === 0) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    qs.set('empresas', effectiveEmpresas.join(','));

    const target = `${ERP_API_URL.replace(/\/$/, '')}/api/clients?${qs.toString()}`;
    console.log('[list-erp-clients] GET', target);

    const r = await fetch(target, { headers: { 'x-api-key': ERP_API_KEY } });
    const text = await r.text();

    if (!r.ok) {
      return new Response(text, {
        status: r.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let payload: unknown = null;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }

    const enrichList = async (list: unknown[]) => {
      const objects = list.filter((c): c is Record<string, unknown> => !!c && typeof c === 'object') as Record<string, unknown>[];
      const missing = objects.filter((c) => {
        const directCompany = Number(c.id_empresa ?? c.ID_EMPRESA);
        return !Number.isFinite(directCompany) || !ERP_EMPRESAS.includes(directCompany);
      });

      // O endpoint antigo do Node não expõe id_empresa; para busca por cliente,
      // inferimos pelos últimos pedidos somente para um lote inicial, evitando excesso de chamadas.
      const shouldInfer = effectiveEmpresas.includes(3) && (url.searchParams.get('search') || url.searchParams.get('client_id'));
      if (shouldInfer) {
        await Promise.all(missing.slice(0, 80).map((c) => inferCompanyFromLastOrder(c, ERP_API_URL, ERP_API_KEY)));
      }
    };

    const filterClient = (client: unknown) => {
      if (!client || typeof client !== 'object') return false;
      const record = client as Record<string, unknown>;
      const directCompany = Number(record.id_empresa ?? record.ID_EMPRESA);
      let company: number | null = Number.isFinite(directCompany) && ERP_EMPRESAS.includes(directCompany)
        ? directCompany
        : null;

      // O Node antigo ainda pode não retornar id_empresa. Como fallback temporário,
      // classificamos clientes com último produto/descrição contendo GROTT como empresa 3;
      // os demais sem empresa explícita ficam na empresa 1 (Graal).
      if (company == null) company = companyFromClientProducts(record) ?? 1;
      record.id_empresa = company;
      return effectiveEmpresas.includes(company);
    };

    let responseBody = text;
    if (Array.isArray(payload)) {
      await enrichList(payload);
      responseBody = JSON.stringify(payload.filter(filterClient));
    } else if (payload && typeof payload === 'object') {
      const record = payload as { data?: unknown; clients?: unknown };
      if (Array.isArray(record.data)) {
        await enrichList(record.data);
        responseBody = JSON.stringify({ ...record, data: record.data.filter(filterClient) });
      } else if (Array.isArray(record.clients)) {
        await enrichList(record.clients);
        responseBody = JSON.stringify({ ...record, clients: record.clients.filter(filterClient) });
      } else if (!filterClient(record)) {
        responseBody = JSON.stringify([]);
      }
    }

    return new Response(responseBody, {
      status: r.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[list-erp-clients] error', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
