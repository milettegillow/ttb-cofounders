import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/admin/verify'

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) {
    return authError
  }

  // Get query params for search
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''

  // Fetch all matches
  const { data: matches, error: matchesError } = await supabaseAdmin
    .from('matches')
    .select('id, user_a, user_b, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (matchesError) {
    return NextResponse.json({ error: matchesError.message }, { status: 500 })
  }

  if (!matches || matches.length === 0) {
    return NextResponse.json({ matches: [] })
  }

  // Collect all unique user IDs
  const userIds = new Set<string>()
  matches.forEach((match) => {
    userIds.add(match.user_a)
    userIds.add(match.user_b)
  })

  // Fetch profiles for all users
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('user_id, display_name, email, photo_path')
    .in('user_id', Array.from(userIds))

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 })
  }

  // Build profile map
  const profileMap = new Map<string, any>()
  profiles?.forEach((profile) => {
    profileMap.set(profile.user_id, profile)
  })

  // Join matches with profiles
  const matchesWithProfiles = matches.map((match) => {
    const profileA = profileMap.get(match.user_a) || null
    const profileB = profileMap.get(match.user_b) || null

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase()
      const matchesSearch =
        profileA?.display_name?.toLowerCase().includes(searchLower) ||
        profileA?.email?.toLowerCase().includes(searchLower) ||
        profileB?.display_name?.toLowerCase().includes(searchLower) ||
        profileB?.email?.toLowerCase().includes(searchLower)

      if (!matchesSearch) {
        return null
      }
    }

    return {
      id: match.id,
      user_a: {
        user_id: match.user_a,
        display_name: profileA?.display_name || null,
        email: profileA?.email || null,
        photo_path: profileA?.photo_path || null,
      },
      user_b: {
        user_id: match.user_b,
        display_name: profileB?.display_name || null,
        email: profileB?.email || null,
        photo_path: profileB?.photo_path || null,
      },
      created_at: match.created_at,
    }
  }).filter((match) => match !== null)

  return NextResponse.json({ matches: matchesWithProfiles })
}
