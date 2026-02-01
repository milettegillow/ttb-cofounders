import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabaseAdmin'
import { requireAdmin, verifyAdmin } from '@/lib/admin/verify'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAdmin(request)
  if (authError) {
    return authError
  }
  
  const { user } = await verifyAdmin(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const reportId = params.id

  if (!reportId) {
    return NextResponse.json({ error: 'Report ID required' }, { status: 400 })
  }

  const body = await request.json()
  const { status } = body

  if (!status || !['open', 'investigating', 'resolved'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status. Must be: open, investigating, or resolved' }, { status: 400 })
  }

  // Update the report status
  const { data, error: updateError } = await supabaseAdmin
    .from('reports')
    .update({ status })
    .eq('id', reportId)
    .select()
    .single()

  if (updateError) {
    if (updateError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }
    console.error('[admin] Error updating report:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  console.log(`[admin] User ${user.email} (${user.id}) updated report ${reportId} to status: ${status}`)

  return NextResponse.json({ ok: true, report: data })
}
