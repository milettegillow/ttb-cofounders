'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/src/lib/supabaseClient'

type Application = {
  id: string
  user_id: string
  status: 'pending' | 'approved' | 'rejected'
}

type Profile = {
  [key: string]: any // Allow any fields from select('*')
}

export default function Discover() {
  const [session, setSession] = useState<any>(null)
  const [application, setApplication] = useState<Application | null>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [inFlight, setInFlight] = useState(false)
  const [swipeAnim, setSwipeAnim] = useState<'left' | 'right' | null>(null)
  const [showMatchToast, setShowMatchToast] = useState(false)
  const [photoUrls, setPhotoUrls] = useState<{ [userId: string]: string }>({})
  const [fetchError, setFetchError] = useState<string | null>(null)

  const currentProfile = profiles[currentIndex]

  // Helper functions
  const getName = (profile: Profile): string => {
    return profile.display_name || (profile as any).name || (profile as any).full_name || 'Unknown'
  }

  const getLocation = (profile: Profile): string | null => {
    return profile.location_tz || (profile as any).location || (profile as any).city || (profile as any).region || null
  }

  const getLinkedInUrl = (profile: any): string | null => {
    // Only check linkedin_url column, do NOT query linkedin column
    if (!profile) return null
    
    const linkedinUrl = profile.linkedin_url
    if (linkedinUrl && typeof linkedinUrl === 'string') {
      const trimmed = linkedinUrl.trim()
      if (trimmed) {
        return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
      }
    }
    return null
  }

  const parseTags = (value: string | string[] | null | undefined): string[] => {
    if (!value) return []
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item).trim())
        .filter(Boolean)
    }
    
    // Handle strings
    if (typeof value === 'string') {
      // Split on commas, newlines, and semicolons
      const tags = value.split(/,|\n|;/g)
        .map((s) => s.trim())
        .filter(Boolean)
      return tags
    }
    
    return []
  }


  const getExpertiseTags = (profile: any): string[] => {
    const candidates = [
      profile?.domain_expertise,
      profile?.technical_expertise,
      profile?.expertise,
      profile?.skills,
      profile?.domain,
    ].filter(Boolean)

    let raw: any = candidates.length ? candidates[0] : null
    if (!raw) return []

    let tags: string[] = []
    if (Array.isArray(raw)) tags = raw.map((x) => String(x).trim())
    else tags = String(raw).split(/,|\n|;|\|/g).map((s) => s.trim())

    return tags.filter(Boolean).slice(0, 12)
  }

  const formatFieldLabel = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, c => c.toUpperCase())
  }

  const normalizeValue = (val: any): string | null => {
    if (val === null || val === undefined) return null
    if (typeof val === 'string') {
      const t = val.trim()
      return t.length ? t : null
    }
    if (typeof val === 'boolean') return val ? 'Yes' : 'No'
    if (Array.isArray(val)) return val.length ? val.join(', ') : null
    if (typeof val === 'object') return JSON.stringify(val, null, 2)
    return String(val)
  }

  const loadPhotoUrl = async (photoPath: string, userId: string) => {
    try {
      const { data: publicUrlData } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(photoPath)

      const testPublicUrl = async (): Promise<boolean> => {
        return new Promise((resolve) => {
          const testImg = new Image()
          testImg.onload = () => resolve(true)
          testImg.onerror = () => resolve(false)
          testImg.src = publicUrlData.publicUrl
          setTimeout(() => resolve(false), 3000)
        })
      }

      const isPublic = await testPublicUrl()

      if (isPublic) {
        setPhotoUrls(prev => ({ ...prev, [userId]: publicUrlData.publicUrl }))
      } else {
        const { data: signedUrlData, error: signedError } = await supabase.storage
          .from('profile-photos')
          .createSignedUrl(photoPath, 3600)

        if (!signedError && signedUrlData) {
          setPhotoUrls(prev => ({ ...prev, [userId]: signedUrlData.signedUrl }))
        }
      }
    } catch (error) {
      console.error('Error loading photo URL:', error)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session)
        checkAccess(data.session.user.id)
      } else {
        setLoading(false)
      }
    })
  }, [])

  const doSwipe = useCallback(async (direction: 'like' | 'pass') => {
    if (!session?.access_token || !currentProfile || inFlight) return

    setInFlight(true)
    setSwipeAnim(direction === 'pass' ? 'left' : 'right')

    try {
      const response = await fetch('/api/swipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ toUserId: currentProfile.user_id, direction }),
      })

      if (!response.ok) {
        console.error('Swipe failed')
        setSwipeAnim(null)
        setInFlight(false)
        return
      }

      const data = await response.json()

      if (data.matched) {
        setShowMatchToast(true)
      }

      setTimeout(() => {
        setCurrentIndex((i) => i + 1)
        setSwipeAnim(null)
        setInFlight(false)
      }, 300)
    } catch (error) {
      console.error('Error swiping:', error)
      setSwipeAnim(null)
      setInFlight(false)
    }
  }, [session?.access_token, currentProfile, inFlight])

  useEffect(() => {
    if (inFlight || !currentProfile) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        doSwipe('pass')
      } else if (e.key === 'ArrowRight') {
        doSwipe('like')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [inFlight, currentProfile, doSwipe])

  useEffect(() => {
    if (showMatchToast) {
      const timer = setTimeout(() => {
        setShowMatchToast(false)
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [showMatchToast])

  const checkAccess = async (userId: string) => {
    // Check if user has a profile (approved users have profiles)
    const { data: fullProfileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (profileError && profileError.code !== 'PGRST116') {
      setLoading(false)
      return
    }

    if (!fullProfileData) {
      // No profile means not approved
      setApplication(null)
      setUserProfile(null)
      setLoading(false)
      return
    }

    // User has a profile, so they're approved
    setApplication({
      id: '',
      user_id: userId,
      status: 'approved' as const,
    })

    // Always set userProfile so we can check is_complete and is_live in the UI
    setUserProfile(fullProfileData)

    // Only fetch other profiles if profile is complete and live
    if (fullProfileData.is_complete && fullProfileData.is_live) {
      fetchProfiles(userId)
    } else {
      setLoading(false)
    }
  }

  const fetchProfiles = async (currentUserId: string) => {
    setFetchError(null)
    
    // Query swipes to get all users already swiped on
    const { data: swipesData, error: swipesError } = await supabase
      .from('swipes')
      .select('to_user_id')
      .eq('from_user_id', currentUserId)

    if (swipesError) {
      console.error('Error fetching swipes:', swipesError)
    }

    // Build exclusion set
    const exclusionSet = new Set<string>([currentUserId])

    // Add all swiped user IDs
    if (swipesData) {
      swipesData.forEach((swipe) => {
        exclusionSet.add(swipe.to_user_id)
      })
    }

    // Build exclusion array
    const excludedIds = Array.from(exclusionSet)

    // Build profiles query
    let query = supabase
      .from('profiles')
      .select('*')
      .eq('is_live', true)
      .neq('user_id', currentUserId)
      .not('photo_path', 'is', null)

    // Apply exclusion filter if there are excluded users
    if (excludedIds.length > 0) {
      query = query.not('user_id', 'in', `(${excludedIds.map(id => `"${id}"`).join(',')})`)
    }

    const { data, error } = await query
      .order('updated_at', { ascending: false })
      .limit(25)

    if (error) {
      console.error('Error fetching profiles:', error)
      console.error('Error message:', error.message)
      console.error('Error code:', error.code)
      setFetchError('Couldn\'t load discover right now')
      setLoading(false)
      return
    }

    // Filter out profiles with empty photo_path
    const filteredProfiles = (data || []).filter((p: any) => p.photo_path && p.photo_path.trim() !== '')

    setProfiles(filteredProfiles)

    // Load photo URLs
    filteredProfiles.forEach((profile: any) => {
      if (profile.photo_path) {
        loadPhotoUrl(profile.photo_path, profile.user_id)
      }
    })

    setLoading(false)
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

  // Check if user has a profile (approved users have profiles)
  // Approved iff profiles row exists for profiles.user_id === auth user id
  if (!userProfile) {
    // No profile means not approved
    return (
      <div>
        <p>Your application hasn't been approved yet.</p>
        <Link href="/apply">Go to application</Link>
      </div>
    )
  }

  // Profile exists - check completion and live status
  if (!userProfile.is_complete) {
    return (
      <div>
        <p>Finish your profile to start discovering</p>
        <Link href="/profile">Go to profile</Link>
      </div>
    )
  }

  if (!userProfile.is_live) {
    return (
      <div>
        <p>Turn your profile live to start discovering</p>
        <Link href="/profile">Go to profile</Link>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div style={{ padding: '20px', paddingTop: '20px' }}>
        <div style={{
          padding: '16px',
          background: 'rgba(239, 31, 159, 0.1)',
          border: '1px solid var(--pink)',
          borderRadius: '8px',
          color: 'var(--pink)',
        }}>
          {fetchError}
        </div>
      </div>
    )
  }

  if (profiles.length === 0 || !currentProfile) {
    return (
      <div style={{ padding: '20px', paddingTop: '20px' }}>
        <h2>No more profiles. Check back later!</h2>
      </div>
    )
  }

  const cardStyle: React.CSSProperties = {
    transition: 'transform 0.3s ease, opacity 0.3s ease',
    transform: swipeAnim === 'left' ? 'translateX(-100px)' : swipeAnim === 'right' ? 'translateX(100px)' : 'translateX(0)',
    opacity: swipeAnim ? 0.5 : 1,
  }

  const currentPhotoUrl = photoUrls[currentProfile.user_id] || null
  const linkedInUrl = getLinkedInUrl(currentProfile)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', padding: '12px', paddingTop: '20px' }}>
      {showMatchToast && (
        <div style={{ 
          position: 'fixed', 
          top: '20px', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          background: 'var(--pink)', 
          color: 'white', 
          padding: '15px 20px', 
          borderRadius: '8px',
          zIndex: 1000,
        }}>
          It's a match! <Link href="/matches" style={{ color: 'white', textDecoration: 'underline' }}>Go to Matches →</Link>
        </div>
      )}

      <div 
        className="ttb-card" 
        style={{ 
          width: '100%', 
          maxWidth: '1200px', 
          margin: '0 0 12px 0',
          padding: '24px',
          ...cardStyle,
        }}
      >
        {/* Header: Photo + Name + Location row */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '24px',
          marginBottom: '24px',
          paddingRight: '8px',
        }}>
          {/* Photo */}
          <div style={{
            width: '96px',
            height: '96px',
            borderRadius: '50%',
            overflow: 'hidden',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {currentPhotoUrl ? (
              <img
                src={currentPhotoUrl}
                alt={getName(currentProfile)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ opacity: 0.5 }}
                >
                  <path
                    d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
                    stroke="rgba(255, 255, 255, 0.6)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22"
                    stroke="rgba(255, 255, 255, 0.6)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>
          
          {/* Right side: Name + Location row */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name */}
            <h2 style={{ fontSize: '32px', margin: '0 0 6px 0', fontWeight: '600' }}>{getName(currentProfile)}</h2>
            
            {/* Location + LinkedIn on left, Domain + Tech on right */}
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '6px' }}>
              {/* Left cluster: Location + LinkedIn icon (stacked) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {getLocation(currentProfile) && (
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>📍 {getLocation(currentProfile)}</p>
                )}
                <a
                  href={linkedInUrl || 'https://www.linkedin.com/feed/'}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = 'none'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = 'none'
                  }}
                  style={{
                    color: 'var(--teal)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    width: '24px',
                    height: '24px',
                    outline: 'none',
                    border: 'none',
                    background: 'transparent',
                    boxShadow: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    padding: 0,
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.12)'
                    e.currentTarget.style.boxShadow = '0 0 12px rgba(92, 225, 230, 0.4)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                  aria-label="LinkedIn profile"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
              </div>
              
              {/* Right cluster: Domain + Tech blocks */}
              <div style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '48px',
              }}>
                {/* Domain block */}
                {(() => {
                  const domainValue = currentProfile.domain_expertise || currentProfile.domain_expertise_tags || null
                  const domainTags = parseTags(domainValue)
                  if (domainTags.length === 0) return null
                  return (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '8px',
                      minWidth: '140px',
                    }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--pink)', fontWeight: '600', lineHeight: '1.2' }}>
                        DOMAIN
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end' }}>
                        {domainTags.map((tag, idx) => (
                          <span
                            key={`domain-${idx}`}
                            style={{
                              display: 'inline-flex',
                              padding: '4px 10px',
                              borderRadius: 999,
                              fontSize: '12px',
                              border: '1px solid var(--pink)',
                              background: 'rgba(239, 31, 159, 0.15)',
                              color: 'rgba(255, 255, 255, 0.9)',
                              boxShadow: '0 0 8px rgba(239, 31, 159, 0.3)',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })()}
                
                {/* Tech block */}
                {(() => {
                  const techValue = currentProfile.technical_expertise || currentProfile.technical_expertise_tags || null
                  const technicalTags = parseTags(techValue)
                  if (technicalTags.length === 0) return null
                  return (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '8px',
                      minWidth: '140px',
                    }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--teal)', fontWeight: '600', lineHeight: '1.2' }}>
                        TECH
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end' }}>
                        {technicalTags.map((tag, idx) => (
                          <span
                            key={`technical-${idx}`}
                            style={{
                              display: 'inline-flex',
                              padding: '4px 10px',
                              borderRadius: 999,
                              fontSize: '12px',
                              border: '1px solid var(--teal)',
                              background: 'rgba(92, 225, 230, 0.15)',
                              color: 'rgba(255, 255, 255, 0.9)',
                              boxShadow: '0 0 8px rgba(92, 225, 230, 0.3)',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Profile Fields - Two Column Grid */}
        {(() => {
          // Only show these specific fields with exact labels
          const fieldsToShow = [
            { key: 'availability', label: 'My Availability:' },
            { key: 'skills_background', label: 'Skills & background:' },
            { key: 'interests_building', label: 'Interested in Exploring Building:' },
            { key: 'links', label: 'GitHub / Other Links:' },
          ]

          const fieldsToRender = fieldsToShow
            .map(({ key, label }) => {
              const value = normalizeValue(currentProfile[key])
              return value ? { key, label, value } : null
            })
            .filter((item): item is { key: string, label: string, value: string } => item !== null)

          if (fieldsToRender.length === 0) return null

          return (
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div className="discover-fields-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '20px',
              }}>
                {fieldsToRender.map(({ key, label, value }) => {
                  const isLinks = key === 'links'
                  // Check if value contains URLs (http:// or https://)
                  const urlMatch = isLinks ? value.match(/https?:\/\/[^\s]+/i) : null
                  const firstUrl = urlMatch ? urlMatch[0] : null
                  
                  return (
                    <div key={key}>
                      <h3 style={{
                        margin: '0 0 8px 0',
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: 'var(--muted)',
                        fontWeight: '500',
                      }}>
                        {label}
                      </h3>
                      {isLinks && firstUrl ? (
                        <a
                          href={firstUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          style={{
                            color: 'var(--teal)',
                            textDecoration: 'underline',
                            fontSize: '14px',
                            lineHeight: '1.6',
                            wordWrap: 'break-word',
                            display: 'block',
                          }}
                        >
                          {value}
                        </a>
                      ) : (
                        <p style={{
                          margin: 0,
                          color: 'var(--ink)',
                          fontSize: '14px',
                          lineHeight: '1.6',
                          whiteSpace: 'pre-wrap',
                          wordWrap: 'break-word',
                        }}>
                          {value}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      <div style={{ display: 'flex', gap: '20px', marginTop: '16px' }}>
        <button
          onClick={() => doSwipe('pass')}
          disabled={inFlight}
          className="ttb-btn ttb-btn-secondary"
          style={{ fontSize: '18px', padding: '15px 40px' }}
        >
          {inFlight ? 'Processing...' : 'Pass'}
        </button>
        <button
          onClick={() => doSwipe('like')}
          disabled={inFlight}
          className="ttb-btn ttb-btn-primary"
          style={{ fontSize: '18px', padding: '15px 40px' }}
        >
          {inFlight ? 'Processing...' : 'Match'}
        </button>
      </div>

      <p style={{ marginTop: '20px', color: 'var(--muted)', fontSize: '14px' }}>
        Use ← → arrow keys to swipe
      </p>
    </div>
  )
}
