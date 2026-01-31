import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabaseAdmin'

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, user: null }
  }

  const token = authHeader.substring(7)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !user?.email) {
    return { authorized: false, user: null }
  }

  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || []
  if (!adminEmails.includes(user.email)) {
    return { authorized: false, user: null }
  }

  return { authorized: true, user }
}

export async function POST(request: NextRequest) {
  const { authorized, user } = await verifyAdmin(request)
  if (!authorized || !user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const { targetUserId } = body

  if (!targetUserId || typeof targetUserId !== 'string') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const callerId = user.id

  // Upsert swipe: target likes caller
  await supabaseAdmin
    .from('swipes')
    .upsert(
      {
        from_user_id: targetUserId,
        to_user_id: callerId,
        direction: 'like',
      },
      {
        onConflict: 'from_user_id,to_user_id',
      }
    )

  // Upsert swipe: caller likes target
  await supabaseAdmin
    .from('swipes')
    .upsert(
      {
        from_user_id: callerId,
        to_user_id: targetUserId,
        direction: 'like',
      },
      {
        onConflict: 'from_user_id,to_user_id',
      }
    )

  // Create/upsert match with sorted UUIDs
  const [a, b] = [callerId, targetUserId].sort()
  await supabaseAdmin
    .from('matches')
    .upsert(
      {
        user_a: a,
        user_b: b,
      },
      {
        onConflict: 'user_a,user_b',
      }
    )

  return NextResponse.json({ ok: true })
}
