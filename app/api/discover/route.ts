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

export async function GET(request: NextRequest) {
  const { authorized, userId } = await verifyToken(request)
  if (!authorized || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get current user's profile to verify they're complete and live
  const { data: userProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('is_complete, is_live')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError || !userProfile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!userProfile.is_complete || !userProfile.is_live) {
    return NextResponse.json({ error: 'Profile must be complete and live' }, { status: 403 })
  }

  // Get already-swiped user IDs
  const { data: swipesData } = await supabaseAdmin
    .from('swipes')
    .select('to_user_id')
    .eq('from_user_id', userId)

  const swipedIds = swipesData ? swipesData.map((s) => s.to_user_id) : []

  // Build profiles query — bypasses RLS via supabaseAdmin
  let query = supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('is_live', true)
    .neq('user_id', userId)
    .not('photo_path', 'is', null)

  if (swipedIds.length > 0) {
    query = query.not('user_id', 'in', `(${swipedIds.join(',')})`)
  }

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .limit(25)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filter out empty photo_path
  const profiles = (data || []).filter((p: any) => p.photo_path && p.photo_path.trim() !== '')

  return NextResponse.json(profiles)
}
