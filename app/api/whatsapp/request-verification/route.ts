import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, whatsapp_number')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const whatsappNumber = profile.whatsapp_number
    if (!whatsappNumber || whatsappNumber.trim().length === 0) {
      return NextResponse.json({ error: 'WhatsApp number is required' }, { status: 400 })
    }

    // Generate verification code: TTB- + 6 digits
    const code = `TTB-${Math.floor(100000 + Math.random() * 900000)}`
    
    // Set expiry to 15 minutes from now
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 15)

    // Store code and expiry in profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        whatsapp_verify_code: code,
        whatsapp_verify_expires_at: expiresAt.toISOString(),
      })
      .eq('id', profile.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Build WhatsApp deep link
    const ttbNumber = process.env.TTB_WHATSAPP_NUMBER
    if (!ttbNumber) {
      return NextResponse.json({ error: 'TTB WhatsApp number not configured' }, { status: 500 })
    }

    // Remove + from phone number for wa.me link
    const ttbNumberClean = ttbNumber.replace(/^\+/, '')
    const message = `TTB verify ${code}`
    const waLink = `https://wa.me/${ttbNumberClean}?text=${encodeURIComponent(message)}`

    return NextResponse.json({
      ok: true,
      wa_link: waLink,
      expires_at: expiresAt.toISOString(),
    })
  } catch (error: any) {
    console.error('Error requesting verification:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
