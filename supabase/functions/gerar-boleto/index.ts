import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, corsHeaders } from "../_shared/auth.ts";

// Cora API URLs - all mTLS endpoints
const CORA_TOKEN_URL_STAGE = 'https://matls-clients.api.stage.cora.com.br/token';
const CORA_TOKEN_URL_PROD = 'https://matls-clients.api.cora.com.br/token';
const CORA_API_URL_STAGE = 'https://matls-clients.api.stage.cora.com.br';
const CORA_API_URL_PROD = 'https://matls-clients.api.cora.com.br';

interface BoletoRequest {
  orderNumber: string;
  customer: {
    name: string;
    document: string;
    documentType?: 'CPF' | 'CNPJ';
    email?: string;
    address?: {
      street: string;
      number: string;
      district: string;
      city: string;
      state: string;
      complement?: string;
      zipCode: string;
    };
  };
  services: {
    name: string;
    description: string;
    amount: number; // in cents
  }[];
  dueDate: string; // YYYY-MM-DD
  fine?: {
    rate?: number; // percentage
    amount?: number; // in cents
  };
  interest?: {
    rate: number; // percentage
  };
  discount?: {
    type: 'FIXED' | 'PERCENT';
    value: number;
  };
  notification?: {
    name: string;
    email?: string;
    phone?: string;
    rules?: string[];
  };
}

interface CoraTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

// Cache for access token
let cachedToken: { token: string; expiresAt: number } | null = null;

// Normalize PEM content (handle various formats from secrets)
function normalizePEM(content: string, type: 'CERTIFICATE' | 'RSA PRIVATE KEY'): string {
  const header = `-----BEGIN ${type}-----`;
  const footer = `-----END ${type}-----`;
  
  // Log raw content length for debugging
  console.log(`[Cora] Normalizing ${type}, raw length: ${content.length}`);
  
  // Handle escaped newlines (\\n) that might come from environment variables
  let processed = content.replace(/\\n/g, '\n');
  
  // Remove existing headers/footers
  processed = processed
    .replace(new RegExp(`-----BEGIN ${type}-----`, 'gi'), '')
    .replace(new RegExp(`-----END ${type}-----`, 'gi'), '');
  
  // Remove all whitespace and newlines to get pure base64
  const base64 = processed.replace(/[\s\r\n]+/g, '');
  
  console.log(`[Cora] ${type} base64 length: ${base64.length}`);
  
  // Validate base64 content
  if (base64.length === 0) {
    throw new Error(`${type} está vazio ou inválido`);
  }
  
  // Split into 64-character lines (PEM standard)
  const lines = base64.match(/.{1,64}/g) || [];
  
  const result = `${header}\n${lines.join('\n')}\n${footer}`;
  console.log(`[Cora] ${type} normalized, total lines: ${lines.length + 2}`);
  
  return result;
}

function getCredentials(): { clientId: string; certificate: string; privateKey: string } {
  const clientId = Deno.env.get('CORA_CLIENT_ID');
  const rawCertificate = Deno.env.get('CORA_CERTIFICATE');
  const rawPrivateKey = Deno.env.get('CORA_PRIVATE_KEY');

  if (!clientId) {
    throw new Error('CORA_CLIENT_ID não configurado');
  }
  if (!rawCertificate) {
    throw new Error('CORA_CERTIFICATE não configurado');
  }
  if (!rawPrivateKey) {
    throw new Error('CORA_PRIVATE_KEY não configurado');
  }

  console.log('[Cora] Credentials loaded successfully');

  const certificate = normalizePEM(rawCertificate, 'CERTIFICATE');
  const privateKey = normalizePEM(rawPrivateKey, 'RSA PRIVATE KEY');

  return { clientId, certificate, privateKey };
}

async function getAccessToken(isProduction: boolean): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    console.log('[Cora] Using cached access token');
    return cachedToken.token;
  }

  const { clientId, certificate, privateKey } = getCredentials();

  const tokenUrl = isProduction ? CORA_TOKEN_URL_PROD : CORA_TOKEN_URL_STAGE;

  console.log(`[Cora] Requesting new access token from ${tokenUrl}`);

  // Use Deno.createHttpClient for mTLS with client certificate
  const httpClient = Deno.createHttpClient({
    cert: certificate,
    key: privateKey,
  });

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}`,
      client: httpClient,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Cora] Token error:', errorText);
      throw new Error(`Erro ao obter token da Cora: ${response.status}`);
    }

    const data: CoraTokenResponse = await response.json();
    
    // Cache the token
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };

    console.log('[Cora] Access token obtained successfully');
    return data.access_token;
  } finally {
    httpClient.close();
  }
}

async function createBoleto(
  request: BoletoRequest,
  isProduction: boolean
): Promise<unknown> {
  const apiUrl = isProduction ? CORA_API_URL_PROD : CORA_API_URL_STAGE;
  const endpoint = `${apiUrl}/v2/invoices/`;

  console.log(`[Cora] Creating boleto at ${endpoint}`);

  // Get credentials for mTLS
  const { certificate, privateKey } = getCredentials();

  // Get access token first
  const accessToken = await getAccessToken(isProduction);

  // Sanitize document type (remove extra spaces from ERP data)
  const cleanDocument = request.customer.document.replace(/\D/g, '');
  const cleanDocumentType = request.customer.documentType?.trim().toUpperCase() || 
    (cleanDocument.length <= 11 ? 'CPF' : 'CNPJ');

  // Build the request body according to Cora API spec
  // Append a short unique suffix to the code to avoid CIP conflicts when a
  // previous boleto with the same code was cancelled (Cora REC-0030).
  const uniqueSuffix = Date.now().toString(36).slice(-5).toUpperCase();
  const uniqueCode = `${request.orderNumber}-${uniqueSuffix}`.substring(0, 40);

  const body: Record<string, unknown> = {
    code: uniqueCode,
    customer: {
      name: request.customer.name.substring(0, 60),
      document: {
        identity: cleanDocument,
        type: cleanDocumentType,
      },
    },
    services: request.services.map(service => ({
      name: service.name,
      description: service.description.substring(0, 100),
      amount: service.amount,
    })),
    payment_terms: {
      due_date: request.dueDate,
    },
  };

  // Add optional customer fields
  if (request.customer.email) {
    (body.customer as Record<string, unknown>).email = request.customer.email.substring(0, 60);
  }

  // Only add address if zipCode is valid (not all zeros and has 8 digits)
  if (request.customer.address) {
    const cleanZipCode = request.customer.address.zipCode.replace(/\D/g, '');
    const isValidZipCode = cleanZipCode.length === 8 && cleanZipCode !== '00000000';
    
    if (isValidZipCode) {
      (body.customer as Record<string, unknown>).address = {
        street: request.customer.address.street,
        number: request.customer.address.number,
        district: request.customer.address.district,
        city: request.customer.address.city,
        state: request.customer.address.state.substring(0, 2).toUpperCase(),
        complement: request.customer.address.complement || '',
        zip_code: cleanZipCode,
      };
    } else {
      console.log('[Cora] Skipping address - invalid zipCode:', cleanZipCode);
    }
  }

  // Add optional payment terms
  const paymentTerms = body.payment_terms as Record<string, unknown>;
  
  if (request.fine) {
    paymentTerms.fine = {};
    if (request.fine.amount) {
      (paymentTerms.fine as Record<string, unknown>).amount = request.fine.amount;
    } else if (request.fine.rate) {
      (paymentTerms.fine as Record<string, unknown>).rate = request.fine.rate;
    }
  }

  if (request.interest) {
    paymentTerms.interest = {
      rate: request.interest.rate,
    };
  }

  if (request.discount) {
    paymentTerms.discount = {
      type: request.discount.type,
      value: request.discount.value,
    };
  }

  // NOTE: Notification feature temporarily disabled - Cora API returns 400
  // The notification format may need adjustment per Cora's current API spec
  // TODO: Review Cora API documentation for correct notification structure

  // Generate idempotency key from order number
  const idempotencyKey = crypto.randomUUID();

  // Use mTLS for API call too
  const httpClient = Deno.createHttpClient({
    cert: certificate,
    key: privateKey,
  });

  try {
    console.log('[Cora] Request payload:', JSON.stringify(body, null, 2));
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
      client: httpClient,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Cora] Boleto creation error:', response.status, errorText);
      
      if (response.status === 401) {
        // Clear cached token on auth error
        cachedToken = null;
        throw new Error('Token de acesso expirado. Tente novamente.');
      }
      
      throw new Error(`Erro ao criar boleto: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[Cora] Boleto created successfully:', result.id);
    
    return result;
  } finally {
    httpClient.close();
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication (any authenticated user)
    const authResult = await verifyAuth(req);
    if ('error' in authResult) {
      return authResult.error;
    }

    console.log(`[Cora] Authenticated user: ${authResult.userId}`);

    const requestBody = await req.json();
    const { action, ...params } = requestBody;

    // Only admin/financeiro can create or cancel boletos
    if (action === 'create' || action === 'cancel') {
      const { data: roleRow } = await authResult.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authResult.userId)
        .in('role', ['admin', 'financeiro'])
        .maybeSingle();
      if (!roleRow) {
        return new Response(
          JSON.stringify({ error: 'Acesso negado. Somente admin/financeiro.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }


    // Use stage by default, production only when explicitly set
    const isProduction = params.production === true;
    console.log(`[Cora] Using ${isProduction ? 'PRODUCTION' : 'STAGE'} environment`);

    if (action === 'create') {
      const boletoRequest = params as BoletoRequest;

      // Validate required fields
      if (!boletoRequest.orderNumber) {
        throw new Error('Número do pedido é obrigatório');
      }
      if (!boletoRequest.customer?.name || !boletoRequest.customer?.document) {
        throw new Error('Nome e documento do cliente são obrigatórios');
      }
      if (!boletoRequest.services?.length) {
        throw new Error('É necessário informar ao menos um serviço');
      }
      if (!boletoRequest.dueDate) {
        throw new Error('Data de vencimento é obrigatória');
      }

      // Validate minimum amount (R$ 5,00 = 500 cents)
      const totalAmount = boletoRequest.services.reduce((sum, s) => sum + s.amount, 0);
      if (totalAmount < 500) {
        throw new Error('Valor mínimo do boleto é R$ 5,00');
      }

      // Create boleto
      const result = await createBoleto(boletoRequest, isProduction);

      return new Response(
        JSON.stringify(result),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (action === 'get') {
      const { invoiceId } = params;
      
      if (!invoiceId) {
        throw new Error('ID do boleto é obrigatório');
      }

      const accessToken = await getAccessToken(isProduction);
      const apiUrl = isProduction ? CORA_API_URL_PROD : CORA_API_URL_STAGE;
      
      const response = await fetch(`${apiUrl}/v2/invoices/${invoiceId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao consultar boleto: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      return new Response(
        JSON.stringify(result),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (action === 'cancel') {
      const { invoiceId } = params;
      
      if (!invoiceId) {
        throw new Error('ID do boleto é obrigatório');
      }

      console.log(`[Cora] Canceling invoice: ${invoiceId}`);
      
      const { certificate, privateKey } = getCredentials();
      const accessToken = await getAccessToken(isProduction);
      const apiUrl = isProduction ? CORA_API_URL_PROD : CORA_API_URL_STAGE;
      
      // Use mTLS for the cancel request
      const httpClient = Deno.createHttpClient({
        cert: certificate,
        key: privateKey,
      });

      try {
        // Cora API uses DELETE to cancel/void an invoice
        const response = await fetch(`${apiUrl}/v2/invoices/${invoiceId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          client: httpClient,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Cora] Cancel error:', response.status, errorText);
          
          // Check if it's already canceled or paid
          if (response.status === 400 || response.status === 422) {
            throw new Error('Não é possível cancelar este boleto. Ele pode já estar pago ou cancelado.');
          }
          
          throw new Error(`Erro ao cancelar boleto: ${response.status} - ${errorText}`);
        }

        console.log('[Cora] Invoice canceled successfully');
        
        return new Response(
          JSON.stringify({ success: true, message: 'Boleto cancelado com sucesso' }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      } finally {
        httpClient.close();
      }
    }

    throw new Error(`Ação não reconhecida: ${action}`);

  } catch (error) {
    console.error('[Cora] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        // Avoid non-2xx so supabase-js doesn't collapse the message into a generic "non-2xx" error.
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
