import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/admin/verify'

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) {
    return authError
  }

  // Get query params for filters
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  // Build query
  let query = supabaseAdmin
    .from('reports')
    .select('id, reporter_user_id, reported_user_id, reason, details, created_at, status')
    .order('created_at', { ascending: false })
    .limit(500)

  // Apply status filter
  if (status && ['open', 'investigating', 'resolved'].includes(status)) {
    query = query.eq('status', status)
  }

  const { data: reports, error: reportsError } = await query

  if (reportsError) {
    // Check if table doesn't exist (common error codes: 42P01, 42883)
    if (reportsError.code === '42P01' || reportsError.message?.includes('does not exist')) {
      return NextResponse.json({ 
        error: 'Reports table not set up yet',
        setup_required: true 
      }, { status: 503 })
    }
    return NextResponse.json({ error: reportsError.message }, { status: 500 })
  }

  if (!reports || reports.length === 0) {
    return NextResponse.json({ reports: [] })
  }

  // Collect all unique user IDs
  const userIds = new Set<string>()
  reports.forEach((report) => {
    userIds.add(report.reporter_user_id)
    userIds.add(report.reported_user_id)
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

  // Join reports with profiles
  const reportsWithProfiles = reports.map((report) => {
    const reporterProfile = profileMap.get(report.reporter_user_id) || null
    const reportedProfile = profileMap.get(report.reported_user_id) || null

    return {
      id: report.id,
      reporter: {
        user_id: report.reporter_user_id,
        display_name: reporterProfile?.display_name || null,
        email: reporterProfile?.email || null,
        photo_path: reporterProfile?.photo_path || null,
      },
      reported: {
        user_id: report.reported_user_id,
        display_name: reportedProfile?.display_name || null,
        email: reportedProfile?.email || null,
        photo_path: reportedProfile?.photo_path || null,
      },
      reason: report.reason,
      details: report.details,
      created_at: report.created_at,
      status: report.status,
    }
  })

  return NextResponse.json({ reports: reportsWithProfiles })
}
