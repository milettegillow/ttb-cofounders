import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/admin/verify'

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) {
    return authError
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('user_id, display_name, technical_expertise, location_tz, is_complete, updated_at')
    .order('updated_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profiles: data || [] })
}
