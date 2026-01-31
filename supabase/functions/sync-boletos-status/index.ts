import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cora API URLs
const CORA_TOKEN_URL_PROD = 'https://matls-clients.api.cora.com.br/token';
const CORA_API_URL_PROD = 'https://matls-clients.api.cora.com.br';

interface CoraTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface CoraInvoice {
  id: string;
  code: string;
  status: string;
  payment?: {
    paid_at?: string;
    amount?: number;
  };
}

// Cache for access token
let cachedToken: { token: string; expiresAt: number } | null = null;

// Normalize PEM content
function normalizePEM(content: string, type: 'CERTIFICATE' | 'RSA PRIVATE KEY'): string {
  const header = `-----BEGIN ${type}-----`;
  const footer = `-----END ${type}-----`;
  
  let processed = content.replace(/\\n/g, '\n');
  processed = processed
    .replace(new RegExp(`-----BEGIN ${type}-----`, 'gi'), '')
    .replace(new RegExp(`-----END ${type}-----`, 'gi'), '');
  
  const base64 = processed.replace(/[\s\r\n]+/g, '');
  
  if (base64.length === 0) {
    throw new Error(`${type} está vazio ou inválido`);
  }
  
  const lines = base64.match(/.{1,64}/g) || [];
  return `${header}\n${lines.join('\n')}\n${footer}`;
}

function getCredentials(): { clientId: string; certificate: string; privateKey: string } {
  const clientId = Deno.env.get('CORA_CLIENT_ID');
  const rawCertificate = Deno.env.get('CORA_CERTIFICATE');
  const rawPrivateKey = Deno.env.get('CORA_PRIVATE_KEY');

  if (!clientId || !rawCertificate || !rawPrivateKey) {
    throw new Error('Credenciais da Cora não configuradas');
  }

  const certificate = normalizePEM(rawCertificate, 'CERTIFICATE');
  const privateKey = normalizePEM(rawPrivateKey, 'RSA PRIVATE KEY');

  return { clientId, certificate, privateKey };
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    console.log('[SyncBoletos] Using cached access token');
    return cachedToken.token;
  }

  const { clientId, certificate, privateKey } = getCredentials();

  console.log('[SyncBoletos] Requesting new access token');

  const httpClient = Deno.createHttpClient({
    cert: certificate,
    key: privateKey,
  });

  try {
    const response = await fetch(CORA_TOKEN_URL_PROD, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}`,
      client: httpClient,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SyncBoletos] Token error:', errorText);
      throw new Error(`Erro ao obter token da Cora: ${response.status}`);
    }

    const data: CoraTokenResponse = await response.json();
    
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };

    return data.access_token;
  } finally {
    httpClient.close();
  }
}

async function fetchInvoiceStatus(invoiceId: string): Promise<CoraInvoice | null> {
  const { certificate, privateKey } = getCredentials();
  const accessToken = await getAccessToken();

  const httpClient = Deno.createHttpClient({
    cert: certificate,
    key: privateKey,
  });

  try {
    const response = await fetch(`${CORA_API_URL_PROD}/v2/invoices/${invoiceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      client: httpClient,
    });

    if (!response.ok) {
      console.error(`[SyncBoletos] Failed to fetch invoice ${invoiceId}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`[SyncBoletos] Error fetching invoice ${invoiceId}:`, error);
    return null;
  } finally {
    httpClient.close();
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all non-paid, non-cancelled boletos
    const { data: pendingBoletos, error: fetchError } = await supabase
      .from('boletos')
      .select('id, cora_invoice_id, status, order_number')
      .not('status', 'in', '("PAID","CANCELLED")');

    if (fetchError) {
      throw new Error(`Erro ao buscar boletos: ${fetchError.message}`);
    }

    console.log(`[SyncBoletos] Found ${pendingBoletos?.length || 0} pending boletos to sync`);

    const results = {
      synced: 0,
      updated: 0,
      newlyPaid: [] as { order_number: string; id: string }[],
      errors: 0,
    };

    if (pendingBoletos && pendingBoletos.length > 0) {
      for (const boleto of pendingBoletos) {
        const coraInvoice = await fetchInvoiceStatus(boleto.cora_invoice_id);
        
        if (!coraInvoice) {
          results.errors++;
          continue;
        }

        results.synced++;

        // Map Cora status to our status
        const newStatus = coraInvoice.status.toUpperCase();
        
        if (newStatus !== boleto.status.toUpperCase()) {
          console.log(`[SyncBoletos] Updating ${boleto.order_number}: ${boleto.status} -> ${newStatus}`);
          
          const { error: updateError } = await supabase
            .from('boletos')
            .update({ 
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', boleto.id);

          if (updateError) {
            console.error(`[SyncBoletos] Error updating ${boleto.order_number}:`, updateError);
            results.errors++;
          } else {
            results.updated++;
            
            // Track newly paid boletos for alert
            if (newStatus === 'PAID') {
              results.newlyPaid.push({
                order_number: boleto.order_number,
                id: boleto.id,
              });
            }
          }
        }
      }
    }

    console.log(`[SyncBoletos] Sync complete:`, results);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[SyncBoletos] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
