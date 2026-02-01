import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/src/lib/supabaseAdmin'

/**
 * Verify if the current user is an admin by checking their profile's is_admin field.
 * This function works for both API routes (with Authorization header) and server components (with cookies).
 */
export async function verifyAdmin(request?: NextRequest): Promise<{
  authorized: boolean
  user: { id: string; email: string } | null
  error?: 'not_authenticated' | 'not_admin' | 'no_profile'
}> {
  let userId: string | null = null
  let userEmail: string | null = null

  // For API routes: check Authorization header
  if (request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
      
      if (error || !user) {
        return { authorized: false, user: null, error: 'not_authenticated' }
      }
      
      userId = user.id
      userEmail = user.email || null
    }
  }

  // For server components: check cookies
  if (!userId) {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return { authorized: false, user: null, error: 'not_authenticated' }
    }
    
    userId = user.id
    userEmail = user.email || null
  }

  if (!userId) {
    return { authorized: false, user: null, error: 'not_authenticated' }
  }

  // Fetch user's profile and check is_admin
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('user_id, is_admin')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError || !profile) {
    return { authorized: false, user: null, error: 'no_profile' }
  }

  if (!profile.is_admin) {
    return { authorized: false, user: { id: userId, email: userEmail || '' }, error: 'not_admin' }
  }

  return {
    authorized: true,
    user: { id: userId, email: userEmail || '' },
  }
}

/**
 * Middleware helper for API routes - returns appropriate error response
 */
export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const { authorized, error } = await verifyAdmin(request)
  
  if (!authorized) {
    if (error === 'not_authenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  return null // Authorized, continue
}
