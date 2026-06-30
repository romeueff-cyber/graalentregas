import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, corsHeaders } from "../_shared/auth.ts";

/**
 * Edge Function: update-erp-equipment-status
 * 
 * Updates equipment status in the ERP Firebird database when a collection is confirmed.
 * This function updates TWO tables:
 * 1. EQUIPAMENTOS.STATUS = 'DISPONIVEL'
 * 2. EQUIP_FATURAMENTOS.ID_STATUS = 10 (RETORNADO)
 * 
 * Request body:
 * - patrimonio: string (required) - The equipment's patrimony number (e.g., "B1004")
 * - orderNumber: string (optional) - The order number to help identify the billing record
 */
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

    // Restrict to admin/entregador
    const { data: roleRow } = await authResult.supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', authResult.userId)
      .in('role', ['admin', 'entregador'])
      .maybeSingle();
    if (!roleRow) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[update-erp-equipment-status] Authenticated user: ${authResult.userId}`);
    
    const erpApiUrl = Deno.env.get('ERP_API_URL');
    const erpApiKey = Deno.env.get('ERP_API_KEY');

    if (!erpApiUrl || !erpApiKey) {
      console.error('Missing ERP configuration', { hasUrl: !!erpApiUrl, hasKey: !!erpApiKey });
      return new Response(
        JSON.stringify({ error: 'Configuração da API do ERP não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { patrimonio, orderNumber } = await req.json();

    if (!patrimonio) {
      return new Response(
        JSON.stringify({ error: 'Patrimônio do equipamento é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[update-erp-equipment-status] Updating equipment ${patrimonio} to DISPONIVEL, order: ${orderNumber || 'N/A'}`);

    // Call ERP API endpoint to release equipment
    const response = await fetch(`${erpApiUrl}/api/equipment/${encodeURIComponent(patrimonio)}/release`, {
      method: 'PUT',
      headers: {
        'X-API-KEY': erpApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        patrimonio,
        orderNumber,
        // Status ID 10 = RETORNADO in EQUIP_FATURAMENTOS
        statusId: 10 
      }),
    });

    console.log(`[update-erp-equipment-status] ERP API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[update-erp-equipment-status] ERP API error:', errorText);
      
      // Don't fail the whole operation - equipment was already collected in Supabase
      // Just log the error and return a warning
      return new Response(
        JSON.stringify({ 
          success: false, 
          warning: 'Equipamento recolhido no sistema, mas erro ao atualizar ERP',
          details: errorText 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    console.log('[update-erp-equipment-status] Equipment status updated successfully:', result);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[update-erp-equipment-status] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Return success with warning - don't block the collection confirmation
    return new Response(
      JSON.stringify({ 
        success: false, 
        warning: 'Equipamento recolhido, mas falha ao sincronizar com ERP',
        details: errorMessage 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
