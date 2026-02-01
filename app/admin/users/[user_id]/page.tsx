'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  skills_background: string | null
  interests_building: string | null
  availability: string | null
  links: string | null
  is_live: boolean
  is_complete: boolean
  created_at: string
  updated_at: string
  photo_path: string | null
  [key: string]: any
}

export default function AdminUserDetail() {
  const params = useParams()
  const router = useRouter()
  const userId = params.user_id as string
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) {
        fetchProfile(data.session.access_token)
      } else {
        setLoading(false)
      }
    })
  }, [userId])

  const fetchProfile = async (accessToken: string) => {
    try {
      const response = await fetch(`/api/admin/users?user_id=${encodeURIComponent(userId)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to fetch profile')
        setLoading(false)
        return
      }

      const data = await response.json()
      
      if (!data.profile) {
        setError('Profile not found')
        setLoading(false)
        return
      }

      setProfile(data.profile)
      setError(null)

      // Load photo URL
      if (data.profile.photo_path) {
        loadPhotoUrl(data.profile.photo_path)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch profile')
    } finally {
      setLoading(false)
    }
  }

  const loadPhotoUrl = async (photoPath: string) => {
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
          setTimeout(() => resolve(false), 2000)
        })
      }

      const isPublic = await testPublicUrl()

      if (isPublic) {
        setPhotoUrl(publicUrlData.publicUrl)
      } else {
        const { data: signedUrlData } = await supabase.storage
          .from('profile-photos')
          .createSignedUrl(photoPath, 3600)

        if (signedUrlData) {
          setPhotoUrl(signedUrlData.signedUrl)
        }
      }
    } catch (err) {
      console.error('Error loading photo:', err)
    }
  }

  const formatFieldLabel = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, c => c.toUpperCase())
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return value.join(', ')
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
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

  if (error || !profile) {
    return (
      <div style={{ padding: '40px' }}>
        <p>Error: {error || 'Profile not found'}</p>
        <Link href="/admin/users">Back to Users</Link>
      </div>
    )
  }

  // Fields to exclude from full display
  const excludedKeys = new Set([
    'user_id',
    'photo_path',
    'created_at',
    'updated_at',
  ])

  const allFields = Object.entries(profile)
    .filter(([key]) => !excludedKeys.has(key))
    .map(([key, value]) => ({
      key,
      label: formatFieldLabel(key),
      value: formatValue(value),
    }))
    .filter(({ value }) => value !== '—' && value !== '')

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link
          href="/admin/users"
          style={{
            color: 'var(--teal)',
            textDecoration: 'none',
            fontSize: '14px',
          }}
        >
          ← Back to Users
        </Link>
      </div>

      <h1 style={{ fontSize: '32px', marginBottom: '24px', fontWeight: '600' }}>
        {profile.display_name || 'User Profile'}
      </h1>

      {/* Photo and Basic Info */}
      <div style={{
        display: 'flex',
        gap: '24px',
        marginBottom: '32px',
        padding: '24px',
        background: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
      }}>
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          flexShrink: 0,
        }}>
          {photoUrl ? (
            <img
              src={photoUrl}
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
              fontSize: '48px',
            }}>
              👤
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: '12px' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '600' }}>
              {profile.display_name || 'No name'}
            </h2>
            {profile.email && (
              <p style={{ margin: '0 0 4px 0', color: 'var(--muted)', fontSize: '14px' }}>
                {profile.email}
              </p>
            )}
            {profile.user_id && (
              <p style={{ margin: '0', color: 'var(--muted)', fontSize: '12px', fontFamily: 'monospace' }}>
                ID: {profile.user_id}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {profile.is_live ? (
              <span style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                background: 'rgba(239, 31, 159, 0.2)',
                color: 'var(--pink)',
                border: '1px solid var(--pink)',
              }}>
                Discoverable
              </span>
            ) : (
              <span style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                background: 'rgba(92, 225, 230, 0.2)',
                color: 'var(--teal)',
                border: '1px solid var(--teal)',
              }}>
                Hidden
              </span>
            )}
            {profile.is_complete ? (
              <span style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                background: 'rgba(92, 225, 230, 0.2)',
                color: 'var(--teal)',
                border: '1px solid var(--teal)',
              }}>
                Complete
              </span>
            ) : (
              <span style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'var(--muted)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}>
                Incomplete
              </span>
            )}
          </div>
        </div>
      </div>

      {/* All Profile Fields */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: '24px',
      }}>
        <h3 style={{
          margin: '0 0 20px 0',
          fontSize: '18px',
          fontWeight: '600',
        }}>
          Profile Details
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
        }}>
          {allFields.map(({ key, label, value }) => (
            <div key={key}>
              <div style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--muted)',
                fontWeight: '600',
                marginBottom: '6px',
              }}>
                {label}
              </div>
              <div style={{
                color: 'var(--ink)',
                fontSize: '14px',
                lineHeight: '1.6',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
              }}>
                {key === 'linkedin_url' && value.startsWith('http') ? (
                  <a
                    href={value}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ color: 'var(--teal)', textDecoration: 'underline' }}
                  >
                    {value}
                  </a>
                ) : key === 'links' && value.includes('http') ? (
                  <a
                    href={value.split(/\s+/).find(v => v.startsWith('http://') || v.startsWith('https://')) || value}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ color: 'var(--teal)', textDecoration: 'underline' }}
                  >
                    {value}
                  </a>
                ) : (
                  value
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timestamps */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '8px',
        fontSize: '12px',
        color: 'var(--muted)',
      }}>
        <div>Created: {new Date(profile.created_at).toLocaleString()}</div>
        <div>Updated: {new Date(profile.updated_at).toLocaleString()}</div>
      </div>
    </div>
  )
}
