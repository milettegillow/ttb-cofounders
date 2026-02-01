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

export async function POST(request: NextRequest) {
  const { authorized } = await verifyAdmin(request)
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const { count } = body

  if (!count || typeof count !== 'number' || count < 1 || count > 100) {
    return NextResponse.json({ error: 'Invalid count (1-100)' }, { status: 400 })
  }

  const timestamp = Date.now()
  const created: Array<{ user_id: string; email: string }> = []
  const roles = ['Technical cofounder', 'Business cofounder', 'Open']

  for (let i = 1; i <= count; i++) {
    const email = `seed+${timestamp}+${i}@ttb.local`
    const role = roles[(i - 1) % roles.length]

    // Create user
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
    })

    if (userError || !userData?.user?.id) {
      console.error(`Failed to create user ${i}:`, userError)
      continue
    }

    const userId = userData.user.id

    // Insert application
    const { error: appError } = await supabaseAdmin
      .from('applications')
      .insert({
        user_id: userId,
        email: email,
        linkedin: `https://linkedin.com/in/seed-user-${i}`,
        stem_background: `Seed STEM background for user ${i}`,
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      })

    if (appError) {
      console.error(`Failed to create application for user ${i}:`, appError)
    }

    // Insert profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: userId,
        email: email,
        display_name: `Seed User ${i}`,
        technical_expertise: role,
        location_tz: `Seed Location ${i}, GMT`,
        skills_background: `Seed skills for user ${i}`,
        interests_building: `Seed interests for user ${i}`,
        links: `https://example.com/user${i}`,
        linkedin_url: `https://linkedin.com/in/seed-user-${i}`,
        is_complete: true,
        is_live: true,
        updated_at: new Date().toISOString(),
      })

    if (profileError) {
      console.error(`Failed to create profile for user ${i}:`, profileError)
    }

    // Upsert user_contacts
    const { error: contactsError } = await supabaseAdmin
      .from('user_contacts')
      .upsert({
        user_id: userId,
        whatsapp: `+4470000000${i.toString().padStart(2, '0')}`,
        share_whatsapp: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (contactsError) {
      console.error(`Failed to create contacts for user ${i}:`, contactsError)
    }

    created.push({ user_id: userId, email })
  }

  return NextResponse.json({ created })
}
