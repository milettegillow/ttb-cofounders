export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabaseAdmin'
import { requireAdmin, verifyAdmin } from '@/lib/admin/verify'
import { Resend } from 'resend'

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) {
    return authError
  }

  const { data, error } = await supabaseAdmin
    .from('pre_applications')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) {
    return authError
  }

  const body = await request.json()
  const { id, status, reviewer_notes } = body

  if (!id || !status || (status !== 'approved' && status !== 'rejected')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Fetch the application first to get email and linkedin
  const { data: application, error: fetchError } = await supabaseAdmin
    .from('pre_applications')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !application) {
    return NextResponse.json({ error: fetchError?.message || 'Application not found' }, { status: 500 })
  }

  // Helper function to get or create auth user ID
  async function getOrCreateAuthUserId(email: string, redirectTo: string): Promise<string> {
    const normalizedEmail = email.trim().toLowerCase()

    // First attempt: invite user (creates if doesn't exist)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      { redirectTo }
    )

    // If invite succeeds, return the user ID
    if (inviteData?.user?.id) {
      return inviteData.user.id
    }

    // If invite fails with "already registered" or 422, fallback to existing user lookup
    if (inviteError) {
      const isAlreadyRegistered = 
        inviteError.message?.toLowerCase().includes('already been registered') ||
        inviteError.message?.toLowerCase().includes('already registered') ||
        inviteError.message?.toLowerCase().includes('already exists') ||
        inviteError.status === 422

      if (isAlreadyRegistered) {
        console.log('[admin] User already registered, looking up existing user:', normalizedEmail)
        
        // Fallback: find existing user by email
        const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          perPage: 1000,
        })

        if (listError) {
          console.error('[admin] Failed to list users for lookup:', listError.message)
          throw new Error('Auth user exists but could not be looked up')
        }

        const existingUser = usersData?.users?.find(
          (u) => u.email?.toLowerCase() === normalizedEmail
        )

        if (!existingUser) {
          console.error('[admin] User not found in listUsers after invite failure:', normalizedEmail)
          throw new Error('Auth user exists but could not be looked up')
        }

        return existingUser.id
      } else {
        // Other invite errors are fatal
        console.error('[admin] Failed to invite user:', inviteError.message)
        throw new Error(inviteError.message || 'Failed to create user account')
      }
    }

    // Should not reach here, but handle edge case
    throw new Error('Failed to obtain user ID')
  }

  // If approved, ensure auth user exists, create profile, send email, then update status
  let profileUpserted = false
  let profileError: any = null

  if (status === 'approved') {
    if (!application.email) {
      console.error('[admin] Cannot create profile: application email is missing')
      return NextResponse.json({ 
        error: 'Application email is missing',
        approved: false,
        profileUpserted: false 
      }, { status: 400 })
    }

    const normalizedEmail = application.email.trim().toLowerCase()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const redirectTo = `${siteUrl}/auth/callback`

    // Step 1: Get or create auth user ID
    let userId: string
    try {
      userId = await getOrCreateAuthUserId(application.email, redirectTo)
    } catch (error: any) {
      console.error('[admin] Failed to get or create auth user:', error.message)
      return NextResponse.json({ 
        error: error.message || 'Failed to get or create user account',
        approved: false,
        profileUpserted: false 
      }, { status: 500 })
    }

    // Step 2: Upsert profile with user ID
    const linkedinUrl = application.linkedin_url || application.linkedin || null

const profileData = {
  user_id: userId,
  email: normalizedEmail,
  linkedin_url: linkedinUrl,
  is_complete: false,
  is_live: false,
}

// Upsert by user_id (this is the stable key you control)
const { error: upsertError } = await supabaseAdmin
  .from('profiles')
  .upsert(profileData, { onConflict: 'user_id' })


    if (upsertError) {
      console.error('[admin] Failed to upsert profile:', upsertError)
      profileError = upsertError
      // Transaction-like: don't mark as approved if profile upsert fails
      return NextResponse.json({ 
        error: upsertError.message || 'Failed to create profile',
        approved: false,
        profileUpserted: false,
        profileError: upsertError.message 
      }, { status: 500 })
    }

    profileUpserted = true

    // Step 3: Generate magic link and send approval email (only after profile is created)
    // Transactional: if email fails, do NOT finalize approval
    if (!process.env.RESEND_API_KEY) {
      console.error('[admin] RESEND_API_KEY is not set - cannot send approval email')
      // Do NOT update status - return error so approval is not finalized
      return NextResponse.json({ 
        error: 'Email service not configured - approval not finalized',
        approved: false,
        profileUpserted: true,
        emailSent: false,
        emailError: 'RESEND_API_KEY is not set'
      }, { status: 500 })
    }

    // Generate magic link using Supabase admin auth
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: {
        redirectTo,
      },
    })

    if (linkError || !linkData) {
      console.error('[admin] Failed to generate magic link:', linkError?.message)
      // Do NOT update status - return error so approval is not finalized
      return NextResponse.json({ 
        error: 'Failed to generate sign-in link - approval not finalized',
        approved: false,
        profileUpserted: true,
        emailSent: false,
        emailError: linkError?.message || 'Failed to generate sign-in link'
      }, { status: 500 })
    }

    // Send approval email using Resend
    const resend = new Resend(process.env.RESEND_API_KEY)
    
    const { error: emailError } = await resend.emails.send({
      from: 'The Tech Bros <no-reply@thetechbros.io>',
      to: normalizedEmail,
      subject: "You're approved — sign in to The Tech Bros co-founder matching",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #EF1F9F;">You're approved!</h2>
          <p>Great news — your application to The Tech Bros co-founder matching platform has been approved.</p>
          <p>Click the button below to sign in and complete your profile:</p>
          <div style="margin: 30px 0;">
            <a href="${linkData.properties.action_link}" 
               style="display: inline-block; padding: 12px 24px; background-color: #EF1F9F; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Sign in
            </a>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${linkData.properties.action_link}" style="color: #EF1F9F;">${linkData.properties.action_link}</a>
          </p>
        </div>
      `,
    })

    if (emailError) {
      console.error('[admin] Failed to send approval email:', emailError.message)
      // Do NOT update status - return error so approval is not finalized
      return NextResponse.json({ 
        error: 'Failed to send approval email - approval not finalized',
        approved: false,
        profileUpserted: true,
        emailSent: false,
        emailError: emailError.message || 'Failed to send approval email'
      }, { status: 500 })
    }

    // Email sent successfully - proceed to update status
  }

  // Update application status (only after profile is created successfully if approved)
  // For approved status, only update if profile was successfully upserted
  if (status === 'approved' && !profileUpserted) {
    // Profile upsert failed, don't update status - return error
    return NextResponse.json({ 
      error: 'Failed to create profile',
      approved: false,
      profileUpserted: false,
      ...(profileError ? { profileError: profileError.message } : {}),
    }, { status: 500 })
  }

  const { data, error } = await supabaseAdmin
    .from('pre_applications')
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

  // Return response with status information
  return NextResponse.json({
    ...data,
    approved: status === 'approved',
    profileUpserted: profileUpserted,
    emailSent: status === 'approved' && profileUpserted && !profileError,
    ...(profileError ? { profileError: profileError.message } : {}),
  })
}
