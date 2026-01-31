import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabaseAdmin'

async function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, userId: null }
  }

  const token = authHeader.substring(7)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !user?.id) {
    return { authorized: false, userId: null }
  }

  return { authorized: true, userId: user.id }
}

export async function POST(request: NextRequest) {
  const { authorized, userId: callerId } = await verifyToken(request)
  if (!authorized || !callerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { toUserId, direction } = body

  if (!toUserId || (direction !== 'like' && direction !== 'pass')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Upsert swipe
  const { error: swipeError } = await supabaseAdmin
    .from('swipes')
    .upsert(
      {
        from_user_id: callerId,
        to_user_id: toUserId,
        direction,
      },
      {
        onConflict: 'from_user_id,to_user_id',
      }
    )

  if (swipeError) {
    return NextResponse.json({ error: swipeError.message }, { status: 500 })
  }

  let matched = false

  // If it's a like, check for reciprocal like
  if (direction === 'like') {
    const { data: reciprocalSwipe } = await supabaseAdmin
      .from('swipes')
      .select('*')
      .eq('from_user_id', toUserId)
      .eq('to_user_id', callerId)
      .eq('direction', 'like')
      .single()

    if (reciprocalSwipe) {
      // Create match with sorted user IDs
      const userA = callerId < toUserId ? callerId : toUserId
      const userB = callerId < toUserId ? toUserId : callerId

      const { error: matchError } = await supabaseAdmin
        .from('matches')
        .upsert(
          {
            user_a: userA,
            user_b: userB,
          },
          {
            onConflict: 'user_a,user_b',
          }
        )

      if (matchError) {
        return NextResponse.json({ error: matchError.message }, { status: 500 })
      }

      matched = true
    }
  }

  return NextResponse.json({ ok: true, matched })
}
