import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/admin/verify'

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) {
    return authError
  }

  // Get query params for search and filters
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user_id')
  const search = searchParams.get('search') || ''
  const isLive = searchParams.get('is_live')
  const isComplete = searchParams.get('is_complete')

  // If user_id is provided, fetch single user with all fields
  if (userId) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json({ profile: data })
  }

  // Build query
  let query = supabaseAdmin
    .from('profiles')
    .select('user_id, display_name, email, role, location_tz, linkedin_url, domain_expertise, technical_expertise, is_live, is_complete, created_at, updated_at, photo_path')
    .order('updated_at', { ascending: false })

  // Apply search filter (name or email)
  if (search) {
    query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`)
  }

  // Apply is_live filter
  if (isLive === 'true') {
    query = query.eq('is_live', true)
  } else if (isLive === 'false') {
    query = query.eq('is_live', false)
  }

  // Apply is_complete filter
  if (isComplete === 'true') {
    query = query.eq('is_complete', true)
  } else if (isComplete === 'false') {
    query = query.eq('is_complete', false)
  }

  const { data, error } = await query.limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profiles: data || [] })
}
