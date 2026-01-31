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
  const { userIds } = body

  if (!Array.isArray(userIds)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Check caller's share_whatsapp setting
  // If no row exists, treat as share_whatsapp=true (don't block)
  const { data: callerContacts } = await supabaseAdmin
    .from('user_contacts')
    .select('share_whatsapp')
    .eq('user_id', callerId)
    .maybeSingle()

  if (callerContacts && !callerContacts.share_whatsapp) {
    return NextResponse.json({ contacts: {} })
  }

  const contacts: { [userId: string]: { whatsapp: string } } = {}

  // For each target userId, verify match and fetch contact if eligible
  for (const targetUserId of userIds) {
    // Compute sorted UUIDs [a, b] lexicographically
    const [a, b] = [callerId, targetUserId].sort()

    // Verify match exists using sorted format
    const { data: matchData, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('id')
      .eq('user_a', a)
      .eq('user_b', b)
      .maybeSingle()

    if (matchError || !matchData) {
      continue
    }

    // Fetch target's user_contacts
    const { data: targetContacts } = await supabaseAdmin
      .from('user_contacts')
      .select('whatsapp, share_whatsapp')
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (
      targetContacts &&
      targetContacts.share_whatsapp &&
      targetContacts.whatsapp
    ) {
      contacts[targetUserId] = {
        whatsapp: targetContacts.whatsapp,
      }
    }
  }

  return NextResponse.json({ contacts })
}
