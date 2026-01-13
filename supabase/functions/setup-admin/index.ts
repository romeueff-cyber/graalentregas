import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Check if admin user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingAdmin = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === 'admin@graalbeer.com.br'
    );

    let userId: string;

    if (existingAdmin) {
      console.log('Admin user already exists');
      userId = existingAdmin.id;
    } else {
      // Create admin user
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: 'Admin@graalbeer.com.br',
        password: 'admin1',
        email_confirm: true,
        user_metadata: {
          name: 'Administrador'
        }
      });

      if (userError) {
        console.error('Error creating user:', userError);
        throw userError;
      }

      console.log('Admin user created:', userData.user?.id);
      userId = userData.user!.id;
    }

    // Check if admin role already exists for this user
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    if (!existingRole) {
      // Add admin role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'admin'
        });

      if (roleError) {
        console.error('Error adding admin role:', roleError);
        throw roleError;
      }

      console.log('Admin role added');
    } else {
      console.log('Admin role already exists');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuário Admin criado com sucesso!',
        credentials: {
          email: 'Admin@graalbeer.com.br',
          password: 'admin1'
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Setup error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
