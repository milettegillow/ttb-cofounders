export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Check for required environment variables
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json(
        { exists: false, degraded: true, reason: 'missing_service_role_key' },
        { status: 200 }
      )
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return Response.json(
        { exists: false, degraded: true, reason: 'missing_supabase_url' },
        { status: 200 }
      )
    }

    const body = await request.json()
    const { email } = body

    // Validate email input
    if (!email || typeof email !== 'string') {
      // Invalid input - return exists: false (not degraded, just invalid)
      return Response.json({ exists: false }, { status: 200 })
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      // Empty email after normalization - return exists: false (not degraded)
      return Response.json({ exists: false }, { status: 200 })
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if user exists using Supabase Admin API listUsers
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    // Handle error cases
    if (error) {
      // Unexpected error - return degraded with reason
      console.error('check-email lookup_failed:', error)
      return Response.json(
        { exists: false, degraded: true, reason: 'lookup_failed' },
        { status: 200 }
      )
    }

    // Search for matching user by email
    if (data?.users) {
      const foundUser = data.users.find(
        (user) => user.email?.toLowerCase() === normalizedEmail
      )
      if (foundUser) {
        return Response.json({ exists: true }, { status: 200 })
      }
    }

    // No user found - return exists: false (not degraded)
    return Response.json({ exists: false }, { status: 200 })
  } catch (error: any) {
    // Unexpected exception - return degraded with reason
    console.error('check-email lookup_failed:', error)
    return Response.json(
      { exists: false, degraded: true, reason: 'lookup_failed' },
      { status: 200 }
    )
  }
}
