import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Allowed origins for CORS
const allowedOrigins = [
  'https://graalentregas.lovable.app',
  'https://id-preview--9548ee87-7745-45be-aa06-7e3318e01c02.lovable.app',
  'http://localhost:5173',
  'http://localhost:8080'
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Input validation helpers
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_NAME_LENGTH = 100
const MAX_EMAIL_LENGTH = 255
const MIN_PASSWORD_LENGTH = 8
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VALID_ACTIONS = ['update', 'deactivate', 'activate', 'delete', 'change_role']
const VALID_ROLES = ['admin', 'entregador', 'vendedor', 'financeiro']

function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' }
  }
  const trimmedEmail = email.trim()
  if (trimmedEmail.length > MAX_EMAIL_LENGTH) {
    return { valid: false, error: `Email must be less than ${MAX_EMAIL_LENGTH} characters` }
  }
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return { valid: false, error: 'Invalid email format' }
  }
  return { valid: true }
}

function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' }
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' }
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' }
  }
  return { valid: true }
}

function validateName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name is required' }
  }
  const trimmedName = name.trim()
  if (trimmedName.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' }
  }
  if (trimmedName.length > MAX_NAME_LENGTH) {
    return { valid: false, error: `Name must be less than ${MAX_NAME_LENGTH} characters` }
  }
  return { valid: true }
}

function validateUserId(userId: string): { valid: boolean; error?: string } {
  if (!userId || typeof userId !== 'string') {
    return { valid: false, error: 'User ID is required' }
  }
  if (!UUID_REGEX.test(userId)) {
    return { valid: false, error: 'Invalid user ID format' }
  }
  return { valid: true }
}

function validateAction(action: string): { valid: boolean; error?: string } {
  if (!action || typeof action !== 'string') {
    return { valid: false, error: 'Action is required' }
  }
  if (!VALID_ACTIONS.includes(action)) {
    return { valid: false, error: `Invalid action. Valid actions: ${VALID_ACTIONS.join(', ')}` }
  }
  return { valid: true }
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      }
    })
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
    const { action, userId, name, email, password, role } = await req.json()

    // Validate action
    const actionValidation = validateAction(action)
    if (!actionValidation.valid) {
      return new Response(
        JSON.stringify({ error: actionValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate userId
    const userIdValidation = validateUserId(userId)
    if (!userIdValidation.valid) {
      return new Response(
        JSON.stringify({ error: userIdValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prevent admin from modifying themselves through this endpoint
    if (action !== 'change_role' && userId === callerUser.id) {
      return new Response(
        JSON.stringify({ error: 'Use as configurações da conta para editar seu próprio usuário' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    switch (action) {
      case 'update': {
        // Validate optional fields if provided
        if (email) {
          const emailValidation = validateEmail(email)
          if (!emailValidation.valid) {
            return new Response(
              JSON.stringify({ error: emailValidation.error }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }

        if (password) {
          const passwordValidation = validatePassword(password)
          if (!passwordValidation.valid) {
            return new Response(
              JSON.stringify({ error: passwordValidation.error }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }

        if (name) {
          const nameValidation = validateName(name)
          if (!nameValidation.valid) {
            return new Response(
              JSON.stringify({ error: nameValidation.error }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }

        // Update user data
        const updateData: { email?: string; password?: string; user_metadata?: { name: string } } = {}
        
        const trimmedEmail = email?.trim()
        const trimmedName = name?.trim()

        if (trimmedEmail) {
          updateData.email = trimmedEmail
        }
        
        if (password) {
          updateData.password = password
        }
        
        if (trimmedName) {
          updateData.user_metadata = { name: trimmedName }
        }

        // Update auth user if email or password changed
        if (trimmedEmail || password) {
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
        if (trimmedName || trimmedEmail) {
          const profileUpdate: { name?: string; email?: string } = {}
          if (trimmedName) profileUpdate.name = trimmedName
          if (trimmedEmail) profileUpdate.email = trimmedEmail

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

      case 'change_role': {
        // Validate role
        if (!role || !VALID_ROLES.includes(role)) {
          return new Response(
            JSON.stringify({ error: `Invalid role. Valid roles: ${VALID_ROLES.join(', ')}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Prevent changing own role
        if (userId === callerUser.id) {
          return new Response(
            JSON.stringify({ error: 'Cannot change your own role' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Upsert the role
        const { data: existingRole } = await supabaseAdmin
          .from('user_roles')
          .select('id')
          .eq('user_id', userId)
          .single()

        if (existingRole) {
          const { error: updateRoleError } = await supabaseAdmin
            .from('user_roles')
            .update({ role })
            .eq('user_id', userId)

          if (updateRoleError) {
            console.error('Error updating role:', updateRoleError)
            return new Response(
              JSON.stringify({ error: updateRoleError.message }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        } else {
          const { error: insertRoleError } = await supabaseAdmin
            .from('user_roles')
            .insert({ user_id: userId, role })

          if (insertRoleError) {
            console.error('Error inserting role:', insertRoleError)
            return new Response(
              JSON.stringify({ error: insertRoleError.message }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: `Role changed to ${role}` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: `Invalid action. Valid actions: ${VALID_ACTIONS.join(', ')}` }),
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
