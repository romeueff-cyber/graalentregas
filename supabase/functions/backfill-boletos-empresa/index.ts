import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, corsHeaders } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authResult = await verifyAuth(req);
    if ('error' in authResult) return authResult.error;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Admin only
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: authResult.userId,
      _role: 'admin',
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const erpApiUrl = Deno.env.get('ERP_API_URL');
    const erpApiKey = Deno.env.get('ERP_API_KEY');
    if (!erpApiUrl || !erpApiKey) throw new Error('ERP não configurado');

    // Buscar todos os boletos (paginação simples)
    const { data: boletos, error } = await supabase
      .from('boletos')
      .select('id, order_number, id_empresa')
      .limit(5000);
    if (error) throw error;

    // Cache por order_number base (sem -1/-2)
    const cache = new Map<string, number | null>();
    let updated = 0;
    let notFound = 0;
    let errors = 0;

    for (const b of boletos || []) {
      const baseOrder = String(b.order_number).split('-')[0];
      let idEmpresa = cache.get(baseOrder);
      if (idEmpresa === undefined) {
        try {
          const r = await fetch(`${erpApiUrl}/api/orders/${encodeURIComponent(baseOrder)}/boleto`, {
            headers: { 'x-api-key': erpApiKey },
          });
          if (r.ok) {
            const j = await r.json();
            idEmpresa = j.id_empresa ?? null;
          } else {
            idEmpresa = null;
            notFound++;
          }
        } catch (e) {
          console.error('ERP error', baseOrder, e);
          idEmpresa = null;
          errors++;
        }
        cache.set(baseOrder, idEmpresa);
      }

      if (idEmpresa != null && idEmpresa !== b.id_empresa) {
        const { error: upErr } = await supabase
          .from('boletos')
          .update({ id_empresa: idEmpresa })
          .eq('id', b.id);
        if (upErr) {
          errors++;
          console.error('update error', b.id, upErr);
        } else {
          updated++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: boletos?.length || 0,
        updated,
        notFound,
        errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('backfill error', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'erro' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
