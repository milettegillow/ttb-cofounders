type Profile = {
  display_name?: string | null
  technical_expertise?: string | null
  location_tz?: string | null
  skills_background?: string | null
  interests_building?: string | null
  linkedin_url?: string | null
  whatsapp_number?: string | null
  whatsapp_verified?: boolean | null
}

// Required fields for profile completeness
export const REQUIRED_FIELDS = [
  'display_name',
  'technical_expertise',
  'location_tz', // Location + Timezone combined
  'skills_background',
  'interests_building',
] as const

function isFieldPresent(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim().length > 0
}

export function isProfileComplete(profile: Profile | null | undefined): boolean {
  if (!profile) {
    return false
  }

  // Check all required fields are present
  const allFieldsPresent = REQUIRED_FIELDS.every((field) => {
    const value = profile[field]
    return isFieldPresent(value)
  })

  // Also require WhatsApp verification
  const whatsappVerified = profile.whatsapp_verified === true

  return allFieldsPresent && whatsappVerified
}

export function missingFields(profile: Profile | null | undefined): string[] {
  if (!profile) {
    return [...REQUIRED_FIELDS.map((f) => f.replace(/_/g, ' ')), 'WhatsApp Verified']
  }

  const missing: string[] = []
  
  REQUIRED_FIELDS.forEach((field) => {
    const value = profile[field]
    if (!isFieldPresent(value)) {
      // Convert snake_case to Title Case
      const fieldName = field
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase())
      missing.push(fieldName)
    }
  })

  // Add WhatsApp verification if not verified
  if (profile.whatsapp_verified !== true) {
    missing.push('WhatsApp Verified')
  }

  return missing
}
