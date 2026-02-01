import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/src/lib/supabaseAdmin'

async function verifyToken(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { authorized: false, userId: null }
  }

  return { authorized: true, userId: user.id }
}

export async function POST(request: NextRequest) {
  const { authorized, userId: reporterId } = await verifyToken(request)
  if (!authorized || !reporterId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { reported_user_id, reason, details } = body

  if (!reported_user_id || typeof reported_user_id !== 'string') {
    return NextResponse.json({ error: 'Invalid request: reported_user_id required' }, { status: 400 })
  }

  if (reporterId === reported_user_id) {
    return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 })
  }

  // Create the report
  const { data: report, error: reportError } = await supabaseAdmin
    .from('reports')
    .insert({
      reporter_user_id: reporterId,
      reported_user_id: reported_user_id,
      reason: reason || null,
      details: details || null,
      status: 'open',
    })
    .select()
    .single()

  if (reportError) {
    console.error('[reports] Error creating report:', reportError)
    return NextResponse.json({ error: reportError.message }, { status: 500 })
  }

  // Automatically unmatch if a match exists
  // Matches are stored with sorted UUIDs (user_a < user_b)
  const [userA, userB] = [reporterId, reported_user_id].sort()

  const { data: existingMatch, error: matchError } = await supabaseAdmin
    .from('matches')
    .select('id')
    .eq('user_a', userA)
    .eq('user_b', userB)
    .maybeSingle()

  if (matchError) {
    console.error('[reports] Error checking for match:', matchError)
    // Don't fail the report creation if match check fails
  } else if (existingMatch) {
    // Delete the match
    const { error: deleteError } = await supabaseAdmin
      .from('matches')
      .delete()
      .eq('id', existingMatch.id)

    if (deleteError) {
      console.error('[reports] Error deleting match:', deleteError)
      // Don't fail the report creation if match deletion fails
    } else {
      console.log(`[reports] Automatically unmatched users ${reporterId} and ${reported_user_id} due to report`)
    }
  }

  return NextResponse.json({ ok: true, report })
}
