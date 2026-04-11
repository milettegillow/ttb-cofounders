import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabaseAdmin'

async function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, userId: null }
  }

  const token = authHeader.substring(7)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !user?.id) {
    return { authorized: false, userId: null }
  }

  return { authorized: true, userId: user.id }
}

const PROFILE_SELECT = 'id, user_id, display_name, domain_expertise, technical_expertise, location_tz, skills_background, interests_building, links, linkedin_url, whatsapp_number, whatsapp_verified, whatsapp_verified_at, whatsapp_verify_code, whatsapp_verify_expires_at, availability, is_complete, is_live, photo_path, photo_updated_at, email'

export async function PATCH(request: NextRequest) {
  const { authorized, userId } = await verifyToken(request)
  if (!authorized || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Build the upsert payload — only include fields the client sent
  const payload: Record<string, any> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  }

  const allowedFields = [
    'display_name', 'domain_expertise', 'technical_expertise',
    'location_tz', 'availability', 'skills_background',
    'interests_building', 'links', 'linkedin_url',
    'whatsapp_number', 'email', 'is_live',
    'photo_path', 'photo_updated_at',
  ]

  for (const field of allowedFields) {
    if (field in body) {
      payload[field] = body[field]
    }
  }

  // Calculate is_complete from the merged state
  // We need the current saved profile to merge with incoming changes
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('user_id', userId)
    .maybeSingle()

  const merged = { ...existing, ...payload }

  const isComplete = isProfileCompleteCheck(merged)
  payload.is_complete = isComplete

  // Safety: never allow live when incomplete
  if (!isComplete && merged.is_live) {
    payload.is_live = false
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select(PROFILE_SELECT)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// Mirror of lib/profile/isComplete.ts logic — kept in sync
function isProfileCompleteCheck(profile: Record<string, any>): boolean {
  const requiredFields = [
    'display_name', 'technical_expertise', 'location_tz',
    'skills_background', 'interests_building',
  ]

  const allFieldsPresent = requiredFields.every((field) => {
    const value = profile[field]
    return value !== null && value !== undefined && String(value).trim().length > 0
  })

  const whatsappVerified = profile.whatsapp_verified === true
  const hasPhoto = profile.photo_path !== null && profile.photo_path !== undefined && String(profile.photo_path).trim().length > 0

  return allFieldsPresent && whatsappVerified && hasPhoto
}
