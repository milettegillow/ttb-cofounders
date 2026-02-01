'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/src/lib/supabaseClient'
import { isProfileComplete, missingFields } from '@/lib/profile/isComplete'
import { parsePhoneNumberFromString, getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js'
import countries from 'i18n-iso-countries'
import enLocale from 'i18n-iso-countries/langs/en.json'

// Register English locale for country names
countries.registerLocale(enLocale)

type Application = {
  id: string
  user_id: string
  status: 'pending' | 'approved' | 'rejected'
}

type Profile = {
  id: string
  user_id: string
  display_name: string
  domain_expertise: string | null
  technical_expertise: string | null
  location_tz: string | null
  skills_background: string | null
  interests_building: string | null
  links: string | null
  linkedin_url: string | null
  whatsapp_number: string | null
  whatsapp_verified: boolean
  whatsapp_verified_at: string | null
  whatsapp_verify_code: string | null
  whatsapp_verify_expires_at: string | null
  availability: string | null
  is_complete: boolean
  is_live: boolean
}

export default function Profile() {
  const [session, setSession] = useState<any>(null)
  const [application, setApplication] = useState<Application | null>(null)
  const [savedProfile, setSavedProfile] = useState<Profile | null>(null) // Source of truth from DB
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingVisibility, setSavingVisibility] = useState(false)
  const [savingWhatsApp, setSavingWhatsApp] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [verifyingWhatsApp, setVerifyingWhatsApp] = useState(false)
  const [verificationCodeSent, setVerificationCodeSent] = useState(false)
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [checkingCode, setCheckingCode] = useState(false)
  const [whatsAppCountry, setWhatsAppCountry] = useState<CountryCode>('GB')
  const [callingCode, setCallingCode] = useState<string>('44') // digits only (no +)
  const [whatsappNational, setWhatsappNational] = useState<string>('')
  const [whatsappE164, setWhatsappE164] = useState<string | null>(null)
  const [whatsappPretty, setWhatsappPretty] = useState<string | null>(null)
  const [whatsappError, setWhatsappError] = useState<string | null>(null)
  const whatsappInputRef = useRef<HTMLInputElement>(null)

  // Build map from calling code to countries (for syncing country when code changes)
  const codeToCountries = useMemo(() => {
    const m: Record<string, CountryCode[]> = {}
    const allCountries = getCountries()
    for (const country of allCountries) {
      try {
        const code = getCountryCallingCode(country)
        if (!m[code]) m[code] = []
        m[code].push(country)
      } catch (e) {
        // Skip if country doesn't have a calling code
      }
    }
    return m
  }, [])

  // Build full country options list (all countries, sorted alphabetically)
  const countryOptions = useMemo(() => {
    const allCountries = getCountries()
    return allCountries
      .map((code) => ({ code, name: countries.getName(code, 'en') || code }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [])

  // Country examples for helper text
  const COUNTRY_EXAMPLES: Record<string, string> = {
    GB: '7700 900123',
    US: '212 555 0199',
    CA: '416 555 0199',
    IE: '85 123 4567',
    DE: '151 23456789',
    FR: '6 12 34 56 78',
    NL: '6 12345678',
    DK: '20 12 34 56',
    NO: '912 34 567',
    SE: '70 123 45 67',
  }

  // Format national number with spaces (helper for auto-formatting)
  const formatNationalNumber = useCallback((national: string, country: CountryCode, code?: string): string => {
    if (!national || national.trim() === '') {
      return national
    }

    const codeToUse = code || getCountryCallingCode(country)
    if (!codeToUse) {
      return national
    }

    // Get digits only for parsing
    const digitsOnly = national.replace(/\s/g, '')
    if (digitsOnly.length === 0) {
      return national
    }

    // Build candidate with calling code
    const candidate = `+${codeToUse} ${digitsOnly}`
    const parsed = parsePhoneNumberFromString(candidate)

    // If parsed and valid-ish (country matches OR country undefined but possible)
    if (parsed && (parsed.country === country || (!parsed.country && parsed.isPossible()))) {
      // Format with spaces, remove punctuation
      const formatted = parsed.formatNational()
      // Normalize: remove parentheses and hyphens, normalize spaces
      const normalized = formatted.replace(/[()\-]/g, '').replace(/\s+/g, ' ').trim()
      return normalized
    }

    // Return as typed if not parsable
    return national
  }, [])

  // Handle WhatsApp national input change
  const handleWhatsAppNationalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length
    
    // Get raw value and normalize (digits and spaces only)
    const nextRaw = e.target.value.replace(/[^\d\s]/g, '')
    
    // If typing at the end, apply formatting
    if (atEnd) {
      const formatted = formatNationalNumber(nextRaw, whatsAppCountry, callingCode)
      setWhatsappNational(formatted)
      validateWhatsApp(formatted, whatsAppCountry, callingCode)
      
      // Restore cursor position at end after state update
      setTimeout(() => {
        if (whatsappInputRef.current) {
          const newLength = formatted.length
          whatsappInputRef.current.setSelectionRange(newLength, newLength)
        }
      }, 0)
    } else {
      // Don't reformat mid-string edits
      setWhatsappNational(nextRaw)
      validateWhatsApp(nextRaw, whatsAppCountry, callingCode)
    }
  }

  // Validate WhatsApp number
  const validateWhatsApp = useCallback((national: string, country: CountryCode, code?: string) => {
    if (!national || national.trim() === '') {
      setWhatsappError(null)
      setWhatsappE164(null)
      setWhatsappPretty(null)
      return
    }

    const codeToUse = code || callingCode
    if (!codeToUse) {
      setWhatsappError('Invalid calling code')
      return
    }

    const candidate = `+${codeToUse} ${national.trim()}`
    const parsed = parsePhoneNumberFromString(candidate)
    const countryName = countryOptions.find(c => c.code === country)?.name || country

    if (!parsed || !parsed.isValid() || parsed.country !== country) {
      setWhatsappError(`Enter a valid number for ${countryName}`)
      setWhatsappE164(null)
      setWhatsappPretty(null)
    } else {
      setWhatsappError(null)
      setWhatsappE164(parsed.number)
      setWhatsappPretty(parsed.formatInternational())
    }
  }, [callingCode, countryOptions])

  // Handle WhatsApp blur
  const handleWhatsAppBlur = () => {
    validateWhatsApp(whatsappNational, whatsAppCountry, callingCode)
  }

  // Handle country change
  const handleCountryChange = (next: CountryCode) => {
    setWhatsAppCountry(next)
    const newCode = getCountryCallingCode(next)
    setCallingCode(newCode)
    // Re-validate with new country
    if (whatsappNational) {
      validateWhatsApp(whatsappNational, next, newCode)
    }
  }

  // Verify WhatsApp (saves number first, then requests verification)
  const handleVerifyWhatsApp = async () => {
    if (!session?.user?.id || !whatsappE164) {
      setMessage('Please enter a valid WhatsApp number first.')
      return
    }

    setSavingWhatsApp(true)
    setVerifyingWhatsApp(true)
    setMessage(null)

    // Request verification via API (server handles profile update)
    try {
      const response = await fetch('/api/whatsapp/request-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneE164: whatsappE164, channel: 'sms' }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        // Debug log
        console.error('request-verification failed:', responseData)
        
        if (response.status === 409) {
          // Profile doesn't exist - show inline message
          setMessage('Please save your profile first, then verify WhatsApp.')
        } else {
          setMessage(responseData.error || 'Failed to request verification')
        }
        setSavingWhatsApp(false)
        setVerifyingWhatsApp(false)
        return
      }

      setMessage('Verification code sent! Check your SMS messages for the code.')
      setVerificationCodeSent(true)
      setSavingWhatsApp(false)
      setVerifyingWhatsApp(false) // Code sent, now waiting for user to enter it

      // Refresh saved profile to get updated WhatsApp number
      const { data: refreshedProfile } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, domain_expertise, technical_expertise, location_tz, skills_background, interests_building, links, linkedin_url, whatsapp_number, whatsapp_verified, whatsapp_verified_at, whatsapp_verify_code, whatsapp_verify_expires_at, availability, is_complete, is_live')
        .eq('user_id', session.user.id)
        .single()
      
      if (refreshedProfile) {
        setSavedProfile(refreshedProfile)
      }

    } catch (err: any) {
      setMessage(err.message || 'Failed to request verification')
      setSavingWhatsApp(false)
      setVerifyingWhatsApp(false)
    }
  }

  // Handle code verification
  const handleVerifyCode = async () => {
    if (!session?.user?.id || !verificationCode || verificationCode.trim().length === 0) {
      setMessage('Please enter the verification code.')
      return
    }

    setCheckingCode(true)
    setMessage(null)

    try {
      const response = await fetch('/api/whatsapp/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: verificationCode.trim() }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        console.error('verify-code failed:', responseData)
        setMessage(responseData.message || responseData.error || 'Failed to verify code')
        setCheckingCode(false)
        return
      }

      if (responseData.ok && responseData.status === 'approved') {
        setMessage('Phone number verified successfully!')
        setVerificationCodeSent(false)
        setVerificationCode('')
        
        // Refresh saved profile
        const { data: refreshedProfile } = await supabase
          .from('profiles')
          .select('id, user_id, display_name, domain_expertise, technical_expertise, location_tz, skills_background, interests_building, links, linkedin_url, whatsapp_number, whatsapp_verified, whatsapp_verified_at, whatsapp_verify_code, whatsapp_verify_expires_at, availability, is_complete, is_live')
          .eq('user_id', session.user.id)
          .single()
        
        if (refreshedProfile) {
          setSavedProfile(refreshedProfile)
        }
      } else {
        setMessage(responseData.message || 'Code verification failed. Please try again.')
      }
    } catch (err: any) {
      console.error('Error verifying code:', err)
      setMessage(err.message || 'Failed to verify code')
    }

    setCheckingCode(false)
  }

  const [formData, setFormData] = useState({
    display_name: '',
    domain_expertise: '',
    technical_expertise: '',
    location_tz: '',
    availability: '',
    skills_background: '',
    interests_building: '',
    links: '',
    linkedin_url: '',
    whatsapp_number: '',
  })

  // Track dirty state when form changes
  useEffect(() => {
    if (!savedProfile) return
    
    const isFormDirty = 
      formData.display_name !== (savedProfile.display_name || '') ||
      formData.domain_expertise !== (savedProfile.domain_expertise || '') ||
      formData.technical_expertise !== (savedProfile.technical_expertise || '') ||
      formData.location_tz !== (savedProfile.location_tz || '') ||
      formData.availability !== (savedProfile.availability || '') ||
      formData.skills_background !== (savedProfile.skills_background || '') ||
      formData.interests_building !== (savedProfile.interests_building || '') ||
      formData.links !== (savedProfile.links || '') ||
      formData.linkedin_url !== (savedProfile.linkedin_url || '')
      // Note: WhatsApp number dirty state is handled separately via handleSaveWhatsApp
    
    setIsDirty(isFormDirty)
  }, [formData, savedProfile])

  useEffect(() => {
    // Initialize calling code from default country
    setCallingCode(getCountryCallingCode('GB'))
    
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session)
        fetchApplication(data.session.user.id)
      } else {
        setLoading(false)
      }
    })
  }, [])

  const fetchApplication = async (userId: string) => {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      setMessage(`Error loading application: ${error.message}`)
      setLoading(false)
      return
    }

    if (!data || data.status !== 'approved') {
      setApplication(null)
      setLoading(false)
      return
    }

    setApplication(data)
    fetchProfile(userId)
  }

  const fetchProfile = async (userId: string) => {
    try {
      // Fetch profile - select only existing columns
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, domain_expertise, technical_expertise, location_tz, skills_background, interests_building, links, linkedin_url, whatsapp_number, whatsapp_verified, whatsapp_verified_at, whatsapp_verify_code, whatsapp_verify_expires_at, availability, is_complete, is_live')
        .eq('user_id', userId)
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        setMessage(`Error loading profile: ${error.message}`)
        setLoading(false)
        return
      }

      if (data) {
        setSavedProfile(data) // Update saved state
        
        // Migrate old location/timezone to location_tz if needed
        let locationTz = data.location_tz || ''
        if (!locationTz && (data as any).location) {
          locationTz = (data as any).location
        }
        
        // Load WhatsApp number and extract national number
        const loadedWhatsappE164 = data.whatsapp_number || null
        setWhatsappE164(loadedWhatsappE164)
        
        if (loadedWhatsappE164) {
          const parsed = parsePhoneNumberFromString(loadedWhatsappE164)
          if (parsed && parsed.isValid()) {
            const country = parsed.country || 'GB'
            setWhatsAppCountry(country)
            const code = getCountryCallingCode(country)
            setCallingCode(code)
            // Get national number - use formatNational and clean it to digits + spaces only
            const formatted = parsed.formatNational()
            // Remove all non-digit, non-space characters, then normalize spaces
            const cleaned = formatted.replace(/[^\d\s]/g, '').replace(/\s+/g, ' ').trim()
            setWhatsappNational(cleaned || parsed.nationalNumber)
            setWhatsappPretty(parsed.formatInternational())
            setWhatsappError(null)
          } else {
            setWhatsappNational('')
            setWhatsappPretty(null)
            setWhatsappError('Invalid saved number. Please update it.')
            setCallingCode(getCountryCallingCode('GB'))
          }
        } else {
          setWhatsappNational('')
          setWhatsappPretty(null)
          setWhatsappError(null)
          setCallingCode(getCountryCallingCode('GB'))
        }
        
        setFormData({
          display_name: data.display_name || '',
          domain_expertise: data.domain_expertise || '',
          technical_expertise: data.technical_expertise || '',
          location_tz: locationTz,
          availability: data.availability || '',
          skills_background: data.skills_background || '',
          interests_building: data.interests_building || '',
          links: data.links || '',
          linkedin_url: data.linkedin_url || '',
          whatsapp_number: '', // Not used anymore, kept for backward compatibility
        })
        setIsDirty(false) // Reset dirty state after loading
      }
    } catch (err: any) {
      setMessage(`Error loading profile: ${err.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user?.id) return

    setSavingProfile(true)
    setMessage(null)

    // Build profile object to check completeness (use form data + saved verification status)
    const profileForCompleteness = {
      display_name: formData.display_name,
      technical_expertise: formData.technical_expertise,
      location_tz: formData.location_tz,
      skills_background: formData.skills_background,
      interests_building: formData.interests_building,
      whatsapp_verified: savedProfile?.whatsapp_verified || false,
    }

    // Safety: never allow live when incomplete
    const complete = isProfileComplete(profileForCompleteness)
    const currentIsLive = savedProfile?.is_live || false
    const shouldBeLive = complete && currentIsLive

    // Upsert payload - always use user_id
    const payload = {
      user_id: session.user.id,
      display_name: formData.display_name || null,
      domain_expertise: formData.domain_expertise || null,
      technical_expertise: formData.technical_expertise || null,
      location_tz: formData.location_tz || null,
      availability: formData.availability || null,
      skills_background: formData.skills_background || null,
      interests_building: formData.interests_building || null,
      links: formData.links || null,
      linkedin_url: formData.linkedin_url || null,
      // Note: WhatsApp number is saved separately via handleSaveWhatsApp
      // Keep existing whatsapp_number if not explicitly saving it here
      whatsapp_number: savedProfile?.whatsapp_number ?? null,
      updated_at: new Date().toISOString(),
      // IMPORTANT: keep your existing shouldBeLive logic, but never allow live if incomplete
      is_live: shouldBeLive,
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select('id, user_id, display_name, domain_expertise, technical_expertise, location_tz, skills_background, interests_building, links, linkedin_url, whatsapp_number, whatsapp_verified, whatsapp_verified_at, whatsapp_verify_code, whatsapp_verify_expires_at, availability, is_complete, is_live')
      .single()

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('Profile saved successfully!')
      setSavedProfile(data) // Update saved state with returned data
      setIsDirty(false) // Reset dirty state
    }

    setSavingProfile(false)
  }



  const setDiscoverable = async (next: boolean) => {
    if (!session?.user?.id || !savedProfile) return

    // Guard: check if enabled (complete, not dirty, not saving)
    const isCompleteSaved = isProfileComplete(savedProfile)
    if (!isCompleteSaved || isDirty || savingProfile) {
      return
    }

    // Confirmation when turning Discoverable ON
    if (next) {
      const confirmed = window.confirm(
        'Going Discoverable means your WhatsApp number will be shared automatically with matches. Continue?'
      )
      if (!confirmed) {
        return
      }
    }

    setSavingVisibility(true)
    setMessage(null)

    const { data, error } = await supabase
      .from('profiles')
      .update({ is_live: next, updated_at: new Date().toISOString() })
      .eq('id', savedProfile.id)
      .select()
      .single()

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage(next ? 'Profile is now discoverable!' : 'Profile is now hidden.')
      setSavedProfile(data) // Update saved state
    }

    setSavingVisibility(false)
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (!session) {
    return (
      <div>
        <p>Please sign in</p>
        <Link href="/apply">Go to sign in</Link>
      </div>
    )
  }

  if (!application || application.status !== 'approved') {
    return (
      <div>
        <p>Your application isn't approved yet.</p>
        <Link href="/apply">Go to application</Link>
      </div>
    )
  }

  // Compute completeness from saved profile only (for Discoverable gating)
  const isCompleteSaved = isProfileComplete(savedProfile)
  const isDiscoverableEnabled = isCompleteSaved && !isDirty && !savingProfile

  // Convert formData to Profile shape for draft completeness check
  const formDataAsProfileShape = {
    display_name: formData.display_name?.trim() || null,
    technical_expertise: formData.technical_expertise?.trim() || null,
    location_tz: formData.location_tz?.trim() || null,
    skills_background: formData.skills_background?.trim() || null,
    interests_building: formData.interests_building?.trim() || null,
    linkedin_url: formData.linkedin_url?.trim() || null,
    whatsapp_number: whatsappE164, // Use validated E.164 format
    whatsapp_verified: savedProfile?.whatsapp_verified || false,
  }

  // Compute missing fields for draft and saved
  const draftMissing = missingFields(formDataAsProfileShape)
  const savedMissing = missingFields(savedProfile)

  return (
    <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
      <div className="ttb-panel">
        {/* Header row: Signed in as + Sign out */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border)'
        }}>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>
            Signed in as {session.user.email}
          </p>
          <button 
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/'
            }}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '6px 12px',
              cursor: 'pointer',
              color: 'var(--ink)',
              fontSize: '14px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--pink)'
              e.currentTarget.style.opacity = '0.9'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.opacity = '1'
            }}
          >
            Sign out
          </button>
        </div>

        <h1 style={{ marginTop: '0', marginBottom: '16px' }}>Profile</h1>

        {/* Real-time missing fields banner */}
        <div style={{ marginBottom: '24px' }}>
          {draftMissing.length === 0 ? (
            <div style={{ 
              padding: '12px 16px',
              background: 'rgba(92, 225, 230, 0.1)',
              border: '1px solid rgba(92, 225, 230, 0.3)',
              borderRadius: '8px',
              color: 'var(--teal)',
              fontSize: '14px'
            }}>
              ✅ Looks good — save to apply changes
            </div>
          ) : (
            <div style={{ 
              padding: '12px 16px',
              background: 'rgba(255, 193, 7, 0.1)',
              border: '1px solid rgba(255, 193, 7, 0.3)',
              borderRadius: '8px',
              color: '#ffc107',
              fontSize: '14px'
            }}>
              ⚠️ Incomplete (draft): Missing {draftMissing.slice(0, 3).join(', ')}{draftMissing.length > 3 ? ` and ${draftMissing.length - 3} more` : ''}
            </div>
          )}
          
          {isDirty && (
            <p style={{ 
              margin: '8px 0 0 0',
              fontSize: '12px',
              color: 'var(--muted)',
              fontStyle: 'italic'
            }}>
              Not saved yet
            </p>
          )}
        </div>

        {message && (
          <div style={{ 
            marginBottom: '20px',
            padding: '12px 16px',
            background: message.includes('Error') ? 'rgba(239, 31, 159, 0.1)' : 'rgba(92, 225, 230, 0.1)',
            border: `1px solid ${message.includes('Error') ? 'rgba(239, 31, 159, 0.3)' : 'rgba(92, 225, 230, 0.3)'}`,
            borderRadius: '8px',
            color: message.includes('Error') ? 'var(--pink)' : 'var(--teal)',
            fontSize: '14px'
          }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--ink)', fontWeight: '500' }}>
              Display Name: *
            </label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) =>
                setFormData({ ...formData, display_name: e.target.value })
              }
              required
              disabled={savingProfile}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0, 0, 0, 0.3)', color: 'var(--ink)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--ink)', fontWeight: '500' }}>
              LinkedIn URL: *
            </label>
            <input
              type="url"
              value={formData.linkedin_url}
              onChange={(e) =>
                setFormData({ ...formData, linkedin_url: e.target.value })
              }
              required
              disabled={savingProfile}
              placeholder="https://linkedin.com/in/yourprofile"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0, 0, 0, 0.3)', color: 'var(--ink)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--ink)', fontWeight: '500' }}>
              Domain Expertise:
            </label>
            <input
              type="text"
              value={formData.domain_expertise}
              onChange={(e) =>
                setFormData({ ...formData, domain_expertise: e.target.value })
              }
              disabled={savingProfile}
              placeholder="e.g., Healthcare, Fintech, EdTech"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0, 0, 0, 0.3)', color: 'var(--ink)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--ink)', fontWeight: '500' }}>
              Technical Expertise: *
            </label>
            <input
              type="text"
              value={formData.technical_expertise}
              onChange={(e) =>
                setFormData({ ...formData, technical_expertise: e.target.value })
              }
              required
              disabled={savingProfile}
              placeholder="e.g., Full-stack, ML/AI, Mobile, DevOps"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0, 0, 0, 0.3)', color: 'var(--ink)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--ink)', fontWeight: '500' }}>
              Location + Timezone: *
            </label>
            <input
              type="text"
              value={formData.location_tz}
              onChange={(e) =>
                setFormData({ ...formData, location_tz: e.target.value })
              }
              required
              disabled={savingProfile}
              placeholder="e.g., London, GMT or San Francisco, PT"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0, 0, 0, 0.3)', color: 'var(--ink)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--ink)', fontWeight: '500' }}>
              My Availability: *
            </label>
            <input
              type="text"
              value={formData.availability}
              onChange={(e) =>
                setFormData({ ...formData, availability: e.target.value })
              }
              required
              disabled={savingProfile}
              placeholder="e.g., Working full-time on my startup, Student with <1y left, Currently in a job I have to quit"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0, 0, 0, 0.3)', color: 'var(--ink)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--ink)', fontWeight: '500' }}>
              Skills & background: *
            </label>
            <textarea
              value={formData.skills_background}
              onChange={(e) =>
                setFormData({ ...formData, skills_background: e.target.value })
              }
              required
              disabled={savingProfile}
              rows={4}
              placeholder="Tell us about your technical skills, professional background, relevant experience, and what you bring to a cofounder partnership (~100 words)"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0, 0, 0, 0.3)', color: 'var(--ink)', fontFamily: 'inherit', resize: 'vertical' }}
            />
            <p style={{ marginTop: '4px', fontSize: '12px', color: 'var(--muted)' }}>~100 words</p>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--ink)', fontWeight: '500' }}>
              Interested in Exploring Building: *
            </label>
            <textarea
              value={formData.interests_building}
              onChange={(e) =>
                setFormData({ ...formData, interests_building: e.target.value })
              }
              required
              disabled={savingProfile}
              rows={4}
              placeholder="What are you interested in building or exploring? Describe your startup ambitions, the problems you want to solve, industries you're passionate about, and what kind of cofounder partnership you're seeking (~100 words)"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0, 0, 0, 0.3)', color: 'var(--ink)', fontFamily: 'inherit', resize: 'vertical' }}
            />
            <p style={{ marginTop: '4px', fontSize: '12px', color: 'var(--muted)' }}>~100 words</p>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--ink)', fontWeight: '500' }}>
              GitHub / Other Links:
            </label>
            <textarea
              value={formData.links}
              onChange={(e) =>
                setFormData({ ...formData, links: e.target.value })
              }
              disabled={savingProfile}
              rows={3}
              placeholder="GitHub, portfolio, or other relevant links"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0, 0, 0, 0.3)', color: 'var(--ink)', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

          <div style={{ marginTop: 0 }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--ink)', fontWeight: 500 }}>
              WhatsApp Number: *
            </label>

            <div className="waWrap">
              <div className="waCountry">
                <select
                  value={whatsAppCountry}
                  onChange={(e) => {
                    handleCountryChange(e.target.value as CountryCode)
                  }}
                  disabled={savingProfile || savingWhatsApp}
                  className="waSelect"
                  style={{
                    cursor: (savingProfile || savingWhatsApp) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {countryOptions.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="waNumber">
                <div className="waInputRow">
                  <input
                    className="waCodeInput"
                    value={"+" + callingCode}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d]/g, "")
                      setCallingCode(digits)
                      // Attempt to auto-set country from calling code
                      const countries = codeToCountries[digits] ?? []
                      if (countries.length === 1) {
                        setWhatsAppCountry(countries[0])
                      } else if (countries.length > 1) {
                        // If current country is in the list, keep it
                        if (countries.includes(whatsAppCountry)) {
                          // Keep current country
                        } else if (digits === '1') {
                          // Default to US for +1
                          setWhatsAppCountry('US')
                        } else if (digits === '44') {
                          // Default to GB for +44
                          setWhatsAppCountry('GB')
                        } else if (countries.includes('US')) {
                          // Default to US if available
                          setWhatsAppCountry('US')
                        } else {
                          // Set to first in list
                          setWhatsAppCountry(countries[0])
                        }
                      }
                      // Re-validate with new calling code
                      if (whatsappNational) {
                        validateWhatsApp(whatsappNational, whatsAppCountry, digits)
                      }
                    }}
                    inputMode="tel"
                    aria-label="Country calling code"
                    disabled={savingProfile || savingWhatsApp}
                  />

                  <input
                    ref={whatsappInputRef}
                    type="text"
                    value={whatsappNational}
                    onChange={handleWhatsAppNationalChange}
                    onBlur={handleWhatsAppBlur}
                    disabled={savingProfile || savingWhatsApp}
                    placeholder={COUNTRY_EXAMPLES[whatsAppCountry]}
                    className="waInput"
                    inputMode="tel"
                    autoComplete="tel"
                  />

                  {(savedProfile?.whatsapp_verified ?? false) && (
                    <span className="waVerified">✓ Verified</span>
                  )}
                </div>

                {whatsappError && <p className="waError">{whatsappError}</p>}
              </div>
            </div>
            {whatsappNational.trim().length > 0 && !(savedProfile?.whatsapp_verified) && (
              <div className="waVerifyBlock">
                <p className="waVerifyText">
                  To become Discoverable, you need to verify your phone number. When you match with someone, your WhatsApp is shared automatically so you can contact each other.
                </p>
                <div className="waVerifyButton">
                  <button
                    type="button"
                    onClick={handleVerifyWhatsApp}
                    disabled={savingWhatsApp || verifyingWhatsApp || !whatsappE164 || !!whatsappError}
                    className="ttb-btn ttb-btn-secondary"
                  >
                    {savingWhatsApp || verifyingWhatsApp ? 'Verifying...' : 'Verify WhatsApp'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <style jsx>{`
            .waWrap {
              display: grid;
              gap: 12px;
            }

            /* Desktop: country left, number right */
            @media (min-width: 640px) {
              .waWrap {
                grid-template-columns: 220px 1fr;
                align-items: start;
              }
            }

            .waSelect {
              width: 100%;
              height: 48px;
              padding: 12px;
              line-height: 1.2;
              box-sizing: border-box;
              border-radius: 8px;
              border: 1px solid var(--border);
              background: rgba(0, 0, 0, 0.3);
              color: var(--ink);
              font-family: inherit;
              appearance: none;
              -webkit-appearance: none;
            }

            .waInputRow {
              display: flex;
              align-items: center;
              gap: 6px;
              height: 48px;
              padding: 12px;
              box-sizing: border-box;
              line-height: 1.2;
              border-radius: 8px;
              border: 1px solid rgba(255, 255, 255, 0.14);
              background: rgba(255, 255, 255, 0.03);
            }

            .waInputRow:focus-within {
              border-color: rgba(94, 225, 230, 0.6);
            }

            .waCodeInput {
              width: 64px;
              min-width: 64px;
              padding: 0;
              background: transparent;
              border: 0;
              outline: none;
              color: var(--muted);
              font-family: inherit;
              font-size: inherit;
            }

            .waInput {
              flex: 1;
              min-width: 0;
              width: 0; /* prevents global width:100% rules from breaking the row */
              padding: 0;
              padding-left: 6px;
              height: 100%;
              line-height: 1.2;
              background: transparent;
              border: 0;
              outline: none;
              color: var(--ink);
              font-family: inherit;
            }

            .waInput::placeholder {
              color: rgba(255, 255, 255, 0.38);
            }

            .waVerified {
              color: #38bdf8; /* sky-ish */
              font-size: 14px;
              white-space: nowrap;
            }

            .waError {
              margin-top: 6px;
              font-size: 14px;
              color: #f472b6; /* pink-ish */
            }

            .waVerifyBlock {
              margin-top: 12px;
              border-radius: 8px;
              border: 1px solid rgba(255, 255, 255, 0.1);
              background: rgba(0, 0, 0, 0.2);
              padding: 16px;
            }

            .waVerifyText {
              color: rgba(255, 255, 255, 0.8);
              font-size: 14px;
              line-height: 1.5;
              margin: 0;
            }

            .waVerifyButton {
              margin-top: 12px;
            }
          `}</style>

          {/* SMS Verification Code Input - Show after code is sent */}
          {verificationCodeSent && savedProfile?.whatsapp_number && !savedProfile.whatsapp_verified && (
            <div style={{ 
              marginTop: '20px',
              padding: '16px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              border: '1px solid var(--border)'
            }}>
              <p style={{ 
                margin: '0 0 12px 0', 
                fontSize: '14px', 
                color: 'var(--ink)',
                lineHeight: '1.6'
              }}>
                Enter the verification code sent to {savedProfile.whatsapp_number}:
              </p>
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'rgba(0, 0, 0, 0.3)',
                    color: 'var(--ink)',
                    fontSize: '16px',
                    fontFamily: 'monospace',
                    letterSpacing: '2px',
                    textAlign: 'center'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleVerifyCode()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={checkingCode || verificationCode.length < 6}
                  className="ttb-btn ttb-btn-primary"
                >
                  {checkingCode ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="submit" disabled={savingProfile} className="ttb-btn ttb-btn-primary">
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>

        {/* Profile visibility section */}
        <div style={{ 
          marginTop: '32px', 
          paddingTop: '24px', 
          borderTop: '1px solid var(--border)' 
        }}>
          <h3 style={{ 
            marginBottom: '12px', 
            color: 'var(--ink)', 
            fontWeight: '600',
            fontSize: '18px'
          }}>
            Visibility
          </h3>
          
          <div style={{ 
            marginBottom: '20px',
            padding: '12px',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '8px',
            fontSize: '14px',
            color: 'var(--ink)',
            lineHeight: '1.6'
          }}>
            <p style={{ margin: '0 0 8px 0' }}>
              Discoverable profiles appear in Discover.
            </p>
            <p style={{ margin: 0 }}>
              If you match with someone, your info will be shared automatically.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setDiscoverable(false)}
              disabled={!isDiscoverableEnabled || savingVisibility}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: !savedProfile?.is_live ? 'var(--teal)' : 'rgba(0, 0, 0, 0.3)',
                color: !savedProfile?.is_live ? 'white' : 'var(--ink)',
                cursor: isDiscoverableEnabled && !savingVisibility ? 'pointer' : 'not-allowed',
                opacity: isDiscoverableEnabled && !savingVisibility ? 1 : 0.5,
                fontSize: '14px',
                fontWeight: !savedProfile?.is_live ? '600' : '400',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (isDiscoverableEnabled && !savingVisibility) {
                  e.currentTarget.style.opacity = '0.9'
                }
              }}
              onMouseLeave={(e) => {
                if (isDiscoverableEnabled && !savingVisibility) {
                  e.currentTarget.style.opacity = '1'
                }
              }}
            >
              Hidden
            </button>
            <button
              type="button"
              onClick={() => setDiscoverable(true)}
              disabled={!isDiscoverableEnabled || savingVisibility}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: savedProfile?.is_live ? 'var(--pink)' : 'rgba(0, 0, 0, 0.3)',
                color: savedProfile?.is_live ? 'white' : 'var(--ink)',
                cursor: isDiscoverableEnabled && !savingVisibility ? 'pointer' : 'not-allowed',
                opacity: isDiscoverableEnabled && !savingVisibility ? 1 : 0.5,
                fontSize: '14px',
                fontWeight: savedProfile?.is_live ? '600' : '400',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (isDiscoverableEnabled && !savingVisibility) {
                  e.currentTarget.style.opacity = '0.9'
                }
              }}
              onMouseLeave={(e) => {
                if (isDiscoverableEnabled && !savingVisibility) {
                  e.currentTarget.style.opacity = '1'
                }
              }}
            >
              {savingVisibility ? 'Saving...' : 'Discoverable'}
            </button>
            {!isDiscoverableEnabled && (
              <p style={{ 
                margin: 0, 
                fontSize: '12px', 
                color: 'var(--muted)',
                fontStyle: 'italic'
              }}>
                {isDirty ? 'Save your changes to update visibility' : 'Complete your profile to go discoverable'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
