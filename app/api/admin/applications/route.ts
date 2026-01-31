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

export async function GET(request: NextRequest) {
  const { authorized } = await verifyAdmin(request)
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('applications')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const { authorized } = await verifyAdmin(request)
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, status, reviewer_notes } = body

  if (!id || !status || (status !== 'approved' && status !== 'rejected')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('applications')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewer_notes || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
