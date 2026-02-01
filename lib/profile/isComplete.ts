type Profile = {
  display_name?: string | null
  technical_expertise?: string | null
  location_tz?: string | null
  skills_background?: string | null
  interests_building?: string | null
  linkedin_url?: string | null
  whatsapp_number?: string | null
}

// Required fields for profile completeness (before WhatsApp verification)
export const REQUIRED_FIELDS = [
  'display_name',
  'linkedin_url',
  'technical_expertise',
  'location_tz', // Location + Timezone combined
  'skills_background',
  'interests_building',
  'whatsapp_number',
] as const

function isFieldPresent(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim().length > 0
}

export function isProfileComplete(profile: Profile | null | undefined): boolean {
  if (!profile) {
    return false
  }

  return REQUIRED_FIELDS.every((field) => {
    const value = profile[field]
    return isFieldPresent(value)
  })
}

export function missingFields(profile: Profile | null | undefined): string[] {
  if (!profile) {
    return REQUIRED_FIELDS.map((f) => f.replace(/_/g, ' '))
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

  return missing
}
