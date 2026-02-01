import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabaseAdmin'
import { requireAdmin, verifyAdmin } from '@/lib/admin/verify'

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) {
    return authError
  }
  
  const { user } = await verifyAdmin(request)
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
