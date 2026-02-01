import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabaseAdmin'
import { requireAdmin, verifyAdmin } from '@/lib/admin/verify'

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin(request)
  if (authError) {
    return authError
  }
  
  const { user } = await verifyAdmin(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: matchId } = await context.params

  if (!matchId) {
    return NextResponse.json({ error: 'Match ID required' }, { status: 400 })
  }

  // Delete the match
  const { error: deleteError } = await supabaseAdmin
    .from('matches')
    .delete()
    .eq('id', matchId)

  if (deleteError) {
    console.error('[admin] Error deleting match:', deleteError)
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  console.log(`[admin] User ${user.email} (${user.id}) deleted match ${matchId}`)

  return NextResponse.json({ ok: true })
}
