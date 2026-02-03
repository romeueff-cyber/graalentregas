import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type AuthResult = { userId: string; supabase: SupabaseClient } | { error: Response };

/**
 * Verify user authentication from request
 * Returns the user ID if authenticated, or an error Response
 */
export async function verifyAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.error('[Auth] Missing or invalid Authorization header');
    return {
      error: new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Use service role client to verify the token
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify the JWT token using the service role client
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    console.error('[Auth] Token verification failed:', userError?.message || 'No user');
    return {
      error: new Response(
        JSON.stringify({ error: 'Token inválido ou expirado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  console.log(`[Auth] User verified: ${user.id}`);
  return { userId: user.id, supabase };
}

/**
 * Verify admin authentication from request
 * Returns the user ID if authenticated and is admin, or an error Response
 */
export async function verifyAdminAuth(req: Request): Promise<AuthResult> {
  const authResult = await verifyAuth(req);
  
  if ('error' in authResult) {
    return authResult;
  }

  const { userId, supabase } = authResult;

  // Check if user is admin using the service role client
  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();

  if (roleError || !roleData) {
    console.log(`[Auth] User ${userId} is not admin`);
    return {
      error: new Response(
        JSON.stringify({ error: 'Acesso negado. Somente administradores.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  console.log(`[Auth] Admin verified: ${userId}`);
  return { userId, supabase };
}
