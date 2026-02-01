import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabaseAdmin'
import crypto from 'crypto'

export const runtime = 'nodejs'

function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string
): boolean {
  // Build the signature string
  const data = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join('')
  const signatureString = url + data

  // Compute HMAC
  const computed = crypto
    .createHmac('sha1', authToken)
    .update(signatureString)
    .digest('base64')

  return computed === signature
}

export async function POST(request: NextRequest) {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN
    if (!authToken) {
      console.error('TWILIO_AUTH_TOKEN not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Get form data from Twilio webhook
    const formData = await request.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    // Validate Twilio signature
    const signature = request.headers.get('x-twilio-signature')
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    // Build the full URL for signature validation
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    const host = request.headers.get('host')
    const pathname = new URL(request.url).pathname
    const url = `${protocol}://${host}${pathname}`
    
    if (!validateTwilioSignature(url, params, signature, authToken)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Extract WhatsApp number and message body
    const from = params.From // e.g., "whatsapp:+447..."
    const body = params.Body || ''

    if (!from || !body) {
      return NextResponse.json({ error: 'Missing From or Body' }, { status: 400 })
    }

    // Normalize From to E.164 (remove "whatsapp:" prefix if present)
    const normalizedFrom = from.replace(/^whatsapp:/, '')

    // Extract verification code: TTB- followed by 6 digits
    const codeMatch = body.match(/(TTB-\d{6})/i)
    if (!codeMatch) {
      // Not a verification message, just acknowledge
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
        status: 200,
      })
    }

    const code = codeMatch[1]

    // Find profile with matching WhatsApp number and valid code
    // Try normalized first, then original format
    let profiles = null
    let queryError = null

    // Try with normalized number
    const { data: profiles1, error: error1 } = await supabaseAdmin
      .from('profiles')
      .select('id, whatsapp_number, whatsapp_verify_code, whatsapp_verify_expires_at')
      .eq('whatsapp_number', normalizedFrom)
      .eq('whatsapp_verify_code', code)
      .gt('whatsapp_verify_expires_at', new Date().toISOString())
      .limit(1)

    if (profiles1 && profiles1.length > 0) {
      profiles = profiles1
    } else {
      // Try with original format (whatsapp: prefix)
      const { data: profiles2, error: error2 } = await supabaseAdmin
        .from('profiles')
        .select('id, whatsapp_number, whatsapp_verify_code, whatsapp_verify_expires_at')
        .eq('whatsapp_number', from)
        .eq('whatsapp_verify_code', code)
        .gt('whatsapp_verify_expires_at', new Date().toISOString())
        .limit(1)

      profiles = profiles2
      queryError = error2
    }

    if (queryError) {
      console.error('Error querying profiles:', queryError)
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
        status: 200,
      })
    }

    if (!profiles || profiles.length === 0) {
      // Code not found or expired, just acknowledge
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
        status: 200,
      })
    }

    const profile = profiles[0]

    // Verify the profile
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        whatsapp_verified: true,
        whatsapp_verified_at: new Date().toISOString(),
        whatsapp_verify_code: null,
        whatsapp_verify_expires_at: null,
      })
      .eq('id', profile.id)

    if (updateError) {
      console.error('Error updating profile:', updateError)
    }

    // Respond with TwiML
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
      status: 200,
    })
  } catch (error: any) {
    console.error('Error processing inbound WhatsApp:', error)
    // Always return 200 to Twilio to avoid retries
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
      status: 200,
    })
  }
}
