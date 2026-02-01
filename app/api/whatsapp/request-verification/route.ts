import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import twilio from 'twilio'

export const runtime = 'nodejs'

/**
 * POST /api/whatsapp/request-verification
 * 
 * Requests SMS OTP verification via Twilio Verify.
 * 
 * Body: { phoneE164: string, channel?: 'sms' | 'whatsapp' }
 * 
 * Flow:
 * 1. Authenticate user
 * 2. Validate phone number format (E.164)
 * 3. Save phone number to profile (update if exists, insert minimal row if not)
 * 4. Send OTP via Twilio Verify
 * 
 * Returns: { ok: true, channel: 'sms' }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate Twilio env vars
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID

    if (!accountSid) {
      return NextResponse.json({ error: 'TWILIO_ACCOUNT_SID is not configured' }, { status: 500 })
    }
    if (!authToken) {
      return NextResponse.json({ error: 'TWILIO_AUTH_TOKEN is not configured' }, { status: 500 })
    }
    if (!verifyServiceSid) {
      return NextResponse.json({ error: 'TWILIO_VERIFY_SERVICE_SID is not configured' }, { status: 500 })
    }

    // Parse request body
    const body = await request.json()
    const { phoneE164, channel = 'sms' } = body

    if (!phoneE164 || typeof phoneE164 !== 'string' || phoneE164.trim().length === 0) {
      return NextResponse.json({ error: 'Enter a phone number first.' }, { status: 400 })
    }

    // Normalize phone number: trim, collapse spaces, ensure E.164 format
    let normalizedPhone = phoneE164.trim().replace(/\s+/g, '')
    
    // Basic validation: must start with + and have valid length
    if (!normalizedPhone.startsWith('+')) {
      return NextResponse.json({ error: 'Phone number must start with +' }, { status: 400 })
    }

    const digitsOnly = normalizedPhone.slice(1).replace(/\D/g, '')
    if (digitsOnly.length < 8 || digitsOnly.length > 15) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
    }

    normalizedPhone = '+' + digitsOnly

    // Check if profile exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (checkError) {
      console.error('request-verification failed: error checking profile', checkError)
      return NextResponse.json({ error: 'Failed to check profile' }, { status: 500 })
    }

    // Save phone number to profile (update if exists, insert minimal row if not)
    if (existingProfile) {
      // Update existing profile - only touch WhatsApp verification fields
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          whatsapp_number: normalizedPhone,
          whatsapp_verified: false,
          whatsapp_verified_at: null,
          whatsapp_verify_code: null,
          whatsapp_verify_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select('id')

      if (updateError) {
        console.error('request-verification failed', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      if (!updatedProfile || updatedProfile.length === 0) {
        return NextResponse.json({ 
          error: 'Profile not found. Please save your profile first, then verify WhatsApp.' 
        }, { status: 409 })
      }
    } else {
      // Insert minimal profile row (only nullable fields to avoid NOT NULL constraints)
      const { data: insertedProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          whatsapp_number: normalizedPhone,
          whatsapp_verified: false,
          whatsapp_verified_at: null,
          whatsapp_verify_code: null,
          whatsapp_verify_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('request-verification failed', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      if (!insertedProfile) {
        return NextResponse.json({ 
          error: 'Failed to create profile. Please save your profile first.' 
        }, { status: 500 })
      }
    }

    // Send OTP via Twilio Verify
    const client = twilio(accountSid, authToken)

    try {
      await client.verify.v2
        .services(verifyServiceSid)
        .verifications
        .create({
          to: normalizedPhone,
          channel: channel === 'whatsapp' ? 'whatsapp' : 'sms',
        })

      return NextResponse.json({ 
        ok: true, 
        channel: channel === 'whatsapp' ? 'whatsapp' : 'sms' 
      })
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
    console.error('Error requesting verification:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
