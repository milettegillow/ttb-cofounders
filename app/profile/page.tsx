'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/src/lib/supabaseClient'
import { isProfileComplete, missingFields } from '@/lib/profile/isComplete'
import { parsePhoneNumberFromString, getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js'
import countries from 'i18n-iso-countries'
import enLocale from 'i18n-iso-countries/langs/en.json'
import { compressImage } from '@/lib/images/compressImage'

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
  photo_path: string | null
  photo_updated_at: string | null
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
  
  // Photo state
  const [photos, setPhotos] = useState<Array<{
    id: string
    user_id: string
    path: string
    public_url: string
    is_primary: boolean
    created_at: string
  }>>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoSaveMessage, setPhotoSaveMessage] = useState<string | null>(null)

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
    setIsDirty(true)
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
        .select('id, user_id, display_name, domain_expertise, technical_expertise, location_tz, skills_background, interests_building, links, linkedin_url, whatsapp_number, whatsapp_verified, whatsapp_verified_at, whatsapp_verify_code, whatsapp_verify_expires_at, availability, is_complete, is_live, photo_path, photo_updated_at')
        .eq('user_id', session.user.id)
        .single()
      
      if (refreshedProfile) {
        setSavedProfile(refreshedProfile)
        // Load photo URL if exists
        if (refreshedProfile.photo_path) {
          loadPhotoUrl(refreshedProfile.photo_path)
        }
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
          .select('id, user_id, display_name, domain_expertise, technical_expertise, location_tz, skills_background, interests_building, links, linkedin_url, whatsapp_number, whatsapp_verified, whatsapp_verified_at, whatsapp_verify_code, whatsapp_verify_expires_at, availability, is_complete, is_live, photo_path, photo_updated_at')
          .eq('user_id', session.user.id)
          .single()
        
        if (refreshedProfile) {
          setSavedProfile(refreshedProfile)
          // Load photo URL if exists
          if (refreshedProfile.photo_path) {
            loadPhotoUrl(refreshedProfile.photo_path)
          }
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

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl)
      }
    }
  }, [photoPreviewUrl])

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
    fetchPhotos(userId)
  }
  
  const fetchPhotos = async (userId: string) => {
    const { data, error } = await supabase
      .from('profile_photos')
      .select('*')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching photos:', error)
      return
    }

    setPhotos(data || [])
  }

  const fetchProfile = async (userId: string) => {
    try {
      // Fetch profile - select only existing columns
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, domain_expertise, technical_expertise, location_tz, skills_background, interests_building, links, linkedin_url, whatsapp_number, whatsapp_verified, whatsapp_verified_at, whatsapp_verify_code, whatsapp_verify_expires_at, availability, is_complete, is_live, photo_path, photo_updated_at')
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
        
        // Load photo URL if photo_path exists
        if (data.photo_path) {
          loadPhotoUrl(data.photo_path)
        } else {
          setPhotoUrl(null)
        }
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

    // Build profile object to check completeness (use form data + saved verification status + photo)
    const profileForCompleteness = {
      display_name: formData.display_name,
      technical_expertise: formData.technical_expertise,
      location_tz: formData.location_tz,
      skills_background: formData.skills_background,
      interests_building: formData.interests_building,
      whatsapp_verified: savedProfile?.whatsapp_verified || false,
      photo_path: savedProfile?.photo_path || null, // Check saved photo_path
    }

    // Safety: never allow live when incomplete
    // If profile becomes incomplete, automatically set is_live to false
    const complete = isProfileComplete(profileForCompleteness)
    const currentIsLive = savedProfile?.is_live || false
    const shouldBeLive = complete && currentIsLive
    
    // If profile was live but is now incomplete, show a message
    if (currentIsLive && !complete) {
      setMessage('Profile is now incomplete. It has been automatically set to Hidden.')
    }

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
      .select('id, user_id, display_name, domain_expertise, technical_expertise, location_tz, skills_background, interests_building, links, linkedin_url, whatsapp_number, whatsapp_verified, whatsapp_verified_at, whatsapp_verify_code, whatsapp_verify_expires_at, availability, is_complete, is_live, photo_path, photo_updated_at')
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
      .select('id, user_id, display_name, domain_expertise, technical_expertise, location_tz, skills_background, interests_building, links, linkedin_url, whatsapp_number, whatsapp_verified, whatsapp_verified_at, whatsapp_verify_code, whatsapp_verify_expires_at, availability, is_complete, is_live, photo_path, photo_updated_at')
      .single()

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage(next ? 'Profile is now discoverable!' : 'Profile is now hidden.')
      setSavedProfile(data) // Update saved state
    }

    setSavingVisibility(false)
  }

  // Photo file selection handler - uploads immediately
  const handlePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !session?.user?.id) {
      console.log('No file selected or no session')
      return
    }

    console.log('Photo selected:', { name: file.name, size: file.size, type: file.type })

    // Validate file type
    if (!file.type.startsWith('image/')) {
      const errorMsg = 'Please select an image file.'
      console.error('Invalid file type:', file.type)
      setMessage(errorMsg)
      return
    }

    setUploadingPhoto(true)
    setMessage(null)
    setPhotoSaveMessage(null)

    try {
      // Compress image
      console.log('Compressing image...')
      const compressed = await compressImage(file, {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.8,
        format: 'webp',
      })
      
      console.log('Compression complete:', {
        originalSize: compressed.originalSize,
        compressedSize: compressed.compressedSize,
        reduction: `${Math.round((1 - compressed.compressedSize / compressed.originalSize) * 100)}%`
      })

      // Determine file extension
      const fileExt = compressed.blob.type === 'image/webp' ? 'webp' : 'jpg'
      const photoPath = `${session.user.id}/avatar.${fileExt}`

      // Upload to Supabase Storage
      console.log('Uploading to storage:', photoPath)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(photoPath, compressed.blob, {
          upsert: true,
          contentType: compressed.blob.type,
        })

      if (uploadError) {
        console.error('Upload failed:', uploadError)
        setMessage(`Upload failed: ${uploadError.message}`)
        setUploadingPhoto(false)
        return
      }

      console.log('Upload successful:', uploadData)

      // Update profile with photo_path
      console.log('Updating profile with photo_path:', photoPath)
      const { data: profileData, error: updateError } = await supabase
        .from('profiles')
        .update({
          photo_path: photoPath,
          photo_updated_at: new Date().toISOString(),
        })
        .eq('user_id', session.user.id)
        .select('id, user_id, display_name, domain_expertise, technical_expertise, location_tz, skills_background, interests_building, links, linkedin_url, whatsapp_number, whatsapp_verified, whatsapp_verified_at, whatsapp_verify_code, whatsapp_verify_expires_at, availability, is_complete, is_live, photo_path, photo_updated_at')
        .single()

      if (updateError) {
        console.error('Profile update failed:', updateError)
        setMessage(`Failed to save photo: ${updateError.message}`)
        // Try to clean up uploaded file
        await supabase.storage.from('profile-photos').remove([photoPath])
        setUploadingPhoto(false)
        return
      }

      console.log('Profile updated successfully:', profileData)

      // Update saved profile state
      setSavedProfile(profileData)
      
      // Load photo URL
      await loadPhotoUrl(photoPath)

      // Show success message
      setPhotoSaveMessage('Saved ✓')
      setTimeout(() => setPhotoSaveMessage(null), 3000)

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Clean up preview URL
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl)
        setPhotoPreviewUrl(null)
      }
    } catch (error: any) {
      console.error('Photo upload failed', error)
      setMessage(`Error: ${error.message || 'Failed to upload photo'}`)
    }

    setUploadingPhoto(false)
  }

  // Load photo URL from storage (handles both public and private buckets)
  const loadPhotoUrl = async (photoPath: string | null) => {
    if (!photoPath) {
      setPhotoUrl(null)
      return
    }

    try {
      // Try public URL first (works if bucket is public)
      const { data: publicUrlData } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(photoPath)

      // Test if public URL works
      const testPublicUrl = async (): Promise<boolean> => {
        return new Promise((resolve) => {
          const testImg = new Image()
          testImg.onload = () => resolve(true)
          testImg.onerror = () => resolve(false)
          testImg.src = publicUrlData.publicUrl
          // Timeout after 3 seconds
          setTimeout(() => resolve(false), 3000)
        })
      }

      const isPublic = await testPublicUrl()

      if (isPublic) {
        console.log('Using public URL for photo')
        setPhotoUrl(publicUrlData.publicUrl)
      } else {
        // If public URL fails, create signed URL (bucket is private)
        console.log('Public URL failed, creating signed URL')
        const { data: signedUrlData, error: signedError } = await supabase.storage
          .from('profile-photos')
          .createSignedUrl(photoPath, 3600) // 60 minutes

        if (signedError) {
          console.error('Failed to create signed URL:', signedError)
          setPhotoUrl(null)
        } else {
          console.log('Using signed URL for photo')
          setPhotoUrl(signedUrlData.signedUrl)
        }
      }
    } catch (error: any) {
      console.error('Error loading photo URL:', error)
      setPhotoUrl(null)
    }
  }

  // Photo upload handler
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !session?.user?.id) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage('Please select an image file.')
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Image must be 5MB or smaller.')
      return
    }

    setUploadingPhoto(true)
    setMessage(null)

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop() || 'jpg'
      const fileName = `${session.user.id}/${crypto.randomUUID()}.${fileExt}`
      const path = fileName

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(path, file, {
          upsert: false,
        })

      if (uploadError) {
        setMessage(`Upload failed: ${uploadError.message}`)
        setUploadingPhoto(false)
        return
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(path)

      const publicUrl = urlData.publicUrl

      // Check if user has any primary photo
      const hasPrimary = photos.some(p => p.is_primary)
      const isPrimary = !hasPrimary

      // If setting as primary, first unset all other primary photos
      if (isPrimary) {
        await supabase
          .from('profile_photos')
          .update({ is_primary: false })
          .eq('user_id', session.user.id)
          .eq('is_primary', true)
      }

      // Insert photo metadata
      const { data: photoData, error: insertError } = await supabase
        .from('profile_photos')
        .insert({
          user_id: session.user.id,
          path,
          public_url: publicUrl,
          is_primary: isPrimary,
        })
        .select()
        .single()

      if (insertError) {
        setMessage(`Failed to save photo metadata: ${insertError.message}`)
        // Try to clean up uploaded file
        await supabase.storage.from('profile-photos').remove([path])
        setUploadingPhoto(false)
        return
      }

      setMessage(isPrimary ? 'Photo uploaded and set as primary!' : 'Photo uploaded!')
      
      // Refresh photos list
      await fetchPhotos(session.user.id)

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message || 'Failed to upload photo'}`)
    }

    setUploadingPhoto(false)
  }

  // Remove photo handler
  const handleRemovePhoto = async (photoId: string, path: string, isPrimary: boolean) => {
    if (!session?.user?.id) return

    if (!confirm('Are you sure you want to remove this photo?')) {
      return
    }

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('profile-photos')
        .remove([path])

      if (storageError) {
        setMessage(`Failed to delete photo from storage: ${storageError.message}`)
        return
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('profile_photos')
        .delete()
        .eq('id', photoId)
        .eq('user_id', session.user.id)

      if (deleteError) {
        setMessage(`Failed to delete photo metadata: ${deleteError.message}`)
        return
      }

      // If removed photo was primary and there are remaining photos, set newest as primary
      if (isPrimary) {
        const remainingPhotos = photos.filter(p => p.id !== photoId)
        if (remainingPhotos.length > 0) {
          // Find newest photo
          const newest = remainingPhotos.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]

          await supabase
            .from('profile_photos')
            .update({ is_primary: true })
            .eq('id', newest.id)
            .eq('user_id', session.user.id)
        }
      }

      setMessage('Photo removed!')
      
      // Refresh photos list
      await fetchPhotos(session.user.id)
    } catch (error: any) {
      setMessage(`Error: ${error.message || 'Failed to remove photo'}`)
    }
  }

  // Make primary handler
  const handleMakePrimary = async (photoId: string) => {
    if (!session?.user?.id) return

    try {
      // First, unset all primary photos
      await supabase
        .from('profile_photos')
        .update({ is_primary: false })
        .eq('user_id', session.user.id)
        .eq('is_primary', true)

      // Then set selected photo as primary
      const { error } = await supabase
        .from('profile_photos')
        .update({ is_primary: true })
        .eq('id', photoId)
        .eq('user_id', session.user.id)

      if (error) {
        setMessage(`Failed to set primary photo: ${error.message}`)
        return
      }

      setMessage('Primary photo updated!')
      
      // Refresh photos list
      await fetchPhotos(session.user.id)
    } catch (error: any) {
      setMessage(`Error: ${error.message || 'Failed to update primary photo'}`)
    }
  }

  // Remove profile photo handler (removes photo_path from profiles table)
  const handleRemoveProfilePhoto = async () => {
    if (!session?.user?.id || !savedProfile?.photo_path) {
      return
    }

    if (!confirm('Are you sure you want to remove your photo? This will make your profile incomplete and it will be automatically set to Hidden if it\'s currently Discoverable.')) {
      return
    }

    try {
      console.log('Removing photo:', savedProfile.photo_path)

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('profile-photos')
        .remove([savedProfile.photo_path])

      if (storageError) {
        console.error('Failed to delete photo from storage:', storageError)
        setMessage(`Failed to delete photo: ${storageError.message}`)
        return
      }

      console.log('Photo deleted from storage')

      // Clear photo_path in database
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          photo_path: null,
          photo_updated_at: null,
          // If profile was discoverable and is now incomplete, set to hidden
          is_live: false, // Always set to false when removing photo (photo is required)
        })
        .eq('user_id', session.user.id)
        .select('id, user_id, display_name, domain_expertise, technical_expertise, location_tz, skills_background, interests_building, links, linkedin_url, whatsapp_number, whatsapp_verified, whatsapp_verified_at, whatsapp_verify_code, whatsapp_verify_expires_at, availability, is_complete, is_live, photo_path, photo_updated_at')
        .single()

      if (updateError) {
        console.error('Failed to update profile:', updateError)
        setMessage(`Failed to remove photo: ${updateError.message}`)
        return
      }

      console.log('Profile updated, photo removed')

      // Update saved profile state
      setSavedProfile(updatedProfile)
      
      // Clear photo URL
      setPhotoUrl(null)
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl)
        setPhotoPreviewUrl(null)
      }

      // Check if profile was discoverable and show message
      if (savedProfile.is_live) {
        setMessage('Photo removed. Your profile has been automatically set to Hidden because it is now incomplete.')
      } else {
        setMessage('Photo removed successfully.')
      }
    } catch (error: any) {
      console.error('Error removing photo:', error)
      setMessage(`Error: ${error.message || 'Failed to remove photo'}`)
    }
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
    photo_path: savedProfile?.photo_path || null, // Include photo in completeness check
  }

  // Compute missing fields for draft and saved
  const draftMissing = missingFields(formDataAsProfileShape)
  const savedMissing = missingFields(savedProfile)

  return (
    <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
      <div className="ttb-panel">
        {/* Photos section - at the top */}
        <div style={{ 
          marginTop: '24px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          {/* Photo circle placeholder/display */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: photos.find(p => p.is_primary) 
                ? 'transparent' 
                : 'rgba(255, 255, 255, 0.1)',
              border: photos.find(p => p.is_primary)
                ? 'none'
                : '2px dashed rgba(255, 255, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              position: 'relative',
              marginBottom: '24px',
            }}
          >
            {photoPreviewUrl ? (
              <img
                src={photoPreviewUrl}
                alt="Photo preview"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : photoUrl ? (
              <img
                src={photoUrl}
                alt="Profile photo"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : photos.find(p => p.is_primary) ? (
              <img
                src={photos.find(p => p.is_primary)!.public_url}
                alt="Profile photo"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255, 255, 255, 0.4)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelected}
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="ttb-btn ttb-btn-secondary"
                style={{
                  fontSize: '14px',
                  padding: '8px 16px',
                }}
              >
                {uploadingPhoto ? 'Uploading...' : 'Upload photo'}
              </button>
              {savedProfile?.photo_path && (
                <button
                  type="button"
                  onClick={handleRemoveProfilePhoto}
                  disabled={uploadingPhoto}
                  className="ttb-btn"
                  style={{
                    fontSize: '14px',
                    padding: '8px 16px',
                    background: 'rgba(244, 114, 182, 0.2)',
                    color: '#f472b6',
                    border: '1px solid #f472b6',
                  }}
                >
                  Remove photo
                </button>
              )}
            </div>
            {photoSaveMessage && (
              <span style={{ 
                fontSize: '12px', 
                color: 'var(--teal)',
                fontWeight: '500'
              }}>
                {photoSaveMessage}
              </span>
            )}
          </div>

          {/* Photo thumbnails grid - show all photos except primary (which is in circle) */}
          {photos.length > 1 && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
              gap: '12px',
              marginTop: '20px',
              width: '100%',
              maxWidth: '600px'
            }}>
              {photos.filter(p => !p.is_primary).map((photo) => (
                <div
                  key={photo.id}
                  style={{
                    position: 'relative',
                    padding: '8px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <img
                    src={photo.public_url}
                    alt={`Photo ${photo.id}`}
                    style={{
                      width: '100%',
                      height: '100px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                    }}
                  />
                  <div style={{ 
                    marginTop: '8px', 
                    display: 'flex', 
                    gap: '8px',
                    flexDirection: 'column'
                  }}>
                    <button
                      type="button"
                      onClick={() => handleMakePrimary(photo.id)}
                      className="ttb-btn"
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                      }}
                    >
                      Make primary
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id, photo.path, photo.is_primary)}
                      className="ttb-btn"
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        background: 'rgba(244, 114, 182, 0.2)',
                        color: '#f472b6',
                        border: '1px solid #f472b6',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <h1 style={{ marginTop: '0', marginBottom: '16px' }}>Profile</h1>

        {/* Real-time missing fields banner */}
        <div style={{ marginBottom: '24px' }}>
          {isDirty && draftMissing.length === 0 && (
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
          )}
          {draftMissing.length > 0 && (
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
              onChange={(e) => {
                setFormData({ ...formData, display_name: e.target.value })
                setIsDirty(true)
              }}
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
              onChange={(e) => {
                setFormData({ ...formData, linkedin_url: e.target.value })
                setIsDirty(true)
              }}
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
              onChange={(e) => {
                setFormData({ ...formData, domain_expertise: e.target.value })
                setIsDirty(true)
              }}
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
              onChange={(e) => {
                setFormData({ ...formData, technical_expertise: e.target.value })
                setIsDirty(true)
              }}
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
              onChange={(e) => {
                setFormData({ ...formData, location_tz: e.target.value })
                setIsDirty(true)
              }}
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
              onChange={(e) => {
                setFormData({ ...formData, availability: e.target.value })
                setIsDirty(true)
              }}
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
              onChange={(e) => {
                setFormData({ ...formData, skills_background: e.target.value })
                setIsDirty(true)
              }}
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
              onChange={(e) => {
                setFormData({ ...formData, interests_building: e.target.value })
                setIsDirty(true)
              }}
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
              onChange={(e) => {
                setFormData({ ...formData, links: e.target.value })
                setIsDirty(true)
              }}
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
                      setIsDirty(true)
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
              color: var(--teal);
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

        {/* Header row: Signed in as + Sign out - at the bottom */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginTop: '48px',
          paddingTop: '24px',
          borderTop: '1px solid var(--border)'
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
      </div>
    </div>
  )
}
