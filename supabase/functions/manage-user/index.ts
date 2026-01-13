import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Get user token to verify admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user token to verify admin status
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: callerUser } } = await supabaseClient.auth.getUser()
    if (!callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if caller is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('role', 'admin')
      .single()

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { action, userId, name, email, password } = await req.json()

    if (!action || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: action, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prevent modifying admin users
    const { data: targetRoleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single()

    if (targetRoleData) {
      return new Response(
        JSON.stringify({ error: 'Cannot modify admin users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    switch (action) {
      case 'update': {
        // Update user data
        const updateData: { email?: string; password?: string; user_metadata?: { name: string } } = {}
        
        if (email) {
          updateData.email = email
        }
        
        if (password) {
          updateData.password = password
        }
        
        if (name) {
          updateData.user_metadata = { name }
        }

        // Update auth user if email or password changed
        if (email || password) {
          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            updateData
          )

          if (authError) {
            console.error('Error updating auth user:', authError)
            return new Response(
              JSON.stringify({ error: authError.message }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }

        // Update profile if name or email changed
        if (name || email) {
          const profileUpdate: { name?: string; email?: string } = {}
          if (name) profileUpdate.name = name
          if (email) profileUpdate.email = email

          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update(profileUpdate)
            .eq('id', userId)

          if (profileError) {
            console.error('Error updating profile:', profileError)
            return new Response(
              JSON.stringify({ error: profileError.message }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: 'User updated successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'deactivate': {
        // Ban user (deactivate)
        const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { ban_duration: '87600h' } // ~10 years
        )

        if (banError) {
          console.error('Error banning user:', banError)
          return new Response(
            JSON.stringify({ error: banError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true, message: 'User deactivated successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'activate': {
        // Unban user (activate)
        const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { ban_duration: 'none' }
        )

        if (unbanError) {
          console.error('Error unbanning user:', unbanError)
          return new Response(
            JSON.stringify({ error: unbanError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true, message: 'User activated successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'delete': {
        // Delete user completely
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (deleteError) {
          console.error('Error deleting user:', deleteError)
          return new Response(
            JSON.stringify({ error: deleteError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true, message: 'User deleted successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Valid actions: update, deactivate, activate, delete' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
