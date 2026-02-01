'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/src/lib/supabaseClient'

type Profile = {
  user_id: string
  display_name: string | null
  email: string | null
  role: string | null
  location_tz: string | null
  linkedin_url: string | null
  domain_expertise: string | null
  technical_expertise: string | null
  is_live: boolean
  is_complete: boolean
  created_at: string
  updated_at: string
  photo_path: string | null
}

export default function AdminUsers() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [search, setSearch] = useState('')
  const [isLiveFilter, setIsLiveFilter] = useState<string>('all')
  const [isCompleteFilter, setIsCompleteFilter] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<{ [userId: string]: string }>({})

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      if (data.session) {
        fetchProfiles(data.session.access_token)
      }
    })
  }, [])

  useEffect(() => {
    if (session?.access_token) {
      fetchProfiles(session.access_token)
    }
  }, [search, isLiveFilter, isCompleteFilter, session?.access_token])

  const fetchProfiles = async (accessToken: string) => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (isLiveFilter !== 'all') params.set('is_live', isLiveFilter)
      if (isCompleteFilter !== 'all') params.set('is_complete', isCompleteFilter)

      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to fetch profiles')
        return
      }

      const data = await response.json()
      setProfiles(data.profiles || [])
      setError(null)

      // Load photo URLs
      if (data.profiles) {
        loadPhotoUrls(data.profiles)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch profiles')
    }
  }

  const loadPhotoUrls = async (profiles: Profile[]) => {
    const urls: { [userId: string]: string } = {}
    
    for (const profile of profiles) {
      if (profile.photo_path) {
        try {
          const { data: publicUrlData } = supabase.storage
            .from('profile-photos')
            .getPublicUrl(profile.photo_path)

          // Test if public URL works
          const testPublicUrl = async (): Promise<boolean> => {
            return new Promise((resolve) => {
              const testImg = new Image()
              testImg.onload = () => resolve(true)
              testImg.onerror = () => resolve(false)
              testImg.src = publicUrlData.publicUrl
              setTimeout(() => resolve(false), 2000)
            })
          }

          const isPublic = await testPublicUrl()

          if (isPublic) {
            urls[profile.user_id] = publicUrlData.publicUrl
          } else {
            // Try signed URL
            const { data: signedUrlData } = await supabase.storage
              .from('profile-photos')
              .createSignedUrl(profile.photo_path, 3600)

            if (signedUrlData) {
              urls[profile.user_id] = signedUrlData.signedUrl
            }
          }
        } catch (err) {
          console.error(`Error loading photo for ${profile.user_id}:`, err)
        }
      }
    }

    setPhotoUrls(urls)
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{ padding: '40px' }}>
        <p>Please sign in</p>
        <Link href="/apply">Go to sign in</Link>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '24px', fontWeight: '600' }}>All Users</h1>

      {error && (
        <div style={{
          padding: '12px',
          background: 'rgba(239, 31, 159, 0.2)',
          border: '1px solid var(--pink)',
          borderRadius: '8px',
          marginBottom: '20px',
          color: 'var(--pink)',
        }}>
          Error: {error}
        </div>
      )}

      {/* Search and Filters */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '24px',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          style={{
            flex: '1',
            minWidth: '200px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(0, 0, 0, 0.3)',
            color: 'var(--ink)',
            fontSize: '14px',
          }}
        />
        <select
          value={isLiveFilter}
          onChange={(e) => setIsLiveFilter(e.target.value)}
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(0, 0, 0, 0.3)',
            color: 'var(--ink)',
            fontSize: '14px',
          }}
        >
          <option value="all">All Visibility</option>
          <option value="true">Discoverable</option>
          <option value="false">Hidden</option>
        </select>
        <select
          value={isCompleteFilter}
          onChange={(e) => setIsCompleteFilter(e.target.value)}
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(0, 0, 0, 0.3)',
            color: 'var(--ink)',
            fontSize: '14px',
          }}
        >
          <option value="all">All Status</option>
          <option value="true">Complete</option>
          <option value="false">Incomplete</option>
        </select>
      </div>

      {/* Profiles Grid */}
      {profiles.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          No profiles found.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px',
        }}>
          {profiles.map((profile) => (
            <Link
              key={profile.user_id}
              href={`/admin/users/${profile.user_id}`}
              style={{
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '20px',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
              >
                {/* Photo and Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    flexShrink: 0,
                  }}>
                    {photoUrls[profile.user_id] ? (
                      <img
                        src={photoUrls[profile.user_id]}
                        alt={profile.display_name || 'Profile'}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--muted)',
                        fontSize: '20px',
                      }}>
                        👤
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '18px',
                      fontWeight: '600',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {profile.display_name || 'No name'}
                    </h3>
                    {profile.email && (
                      <p style={{
                        margin: '4px 0 0 0',
                        fontSize: '12px',
                        color: 'var(--muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {profile.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Status badges */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  {profile.is_live ? (
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      background: 'rgba(239, 31, 159, 0.2)',
                      color: 'var(--pink)',
                      border: '1px solid var(--pink)',
                    }}>
                      Discoverable
                    </span>
                  ) : (
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      background: 'rgba(92, 225, 230, 0.2)',
                      color: 'var(--teal)',
                      border: '1px solid var(--teal)',
                    }}>
                      Hidden
                    </span>
                  )}
                  {profile.is_complete ? (
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      background: 'rgba(92, 225, 230, 0.2)',
                      color: 'var(--teal)',
                      border: '1px solid var(--teal)',
                    }}>
                      Complete
                    </span>
                  ) : (
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'var(--muted)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                    }}>
                      Incomplete
                    </span>
                  )}
                </div>

                {/* Key Info */}
                <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }}>
                  {profile.role && (
                    <div style={{ marginBottom: '4px' }}>
                      <strong style={{ color: 'var(--ink)' }}>Role:</strong> {profile.role}
                    </div>
                  )}
                  {profile.location_tz && (
                    <div style={{ marginBottom: '4px' }}>
                      <strong style={{ color: 'var(--ink)' }}>Location:</strong> {profile.location_tz}
                    </div>
                  )}
                  {profile.linkedin_url && (
                    <div style={{ marginBottom: '4px' }}>
                      <strong style={{ color: 'var(--ink)' }}>LinkedIn:</strong>{' '}
                      <a
                        href={profile.linkedin_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: 'var(--teal)', textDecoration: 'underline' }}
                      >
                        View
                      </a>
                    </div>
                  )}
                  {profile.domain_expertise && (
                    <div style={{ marginBottom: '4px' }}>
                      <strong style={{ color: 'var(--ink)' }}>Domain:</strong>{' '}
                      <span style={{ color: 'var(--muted)' }}>
                        {profile.domain_expertise.length > 40
                          ? `${profile.domain_expertise.substring(0, 40)}...`
                          : profile.domain_expertise}
                      </span>
                    </div>
                  )}
                  {profile.technical_expertise && (
                    <div style={{ marginBottom: '4px' }}>
                      <strong style={{ color: 'var(--ink)' }}>Tech:</strong>{' '}
                      <span style={{ color: 'var(--muted)' }}>
                        {profile.technical_expertise.length > 40
                          ? `${profile.technical_expertise.substring(0, 40)}...`
                          : profile.technical_expertise}
                      </span>
                    </div>
                  )}
                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--muted)' }}>
                    Updated: {new Date(profile.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
