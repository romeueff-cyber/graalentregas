import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, corsHeaders } from "../_shared/auth.ts";

/**
 * Edge Function: validate-equipment-patrimony
 * 
 * Validates if an equipment patrimony exists in the ERP and has status "ALOCADO".
 * This is used before attempting to return equipment to ensure it can be processed.
 * 
 * Request body:
 * - patrimonio: string (required) - The equipment's patrimony number (e.g., "B1004")
 * 
 * Response:
 * - valid: boolean - Whether the equipment can be returned
 * - patrimonio: string - The normalized patrimony
 * - status: string - Current status in ERP (e.g., "ALOCADO", "DISPONIVEL")
 * - message: string - Human-readable message
 * - equipment: object - Equipment details if found
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

    console.log(`[validate-equipment-patrimony] Authenticated user: ${authResult.userId}`);
    
    const erpApiUrl = Deno.env.get('ERP_API_URL');
    const erpApiKey = Deno.env.get('ERP_API_KEY');

    if (!erpApiUrl || !erpApiKey) {
      console.error('[validate-equipment-patrimony] Missing ERP configuration');
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Configuração da API do ERP não encontrada' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const patrimonio = body.patrimonio?.toString().trim().toUpperCase();

    if (!patrimonio) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Patrimônio é obrigatório' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[validate-equipment-patrimony] Validating patrimony: ${patrimonio}`);

    // Call ERP API endpoint to get equipment status
    const response = await fetch(`${erpApiUrl}/api/equipment/${encodeURIComponent(patrimonio)}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': erpApiKey,
        'Content-Type': 'application/json',
      },
    });

    console.log(`[validate-equipment-patrimony] ERP API response status: ${response.status}`);

    if (response.status === 404) {
      console.log(`[validate-equipment-patrimony] Equipment ${patrimonio} not found in ERP`);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          patrimonio,
          status: null,
          message: `Patrimônio ${patrimonio} não encontrado no sistema` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[validate-equipment-patrimony] ERP API error:', errorText);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          patrimonio,
          message: 'Erro ao consultar equipamento no ERP' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const equipment = await response.json();
    console.log('[validate-equipment-patrimony] Equipment data:', equipment);

    // Check if status is ALOCADO (only allocated equipment can be returned)
    const status = equipment.status?.toUpperCase() || equipment.STATUS?.toUpperCase();
    const isAlocado = status === 'ALOCADO';

    if (!isAlocado) {
      console.log(`[validate-equipment-patrimony] Equipment ${patrimonio} has status ${status}, not ALOCADO`);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          patrimonio,
          status,
          message: `Patrimônio ${patrimonio} não está alocado (status: ${status || 'desconhecido'})`,
          equipment 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[validate-equipment-patrimony] Equipment ${patrimonio} is valid for return`);
    return new Response(
      JSON.stringify({ 
        valid: true, 
        patrimonio,
        status,
        message: `Patrimônio ${patrimonio} está alocado e pode ser devolvido`,
        equipment 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[validate-equipment-patrimony] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({ 
        valid: false, 
        message: `Erro ao validar equipamento: ${errorMessage}` 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
