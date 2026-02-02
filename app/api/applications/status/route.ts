import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabaseAdmin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, userId } = body

    // Validate email input
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ status: null }, { status: 200 })
    }

    // Normalize email to lowercase
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      return NextResponse.json({ status: null }, { status: 200 })
    }

    // Check if user has a profile (approved users have profiles)
    // First try by user_id if provided (primary check)
    if (userId) {
      const { data: profileByUserId, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()

      if (profileError) {
        console.error('Error checking profile by user_id:', profileError)
      }

      // If profile exists by user_id, user is approved
      if (profileByUserId) {
        return NextResponse.json({ status: 'approved' }, { status: 200 })
      }
    }

    // Fallback: check by email
    const { data: profileByEmail, error: profileEmailError } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .ilike('email', normalizedEmail)
      .limit(1)
      .maybeSingle()

    if (profileEmailError) {
      console.error('Error checking profile by email:', profileEmailError)
    }

    // If profile exists by email, user is approved
    if (profileByEmail) {
      return NextResponse.json({ status: 'approved' }, { status: 200 })
    }

    // If no profile, check pre_applications for pending/rejected status
    const { data: preAppData, error: preAppError } = await supabaseAdmin
      .from('pre_applications')
      .select('status')
      .ilike('email', normalizedEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (preAppError) {
      console.error('Error checking pre_applications status:', preAppError)
      return NextResponse.json({ status: null }, { status: 200 })
    }

    // Return status from pre_applications (pending/rejected) or null if no application found
    return NextResponse.json({ status: preAppData?.status || null }, { status: 200 })
  } catch (error: any) {
    console.error('Error in /api/applications/status:', error)
    return NextResponse.json({ status: null }, { status: 200 })
  }
}
