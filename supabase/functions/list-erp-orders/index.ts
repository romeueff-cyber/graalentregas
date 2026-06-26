import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, corsHeaders } from "../_shared/auth.ts";

const ERP_EMPRESAS = [1, 3];

function parseEmpresas(value: unknown): number[] {
  const raw = Array.isArray(value) ? value.join(',') : String(value ?? '');
  return raw
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => ERP_EMPRESAS.includes(n));
}

async function getAllowedEmpresas(authResult: { userId: string; supabase: any }): Promise<number[]> {
  const { userId, supabase } = authResult;

  const { data: companies, error: companiesError } = await supabase
    .from('user_companies')
    .select('empresa_id')
    .eq('user_id', userId);
  if (companiesError) throw companiesError;

  const configured = (companies ?? [])
    .map((row: { empresa_id: unknown }) => Number(row.empresa_id))
    .filter((n: number) => ERP_EMPRESAS.includes(n));

  if (configured.length > 0) return configured;

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();

  return roleData ? ERP_EMPRESAS : [];
}

function companyFromOrder(order: unknown): number | null {
  if (!order || typeof order !== 'object') return null;
  const record = order as Record<string, unknown>;
  const direct = Number(record.id_empresa ?? record.ID_EMPRESA);
  if (Number.isFinite(direct) && ERP_EMPRESAS.includes(direct)) return direct;

  const items = Array.isArray(record.items) ? record.items : [];
  const text = items
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const itemRecord = item as Record<string, unknown>;
      return String(itemRecord.product ?? itemRecord.PRODUTO ?? itemRecord.description ?? '');
    })
    .join(' ')
    .toUpperCase();

  if (text.includes('GROTT')) return 3;
  if (text) return 1;
  return null;
}

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
    let requestedEmpresas: number[] = [];
    try {
      const body = await req.json();
      targetDate = body.date || null;
      requestedEmpresas = parseEmpresas(body.empresas);
    } catch {
      // No body or invalid JSON, use today's date
    }

    const allowedEmpresas = await getAllowedEmpresas(authResult);
    const effectiveEmpresas = requestedEmpresas.length > 0
      ? requestedEmpresas.filter((id) => allowedEmpresas.includes(id))
      : allowedEmpresas;

    if (effectiveEmpresas.length === 0) {
      return new Response(
        JSON.stringify([]),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no date provided, use today in São Paulo timezone (UTC-3)
    if (!targetDate) {
      const now = new Date();
      targetDate = now.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    }

    console.log(`Fetching orders for date: ${targetDate} empresas: ${effectiveEmpresas.join(',')}`);

    const qs = new URLSearchParams({ date: targetDate });
    qs.set('empresas', effectiveEmpresas.join(','));

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
    const safeOrdersData = Array.isArray(ordersData)
      ? ordersData.filter((order) => {
          const company = companyFromOrder(order);
          return company != null && effectiveEmpresas.includes(company);
        }).map((order) => ({
          ...(order as Record<string, unknown>),
          id_empresa: companyFromOrder(order),
        }))
      : [];
    console.log(`Retrieved ${ordersData.length || 0} orders, returning ${safeOrdersData.length}`);

    return new Response(
      JSON.stringify(safeOrdersData),
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
