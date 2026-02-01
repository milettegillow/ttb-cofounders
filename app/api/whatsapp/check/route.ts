import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import twilio from 'twilio'

export const runtime = 'nodejs'

/**
 * POST /api/whatsapp/check
 * 
 * Verifies an SMS OTP code for a phone number.
 * 
 * Body: { code: string } - The 6-digit OTP code received via SMS
 * 
 * Flow:
 * 1. Authenticate user
 * 2. Fetch user's whatsapp_e164 from profiles
 * 3. Verify code with Twilio Verify
 * 4. If approved, update profiles.whatsapp_verified = true
 * 
 * Returns: 
 * - { ok: true, status: "approved" } on successful verification
 * - { ok: false, status: "pending" | "canceled" } on other statuses
 * 
 * Errors:
 * - 401: Unauthorized
 * - 400: No phone number on profile or invalid code format
 * - 500: Twilio error or server error
 * 
 * Testing with curl:
 * curl -X POST http://localhost:3000/api/whatsapp/check \
 *   -H "Content-Type: application/json" \
 *   -H "Cookie: sb-<project>-auth-token=<token>" \
 *   -d '{"code":"123456"}'
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
    const { code } = body

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or invalid code field' }, { status: 400 })
    }

    // Fetch user's phone number
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whatsapp_number')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (!profile?.whatsapp_number) {
      return NextResponse.json({ error: 'No phone number on profile. Please request a verification code first.' }, { status: 400 })
    }

    // Verify code with Twilio
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID

    if (!accountSid || !authToken || !verifyServiceSid) {
      console.error('Missing Twilio credentials')
      return NextResponse.json({ error: 'SMS service not configured' }, { status: 500 })
    }

    const client = twilio(accountSid, authToken)

    try {
      const verificationCheck = await client.verify.v2
        .services(verifyServiceSid)
        .verificationChecks
        .create({
          to: profile.whatsapp_number,
          code: code.trim(),
        })

      // If verification is approved, update profile
      if (verificationCheck.status === 'approved') {
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .update({
            whatsapp_verified: true,
            whatsapp_verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .select('id')

        if (updateError) {
          console.error('Error updating profile:', updateError)
          return NextResponse.json({ error: 'Verification approved but failed to update profile' }, { status: 500 })
        }

        if (!updatedProfile || updatedProfile.length === 0) {
          return NextResponse.json({ error: 'Profile not found. Please save your profile first.' }, { status: 409 })
        }

        return NextResponse.json({ ok: true, status: 'approved' })
      } else {
        // Status is pending, canceled, or expired
        return NextResponse.json({ 
          ok: false, 
          status: verificationCheck.status,
          message: verificationCheck.status === 'pending' 
            ? 'Code verification is still pending'
            : verificationCheck.status === 'canceled'
            ? 'Verification was canceled'
            : 'Code expired or invalid'
        })
      }
    } catch (twilioError: any) {
      console.error('Twilio verification check error:', twilioError)
      
      // Return user-friendly error messages
      if (twilioError.code === 60202) {
        return NextResponse.json({ 
          ok: false, 
          status: 'expired',
          message: 'Verification code has expired. Please request a new code.' 
        }, { status: 400 })
      } else if (twilioError.code === 20404) {
        return NextResponse.json({ 
          ok: false, 
          status: 'not_found',
          message: 'No verification found. Please request a new code.' 
        }, { status: 400 })
      } else if (twilioError.code === 60203) {
        return NextResponse.json({ 
          ok: false, 
          status: 'max_attempts',
          message: 'Maximum verification attempts reached. Please request a new code.' 
        }, { status: 429 })
      } else {
        return NextResponse.json({ 
          ok: false,
          status: 'error',
          message: twilioError.message || 'Failed to verify code' 
        }, { status: 500 })
      }
    }
  } catch (error: any) {
    console.error('Error in /api/whatsapp/check:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
