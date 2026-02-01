'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/src/lib/supabaseClient'
import { isProfileComplete, missingFields } from '@/lib/profile/isComplete'

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
  const [message, setMessage] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)

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
      formData.linkedin_url !== (savedProfile.linkedin_url || '') ||
      formData.whatsapp_number !== (savedProfile.whatsapp_number || '')
    
    setIsDirty(isFormDirty)
  }, [formData, savedProfile])

  useEffect(() => {
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
        .select('id, user_id, display_name, domain_expertise, technical_expertise, location_tz, skills_background, interests_building, links, linkedin_url, whatsapp_number, availability, is_complete, is_live')
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
          whatsapp_number: data.whatsapp_number || '',
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

    // Build updated profile object to check completeness
    const updatedProfile = {
      display_name: formData.display_name,
      linkedin_url: formData.linkedin_url,
      technical_expertise: formData.technical_expertise,
      location_tz: formData.location_tz,
      skills_background: formData.skills_background,
      interests_building: formData.interests_building,
      whatsapp_number: formData.whatsapp_number,
    }

    // Safety: never allow live when incomplete
    const complete = isProfileComplete(updatedProfile)
    const currentIsLive = savedProfile?.is_live || false
    const shouldBeLive = complete && currentIsLive

    // Update profile with new fields - only include existing columns
    const updateData = {
      display_name: formData.display_name,
      domain_expertise: formData.domain_expertise || null,
      technical_expertise: formData.technical_expertise || null,
      location_tz: formData.location_tz || null,
      availability: formData.availability || null,
      skills_background: formData.skills_background || null,
      interests_building: formData.interests_building || null,
      links: formData.links || null,
      linkedin_url: formData.linkedin_url || null,
      whatsapp_number: formData.whatsapp_number || null,
      is_live: shouldBeLive, // Force false if incomplete
      updated_at: new Date().toISOString(),
    }

    if (savedProfile) {
      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', savedProfile.id)
        .select()
        .single()

      if (error) {
        setMessage(`Error: ${error.message}`)
      } else {
        setMessage('Profile saved successfully!')
        setSavedProfile(data) // Update saved state with returned data
        setIsDirty(false) // Reset dirty state
      }
    } else {
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          user_id: session.user.id,
          ...updateData,
        })
        .select()
        .single()

      if (error) {
        setMessage(`Error: ${error.message}`)
      } else {
        setMessage('Profile created successfully!')
        setSavedProfile(data) // Update saved state with returned data
        setIsDirty(false) // Reset dirty state
      }
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

  // Compute completeness from saved profile only
  const isCompleteSaved = isProfileComplete(savedProfile)
  const isDiscoverableEnabled = isCompleteSaved && !isDirty && !savingProfile

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

        {/* Status badge */}
        {(() => {
          const missing = missingFields(savedProfile)
          
          return isCompleteSaved ? (
            <div style={{ 
              marginBottom: '24px',
              padding: '8px 16px',
              background: 'rgba(92, 225, 230, 0.1)',
              border: '1px solid rgba(92, 225, 230, 0.3)',
              borderRadius: '8px',
              color: 'var(--teal)',
              fontSize: '14px',
              display: 'inline-block'
            }}>
              ✅ Live-ready: Profile complete
            </div>
          ) : (
            <div style={{ 
              marginBottom: '24px',
              padding: '8px 16px',
              background: 'rgba(255, 193, 7, 0.1)',
              border: '1px solid rgba(255, 193, 7, 0.3)',
              borderRadius: '8px',
              color: '#ffc107',
              fontSize: '14px',
              display: 'inline-block'
            }}>
              ⚠️ Incomplete: Missing {missing.slice(0, 3).join(', ')}{missing.length > 3 ? ` and ${missing.length - 3} more` : ''}
            </div>
          )
        })()}

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

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--ink)', fontWeight: '500' }}>
              WhatsApp Number: *
            </label>
            <input
              type="text"
              value={formData.whatsapp_number}
              onChange={(e) =>
                setFormData({ ...formData, whatsapp_number: e.target.value })
              }
              required
              disabled={savingProfile}
              placeholder="+1234567890"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0, 0, 0, 0.3)', color: 'var(--ink)' }}
            />
            <p style={{ marginTop: '4px', fontSize: '12px', color: 'var(--muted)' }}>Verification coming next</p>
          </div>

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
              <strong>Discoverable profiles appear in Discover.</strong>
            </p>
            <p style={{ margin: '0 0 8px 0' }}>
              If you match with someone, your WhatsApp number is shared automatically so you can contact each other.
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>
              We manually approve everyone, but we can't control what happens off-platform — please share responsibly.
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
                background: !savedProfile?.is_live ? 'var(--pink)' : 'rgba(0, 0, 0, 0.3)',
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
                background: savedProfile?.is_live ? 'var(--teal)' : 'rgba(0, 0, 0, 0.3)',
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
