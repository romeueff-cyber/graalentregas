import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  console.log(`[Cora] Client ID: ${clientId.substring(0, 10)}...`);

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

  // Build the request body according to Cora API spec
  const body: Record<string, unknown> = {
    code: request.orderNumber,
    customer: {
      name: request.customer.name.substring(0, 60),
      document: {
        identity: request.customer.document.replace(/\D/g, ''),
        type: request.customer.documentType || 
          (request.customer.document.replace(/\D/g, '').length <= 11 ? 'CPF' : 'CNPJ'),
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

  if (request.customer.address) {
    (body.customer as Record<string, unknown>).address = {
      street: request.customer.address.street,
      number: request.customer.address.number,
      district: request.customer.address.district,
      city: request.customer.address.city,
      state: request.customer.address.state.substring(0, 2).toUpperCase(),
      complement: request.customer.address.complement || '',
      zip_code: request.customer.address.zipCode.replace(/\D/g, ''),
    };
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

  // Add notification if provided
  if (request.notification) {
    const channels = [];
    
    if (request.notification.email) {
      channels.push({
        contact: request.notification.email,
        channel: 'EMAIL',
        rules: request.notification.rules || ['BEFORE_DUE_DATE', 'DUE_DATE', 'OVERDUE'],
      });
    }
    
    if (request.notification.phone) {
      channels.push({
        contact: request.notification.phone.startsWith('+55') 
          ? request.notification.phone 
          : `+55${request.notification.phone.replace(/\D/g, '')}`,
        channel: 'SMS',
        rules: request.notification.rules || ['BEFORE_DUE_DATE', 'DUE_DATE'],
      });
    }

    if (channels.length > 0) {
      body.notification = {
        name: request.notification.name.substring(0, 60),
        channels,
      };
    }
  }

  // Generate idempotency key from order number
  const idempotencyKey = crypto.randomUUID();

  // Use mTLS for API call too
  const httpClient = Deno.createHttpClient({
    cert: certificate,
    key: privateKey,
  });

  try {
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
    const requestBody = await req.json();
    const { action, ...params } = requestBody;

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

    throw new Error(`Ação não reconhecida: ${action}`);

  } catch (error) {
    console.error('[Cora] Error:', error);
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
