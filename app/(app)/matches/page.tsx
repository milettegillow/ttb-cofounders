'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/src/lib/supabaseClient'

type MatchRow = {
  id: string
  user_a: string
  user_b: string
  created_at: string
}

type Profile = {
  id?: string
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
  whatsapp_e164: string | null
  availability: string | null
  photo_path: string | null
  photo_url?: string | null
  [key: string]: any // Allow any other fields from select('*')
}

type MatchWithProfile = {
  match_id: string
  created_at: string
  other_user_id: string
  profile: Profile
}

type ModalProps = {
  isOpen: boolean
  onClose: () => void
  profile: Profile | null
  whatsapp: string | null
  photoUrls: { [userId: string]: string }
  getExpertiseTags: (profile: any) => string[]
  getLinkedInUrl: (profile: any) => string | null
  getName: (profile: Profile) => string
  getLocation: (profile: Profile) => string | null
  formatFieldLabel: (key: string) => string
  normalizeValue: (val: any) => string | null
}

function Modal({ isOpen, onClose, profile, whatsapp, photoUrls, getExpertiseTags, getLinkedInUrl, getName, getLocation, formatFieldLabel, normalizeValue }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen || !profile) return null

  const digitsOnly = whatsapp?.replace(/\D/g, '') || ''

  // Helper to render a field if it has a value
  const renderField = (label: string, value: string | null | undefined) => {
    if (!value || value.trim() === '') return null
    return (
      <div style={{ marginBottom: '24px' }}>
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
        <p style={{ margin: 0, color: 'var(--ink)', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
          {value}
        </p>
      </div>
    )
  }

  // Helper to parse tags (split by comma if string, or use array directly)
  const parseTags = (value: string | null | undefined): string[] => {
    if (!value) return []
    if (Array.isArray(value)) return value
    return value.split(',').map(t => t.trim()).filter(t => t.length > 0)
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div
        ref={modalRef}
        style={{
          background: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Scrollable body */}
        <div style={{
          padding: '32px',
          overflowY: 'auto',
          maxHeight: '80vh',
        }}>
        {/* Photo and header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: (photoUrls[profile.user_id] || profile.photo_url || profile.photo_path) ? 'transparent' : 'rgba(255, 255, 255, 0.1)',
            border: (photoUrls[profile.user_id] || profile.photo_url || profile.photo_path) ? 'none' : '1px solid rgba(255, 255, 255, 0.15)',
            flexShrink: 0,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {(() => {
              // Use photoUrl from state if available, otherwise try photo_url or photo_path
              const photoUrlToUse = photoUrls[profile.user_id] || profile.photo_url || profile.photo_path || null
              return photoUrlToUse ? (
                <img
                  src={photoUrlToUse}
                  alt={getName(profile)}
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
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '50%',
                }} />
              )
            })()}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>
              {getName(profile)}
            </h2>
            {getLocation(profile) && (
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>
                {getLocation(profile)}
              </p>
            )}
          </div>
        </div>

          {/* Tags */}
          {(() => {
            const tags = getExpertiseTags(profile)
            if (tags.length === 0) return null
            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                {tags.map((tag, idx) => (
                  <span
                    key={`tag-${idx}`}
                    style={{
                      display: 'inline-flex',
                      padding: '6px 10px',
                      borderRadius: 999,
                      fontSize: '12px',
                      border: '1px solid rgba(92,225,230,0.35)',
                      background: 'rgba(0,0,0,0.25)',
                      color: 'rgba(255,255,255,0.85)',
                      boxShadow: '0 0 12px rgba(92,225,230,0.12)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )
          })()}

          {/* LinkedIn */}
          {(() => {
            const li = getLinkedInUrl(profile)
            if (!li) return null
            return (
              <div style={{ marginBottom: '0px' }}>
                <a
                  href={li}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--teal)',
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0px',
                    borderRadius: '0px',
                    background: 'transparent',
                    width: '24px',
                    height: '24px',
                    outline: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.15)'
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
            )
          })()}

          {/* WhatsApp */}
          {whatsapp && (
            <div style={{ marginBottom: '24px' }}>
              <p style={{ margin: '0 0 12px 0', color: 'var(--muted)', fontSize: '14px' }}>
                <strong style={{ color: 'var(--ink)' }}>WhatsApp:</strong> {whatsapp}
              </p>
              {digitsOnly && (
                <a
                  href={`https://wa.me/${digitsOnly}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ttb-btn ttb-btn-secondary"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px 16px',
                  }}
                >
                  Message on WhatsApp
                </a>
              )}
            </div>
          )}

          {/* Full Profile Section */}
          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{
              margin: '0 0 20px 0',
              fontSize: '16px',
              fontWeight: '600',
              color: 'var(--ink)',
            }}>
              Full Profile
            </h3>
            {(() => {
              const HIDDEN_KEYS = new Set([
                // Internal/system IDs
                'id',
                'user_id',
                'auth_user_id',
                'match_id',
                'other_user_id',
                'user_a',
                'user_b',
                // Timestamps
                'created_at',
                'updated_at',
                // Photo fields (already displayed in header)
                'photo_path', 'photo_url', 'photo_urls', 'primary_photo_path',
                // LinkedIn (already displayed in header)
                'linkedin', 'linkedin_url', 'linkedinUrl',
                // WhatsApp (already displayed in header)
                'whatsapp', 'whatsapp_e164', 'whatsapp_number',
                // Name/location (already displayed in header)
                'display_name', 'name', 'full_name',
                'location', 'city', 'region', 'location_tz',
                // Expertise tags (already displayed in header)
                'domain_expertise', 'technical_expertise', 'expertise', 'skills', 'domain',
              ])

              const fieldsToRender = Object.entries(profile)
                .filter(([k, v]) => !HIDDEN_KEYS.has(k))
                .map(([k, v]) => {
                  const value = normalizeValue(v)
                  return value ? { key: k, value } : null
                })
                .filter((item): item is { key: string, value: string } => item !== null)

              if (fieldsToRender.length === 0) {
                return (
                  <p style={{ color: 'var(--muted)', fontSize: '14px', fontStyle: 'italic' }}>
                    No additional profile information available.
                  </p>
                )
              }

              return fieldsToRender.map(({ key, value }) => {
                const isObject = value.startsWith('{') || value.startsWith('[')
                
                return (
                  <div key={key} style={{ marginBottom: '24px' }}>
                    <h4 style={{
                      margin: '0 0 8px 0',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--muted)',
                      fontWeight: '500',
                    }}>
                      {formatFieldLabel(key)}
                    </h4>
                    {isObject ? (
                      <pre style={{ 
                        margin: 0, 
                        color: 'var(--ink)', 
                        fontSize: '12px', 
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace',
                        background: 'rgba(255,255,255,0.05)',
                        padding: '12px',
                        borderRadius: '4px',
                        overflow: 'auto',
                      }}>
                        {value}
                      </pre>
                    ) : (
                      <p style={{ 
                        margin: 0, 
                        color: 'var(--ink)', 
                        fontSize: '14px', 
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {value}
                      </p>
                    )}
                  </div>
                )
              })
            })()}
            
            {/* Debug keys line */}
            <div style={{ opacity: 0.5, fontSize: '12px', marginTop: '24px', color: 'var(--muted)' }}>
              Fields: {Object.keys(profile).length}
            </div>
          </div>
        </div>

        {/* Close button - outside scrollable area */}
        <div style={{
          padding: '0 32px 32px 32px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          paddingTop: '16px',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: 'var(--ink)',
              cursor: 'pointer',
              fontSize: '14px',
              width: '100%',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

type ConfirmDialogProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  body: string
  confirmLabel: string
  confirmDanger?: boolean
}

function ConfirmDialog({ isOpen, onClose, onConfirm, title, body, confirmLabel, confirmDanger = false }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 10001,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div
        ref={dialogRef}
        style={{
          background: 'rgba(0, 0, 0, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '16px',
          maxWidth: '400px',
          width: '100%',
          padding: '32px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        <h2 style={{
          margin: '0 0 16px 0',
          fontSize: '20px',
          fontWeight: '600',
          color: 'var(--ink)',
        }}>
          {title}
        </h2>
        <p style={{
          margin: '0 0 24px 0',
          color: 'var(--muted)',
          fontSize: '14px',
          lineHeight: '1.5',
        }}>
          {body}
        </p>
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: 'var(--ink)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            style={{
              padding: '10px 20px',
              background: confirmDanger ? 'var(--pink)' : 'var(--teal)',
              border: 'none',
              borderRadius: '8px',
              color: confirmDanger ? 'white' : '#050006',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

type DropdownProps = {
  isOpen: boolean
  onClose: () => void
  onUnmatch: () => void
  onReport: () => void
  matchId: string
}

function Dropdown({ isOpen, onClose, onUnmatch, onReport, matchId }: DropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: '32px',
        right: '0',
        background: 'rgba(0, 0, 0, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        padding: '8px 0',
        minWidth: '120px',
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
      }}
    >
      <button
        onClick={() => {
          onUnmatch()
          onClose()
        }}
        style={{
          width: '100%',
          padding: '8px 16px',
          background: 'transparent',
          border: 'none',
          color: 'var(--ink)',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: '14px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        Unmatch
      </button>
      <button
        onClick={() => {
          onReport()
          onClose()
        }}
        style={{
          width: '100%',
          padding: '8px 16px',
          background: 'transparent',
          border: 'none',
          color: 'var(--ink)',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: '14px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        Report
      </button>
    </div>
  )
}

export default function Matches() {
  const [session, setSession] = useState<any>(null)
  const [matches, setMatches] = useState<MatchWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [contactsByUserId, setContactsByUserId] = useState<{ [userId: string]: { whatsapp: string } }>({})
  const [contactsFetchStatus, setContactsFetchStatus] = useState<number | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<{ [userId: string]: string }>({})
  const [toast, setToast] = useState<string | null>(null)
  const [confirmUnmatch, setConfirmUnmatch] = useState<{ matchId: string, otherUserId: string, name?: string } | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const latestReq = useRef(0)

  // Helper functions for profile data
  const getName = (profile: Profile): string => {
    return profile.display_name || (profile as any).name || (profile as any).full_name || 'Unknown'
  }

  const getLocation = (profile: Profile): string | null => {
    return profile.location_tz || (profile as any).location || (profile as any).city || (profile as any).region || null
  }

  const getLinkedInUrl = (profile: any): string | null => {
    const direct =
      profile?.linkedin_url || profile?.linkedin || profile?.linkedinUrl || null
    const links = profile?.links || profile?.link || profile?.urls || null

    const normalize = (u: string) => {
      const url = u.trim()
      if (!url) return null
      const withProto = url.startsWith('http') ? url : `https://${url}`
      return withProto
    }

    if (typeof direct === 'string' && direct.trim()) return normalize(direct)

    // Try to extract a linkedin.com URL from "links" text
    if (typeof links === 'string' && links.trim()) {
      const m = links.match(/https?:\/\/(www\.)?linkedin\.com\/[^\s)]+/i)
        || links.match(/(www\.)?linkedin\.com\/[^\s)]+/i)
      if (m && m[0]) return normalize(m[0])
    }

    return null
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session)
        fetchMatches(data.session.user.id)
      } else {
        setLoading(false)
      }
    })
  }, [])

  const loadPhotoUrl = async (photoPath: string, userId: string) => {
    try {
      // Try public URL first
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
        setPhotoUrls(prev => ({ ...prev, [userId]: publicUrlData.publicUrl }))
      } else {
        // If public URL fails, create signed URL (bucket is private)
        const { data: signedUrlData, error: signedError } = await supabase.storage
          .from('profile-photos')
          .createSignedUrl(photoPath, 3600) // 60 minutes

        if (!signedError && signedUrlData) {
          setPhotoUrls(prev => ({ ...prev, [userId]: signedUrlData.signedUrl }))
        }
      }
    } catch (error) {
      console.error('Error loading photo URL:', error)
    }
  }

  const fetchMatches = async (viewerId: string) => {
    // Track this request to prevent stale updates
    const reqId = ++latestReq.current
    setDebugInfo((d: any) => ({ ...d, reqId, startedAt: new Date().toISOString() }))
    setFetchError(null)
    // DO NOT clear loadError here - only clear on success

    // Query matches where viewerId is either user_a or user_b
    const { data: matchRows, error: matchErr } = await supabase
      .from('matches')
      .select('id, user_a, user_b, created_at')
      .or(`user_a.eq.${viewerId},user_b.eq.${viewerId}`)
      .order('created_at', { ascending: false })

    // Check if this request is still the latest
    if (reqId !== latestReq.current) return

    if (matchErr) {
      console.error('Error fetching matches:', matchErr)
      setLoadError('Couldn\'t load matches right now. Please refresh.')
      setLoading(false)
      setDebugInfo((d: any) => ({
        ...d,
        matchesError: {
          message: (matchErr as any)?.message,
          code: (matchErr as any)?.code,
        },
      }))
      return
    }

    if (!matchRows || matchRows.length === 0) {
      setMatches([])
      setLoading(false)
      setLoadError(null) // Clear error if we successfully got empty matches
      setDebugInfo((d: any) => ({ ...d, matchRows: 0, otherUserIdsCount: 0 }))
      return
    }

    // Derive the other user ids correctly
    const otherUserIds = (matchRows ?? [])
      .map(r => (r.user_a === viewerId ? r.user_b : r.user_a))
      .filter(Boolean)

    // Guard: if no user IDs, return early
    if (otherUserIds.length === 0) {
      setMatches([])
      setLoading(false)
      setLoadError(null) // Clear error if we successfully fetched matches (just no other users)
      setDebugInfo((d: any) => ({ ...d, matchRows: matchRows.length, otherUserIdsCount: 0 }))
      return
    }

    // Logging before profiles query
    console.log('Matches fetched:', matchRows.length, 'match rows')
    console.log('match otherUserIds:', otherUserIds, 'count:', otherUserIds?.length)

    // Smoke test: can we read any profile row?
    const smoke = await supabase.from('profiles').select('id').limit(1)
    console.log('profiles smoke:', smoke)

    // Check if this request is still the latest
    if (reqId !== latestReq.current) return

    // Fetch profiles for those ids (using select('*') to avoid column mismatch)
    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', otherUserIds)

    // Check if this request is still the latest
    if (reqId !== latestReq.current) return

    if (profilesErr) {
      console.error('profilesError raw:', profilesErr)
      console.error('profilesError props:', {
        message: (profilesErr as any)?.message,
        details: (profilesErr as any)?.details,
        hint: (profilesErr as any)?.hint,
        code: (profilesErr as any)?.code,
        status: (profilesErr as any)?.status,
      })
      console.error('profilesError keys:', Object.getOwnPropertyNames(profilesErr ?? {}))
      console.error('profilesError json:', JSON.stringify(profilesErr))
      setLoadError('Couldn\'t load matches right now. Please refresh.')
      setLoading(false)
      setDebugInfo((d: any) => ({
        ...d,
        matchRows: matchRows.length,
        otherUserIdsCount: otherUserIds.length,
        profilesError: {
          message: (profilesErr as any)?.message,
          code: (profilesErr as any)?.code,
          hint: (profilesErr as any)?.hint,
        },
      }))
      // Don't clear matches state - keep existing matches visible
      return
    }

    // Only set state on success - check if still latest request
    if (reqId !== latestReq.current) return

    // Build profileById map
    const profileById: { [userId: string]: Profile } = {}
    ;(profiles ?? []).forEach((profile: any) => {
      if (profile.user_id) {
        profileById[profile.user_id] = profile
      }
    })

    // Join matches to profiles
    const matchesWithProfiles: MatchWithProfile[] = (matchRows ?? [])
      .map((matchRow) => {
        const otherUserId = matchRow.user_a === viewerId ? matchRow.user_b : matchRow.user_a
        const profile = profileById[otherUserId]
        
        if (!profile) {
          return null // Skip if profile missing (don't error)
        }

        return {
          match_id: matchRow.id,
          created_at: matchRow.created_at,
          other_user_id: otherUserId,
          profile: profile,
        }
      })
      .filter((item): item is MatchWithProfile => item !== null)

    // Success: set matches, clear loading, clear error
    setMatches(matchesWithProfiles)
    setLoading(false)
    setLoadError(null) // Clear error ONLY on success
    setDebugInfo((d: any) => ({
      ...d,
      matchRows: matchRows.length,
      otherUserIdsCount: otherUserIds.length,
      profilesCount: profiles?.length || 0,
      matchesWithProfilesCount: matchesWithProfiles.length,
    }))

    // Load photo URLs
    matchesWithProfiles.forEach(({ profile }) => {
      if (profile.photo_path) {
        loadPhotoUrl(profile.photo_path, profile.user_id)
      }
    })
  }

  useEffect(() => {
    if (!session?.access_token || matches.length === 0) {
      return
    }

    const otherUserIds = matches.map((item) => item.profile.user_id)

    if (otherUserIds.length === 0) {
      return
    }

    fetch('/api/matches/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ userIds: otherUserIds }),
    })
      .then(async (res) => {
        setContactsFetchStatus(res.status)
        if (res.ok) {
          const data = await res.json()
          setContactsByUserId(data.contacts || {})
        } else {
          setContactsByUserId({})
        }
      })
      .catch((error) => {
        console.error('Error fetching contacts:', error)
        setContactsFetchStatus(0)
        setContactsByUserId({})
      })
  }, [session?.access_token, matches])

  const handleUnmatchRequest = (matchId: string, otherUserId: string, name?: string) => {
    setConfirmUnmatch({ matchId, otherUserId, name })
  }

  const handleUnmatch = async (matchId: string, otherUserId: string) => {
    // Optimistic update
    setMatches(prev => prev.filter(item => item.match_id !== matchId))

    try {
      // Delete from matches where id = match_id
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId)

      if (error) {
        console.error('Error unmatching:', error)
        // Revert optimistic update on error
        if (session?.user?.id) {
          fetchMatches(session.user.id)
        }
        setToast('Failed to unmatch. Please try again.')
      } else {
        setToast('Unmatched successfully')
      }
    } catch (error) {
      console.error('Error unmatching:', error)
      if (session?.user?.id) {
        fetchMatches(session.user.id)
      }
      setToast('Failed to unmatch. Please try again.')
    }

    setTimeout(() => setToast(null), 3000)
  }

  const handleReport = () => {
    if (confirm('Report this user? This action cannot be undone.')) {
      // Stub for now - could create reports table later
      setToast('Reported')
      setTimeout(() => setToast(null), 3000)
    }
  }

  const handleCardClick = (profile: Profile) => {
    setSelectedProfile(profile)
    setIsModalOpen(true)
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (!session) {
    return (
      <div>
        <p>Please sign in</p>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ marginBottom: '30px' }}>Matches</h1>

      {fetchError && (
        <div style={{
          padding: '16px',
          marginBottom: '24px',
          background: 'rgba(239, 31, 159, 0.1)',
          border: '1px solid var(--pink)',
          borderRadius: '8px',
          color: 'var(--pink)',
        }}>
          {fetchError}
        </div>
      )}

      {loadError && (
        <div style={{
          padding: '16px',
          marginBottom: '24px',
          background: 'rgba(239, 31, 159, 0.1)',
          border: '1px solid var(--pink)',
          borderRadius: '8px',
          color: 'var(--pink)',
        }}>
          {loadError}
        </div>
      )}


      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'rgba(0, 0, 0, 0.9)',
          border: '1px solid var(--teal)',
          borderRadius: '8px',
          padding: '12px 24px',
          color: 'var(--teal)',
          zIndex: 10001,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        }}>
          {toast}
        </div>
      )}

      {!loading && !loadError && matches.length === 0 ? (
        <div className="ttb-card" style={{ textAlign: 'center', padding: '40px' }}>
          <h2 style={{ marginBottom: '10px', fontSize: '24px' }}>No matches yet</h2>
          <p style={{ color: 'var(--muted)', fontSize: '16px' }}>
            Swipe right to meet some co-founders!
          </p>
        </div>
      ) : matches.length > 0 ? (
        <div className="matches-grid">
          {matches.map((item) => {
            const otherUserId = item.profile.user_id
            const contact = contactsByUserId[otherUserId]
            const whatsapp = contact?.whatsapp
            const digitsOnly = whatsapp?.replace(/\D/g, '') || ''
            const photoUrl = photoUrls[otherUserId]

            return (
              <div
                key={item.match_id}
                className="ttb-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(92, 225, 230, 0.3)'
                  e.currentTarget.style.borderColor = 'rgba(92, 225, 230, 0.5)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = ''
                  e.currentTarget.style.borderColor = ''
                }}
                onClick={() => handleCardClick(item.profile)}
              >
                {/* 3-dot menu */}
                <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 100 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenDropdown(openDropdown === item.match_id ? null : item.match_id)
                    }}
                    style={{
                      background: 'rgba(0, 0, 0, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '4px',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--ink)',
                      fontSize: '18px',
                    }}
                  >
                    ⋯
                  </button>
                  <Dropdown
                    isOpen={openDropdown === item.match_id}
                    onClose={() => setOpenDropdown(null)}
                    onUnmatch={() => {
                      setOpenDropdown(null)
                      handleUnmatchRequest(item.match_id, otherUserId, item.profile.display_name)
                    }}
                    onReport={handleReport}
                    matchId={item.match_id}
                  />
                </div>

                {/* Photo and header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: photoUrl || item.profile.photo_url || item.profile.photo_path ? 'transparent' : 'rgba(255, 255, 255, 0.1)',
                    border: photoUrl || item.profile.photo_url || item.profile.photo_path ? 'none' : '1px solid rgba(255, 255, 255, 0.15)',
                    flexShrink: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {(() => {
                      // Use photoUrl from state if available, otherwise try photo_url or photo_path
                      const photoToUse = photoUrl || item.profile.photo_url || item.profile.photo_path
                      return photoToUse ? (
                        <img
                          src={photoToUse}
                          alt={getName(item.profile)}
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
                          background: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '50%',
                        }} />
                      )
                    })()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{
                      margin: 0,
                      fontSize: '20px',
                      fontWeight: '600',
                      marginBottom: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {getName(item.profile)}
                    </h2>
                    {getLocation(item.profile) && (
                      <p style={{
                        margin: 0,
                        color: 'var(--muted)',
                        fontSize: '13px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {getLocation(item.profile)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Tags and LinkedIn */}
                {(() => {
                  const tags = getExpertiseTags(item.profile).slice(0, 4)
                  const li = getLinkedInUrl(item.profile)
                  if (tags.length === 0 && !li) return null
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
                      {/* LinkedIn icon */}
                      {li && (
                        <a
                          href={li}
                          target="_blank"
                          rel="noreferrer noopener"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            color: 'var(--teal)',
                            textDecoration: 'none',
                            transition: 'all 0.2s ease',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0px',
                            borderRadius: '4px',
                            width: '24px',
                            height: '24px',
                            outline: 'none',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.15)'
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
                      )}
                      {/* Tags */}
                      {tags.map((tag, idx) => (
                        <span
                          key={`tag-${idx}`}
                          style={{
                            display: 'inline-flex',
                            padding: '6px 10px',
                            borderRadius: 999,
                            fontSize: '12px',
                            border: '1px solid rgba(92,225,230,0.35)',
                            background: 'rgba(0,0,0,0.25)',
                            color: 'rgba(255,255,255,0.85)',
                            boxShadow: '0 0 12px rgba(92,225,230,0.12)',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )
                })()}

                {/* WhatsApp button */}
                <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                  {whatsapp ? (
                    <div style={{ padding: '0', boxSizing: 'border-box' }}>
                      <p style={{
                        margin: '0 0 8px 0',
                        color: 'var(--muted)',
                        fontSize: '13px',
                      }}>
                        {whatsapp}
                      </p>
                      <div style={{ padding: '0', boxSizing: 'border-box' }}>
                        <a
                          href={`https://wa.me/${digitsOnly}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="ttb-btn ttb-btn-secondary"
                          style={{
                            display: 'block',
                            textAlign: 'center',
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '12px 16px',
                          }}
                        >
                          Message on WhatsApp
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p style={{
                      margin: 0,
                      color: 'var(--muted)',
                      fontSize: '13px',
                      fontStyle: 'italic',
                    }}>
                      WhatsApp not shared yet.
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedProfile(null)
        }}
        profile={selectedProfile}
        whatsapp={selectedProfile ? contactsByUserId[selectedProfile.user_id]?.whatsapp || null : null}
        photoUrls={photoUrls}
        getExpertiseTags={getExpertiseTags}
        getLinkedInUrl={getLinkedInUrl}
        getName={getName}
        getLocation={getLocation}
        formatFieldLabel={formatFieldLabel}
        normalizeValue={normalizeValue}
      />

      <ConfirmDialog
        isOpen={!!confirmUnmatch}
        onClose={() => setConfirmUnmatch(null)}
        onConfirm={() => {
          if (confirmUnmatch) {
            handleUnmatch(confirmUnmatch.matchId, confirmUnmatch.otherUserId)
          }
        }}
        title="Unmatch?"
        body="Are you sure? This action cannot be undone."
        confirmLabel="Unmatch"
        confirmDanger={true}
      />
    </div>
  )
}
