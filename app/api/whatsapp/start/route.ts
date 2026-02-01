import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import twilio from 'twilio'

export const runtime = 'nodejs'

/**
 * POST /api/whatsapp/start
 * 
 * Starts SMS OTP verification for a phone number.
 * 
 * Body: { e164: string } - Phone number in E.164 format (e.g., "+44 7700 900123" or "+447700900123")
 * 
 * Flow:
 * 1. Authenticate user
 * 2. Normalize and validate phone number
 * 3. Check cooldown (30 seconds)
 * 4. Persist number to profiles.whatsapp_e164
 * 5. Send OTP via Twilio Verify
 * 
 * Returns: { ok: true } on success
 * 
 * Errors:
 * - 401: Unauthorized
 * - 400: Invalid phone number format
 * - 429: Cooldown (too soon after last request)
 * - 500: Twilio error or server error
 * 
 * Testing with curl:
 * curl -X POST http://localhost:3000/api/whatsapp/start \
 *   -H "Content-Type: application/json" \
 *   -H "Cookie: sb-<project>-auth-token=<token>" \
 *   -d '{"e164":"+44 7700 900123"}'
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { e164 } = body

    if (!e164 || typeof e164 !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid e164 field' }, { status: 400 })
    }

    // Normalize phone number: trim, collapse spaces, ensure starts with +
    let normalized = e164.trim().replace(/\s+/g, '')
    
    // Basic validation: must start with + and have 8-20 digits after +
    if (!normalized.startsWith('+')) {
      return NextResponse.json({ error: 'Phone number must start with +' }, { status: 400 })
    }

    const digitsOnly = normalized.slice(1).replace(/\D/g, '')
    if (digitsOnly.length < 8 || digitsOnly.length > 20) {
      return NextResponse.json({ 
        error: 'Phone number must have 8-20 digits after the country code' 
      }, { status: 400 })
    }

    // Reconstruct normalized E.164 (no spaces)
    normalized = '+' + digitsOnly

    // Check cooldown: read whatsapp_verify_sent_at
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whatsapp_verify_sent_at')
      .eq('user_id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching profile:', profileError)
    }

    if (profile?.whatsapp_verify_sent_at) {
      const sentAt = new Date(profile.whatsapp_verify_sent_at)
      const now = new Date()
      const secondsSince = (now.getTime() - sentAt.getTime()) / 1000

      if (secondsSince < 30) {
        const waitSeconds = Math.ceil(30 - secondsSince)
        return NextResponse.json(
          { error: `Please wait ${waitSeconds} second${waitSeconds !== 1 ? 's' : ''} before requesting another code.` },
          { status: 429 }
        )
      }
    }

    // Persist number before sending
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        whatsapp_e164: normalized,
        whatsapp_verified: false, // Always reset verification when number changes
        whatsapp_verified_at: null,
        whatsapp_verify_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select('id')

    if (updateError) {
      console.error('Error updating profile:', updateError)
      return NextResponse.json({ error: 'Failed to save phone number' }, { status: 500 })
    }

    if (!updatedProfile || updatedProfile.length === 0) {
      return NextResponse.json({ error: 'Profile not found. Please save profile first.' }, { status: 409 })
    }

    // Send OTP via Twilio Verify
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID

    if (!accountSid || !authToken || !verifyServiceSid) {
      console.error('Missing Twilio credentials')
      return NextResponse.json({ error: 'SMS service not configured' }, { status: 500 })
    }

    const client = twilio(accountSid, authToken)

    try {
      await client.verify.v2
        .services(verifyServiceSid)
        .verifications
        .create({
          to: normalized,
          channel: 'sms',
        })

      return NextResponse.json({ ok: true })
    } catch (twilioError: any) {
      console.error('Twilio error:', twilioError)
      
      // Return user-friendly error messages
      if (twilioError.code === 60200) {
        return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
      } else if (twilioError.code === 60203) {
        return NextResponse.json({ error: 'Maximum verification attempts reached. Please try again later.' }, { status: 429 })
      } else {
        return NextResponse.json({ 
          error: twilioError.message || 'Failed to send verification code' 
        }, { status: 500 })
      }
    }
  } catch (error: any) {
    console.error('Error in /api/whatsapp/start:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
