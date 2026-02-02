'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/src/lib/supabaseClient'

type Application = {
  id: string
  email: string
  linkedin?: string
  linkedin_url?: string
  stem_background: string
  created_at: string
  status: string
}

export default function AdminApplications() {
  const [session, setSession] = useState<any>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) {
        fetchApplications(data.session.access_token)
      } else {
        setLoading(false)
      }
    })
  }, [])

  const fetchApplications = async (accessToken: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/applications', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.status === 401 || response.status === 403) {
        setError('Unauthorized')
        setLoading(false)
        return
      }

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to fetch applications')
        setLoading(false)
        return
      }

      const data = await response.json()
      setApplications(data)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch applications')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (id: string, status: 'approved' | 'rejected') => {
    if (!session?.access_token) return

    setUpdating(id)
    setError(null)

    try {
      const response = await fetch('/api/admin/applications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, status }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to update application')
        setUpdating(null)
        return
      }

      await fetchApplications(session.access_token)
    } catch (err: any) {
      setError(err.message || 'Failed to update application')
    } finally {
      setUpdating(null)
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

  return (
    <div
      style={{
        maxWidth: 980,
        margin: '0 auto',
        padding: '28px 18px 60px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 44, letterSpacing: -1 }}>Pending Applications</h1>
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>
          {loading ? 'Loading…' : `${applications.length} pending`}
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: 16,
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(239,31,159,0.35)',
            background: 'rgba(239,31,159,0.08)',
            color: 'var(--ink)',
            fontSize: 14,
          }}
        >
          <strong style={{ color: 'var(--pink)' }}>Error:</strong> {error}
        </div>
      )}

      {applications.length === 0 ? (
        <div style={{ marginTop: 24, color: 'var(--muted)', fontSize: 16 }}>
          No pending applications
        </div>
      ) : (
        <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
          {applications.map((app) => {
            const linkedin = app.linkedin_url ?? app.linkedin ?? ''
            const created = new Date(app.created_at).toLocaleString()

            return (
              <div
                key={app.id}
                style={{
                  borderRadius: 18,
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: 'rgba(0,0,0,0.18)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 260 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                      Submitted {created}
                    </div>

                    <div style={{ fontSize: 18, fontWeight: 650, color: 'var(--ink)' }}>
                      {app.email}
                    </div>

                    <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: 12,
                          padding: '6px 10px',
                          borderRadius: 999,
                          border: '1px solid rgba(92,225,230,0.35)',
                          background: 'rgba(92,225,230,0.10)',
                          color: 'var(--teal)',
                        }}
                      >
                        status: {app.status}
                      </span>

                      {linkedin && (
                        <a
                          href={linkedin}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 12,
                            padding: '6px 10px',
                            borderRadius: 999,
                            border: '1px solid rgba(255,255,255,0.14)',
                            background: 'rgba(255,255,255,0.06)',
                            color: 'var(--ink)',
                            textDecoration: 'none',
                          }}
                        >
                          View LinkedIn →
                        </a>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button
                      onClick={() => handleStatusUpdate(app.id, 'approved')}
                      disabled={updating === app.id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: '1px solid rgba(239,31,159,0.55)',
                        background: 'rgba(239,31,159,0.20)',
                        color: 'var(--ink)',
                        fontWeight: 700,
                        cursor: updating === app.id ? 'not-allowed' : 'pointer',
                        opacity: updating === app.id ? 0.7 : 1,
                      }}
                    >
                      {updating === app.id ? 'Updating…' : 'Approve'}
                    </button>

                    <button
                      onClick={() => handleStatusUpdate(app.id, 'rejected')}
                      disabled={updating === app.id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.18)',
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--ink)',
                        fontWeight: 650,
                        cursor: updating === app.id ? 'not-allowed' : 'pointer',
                        opacity: updating === app.id ? 0.7 : 1,
                      }}
                    >
                      {updating === app.id ? 'Updating…' : 'Reject'}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: '1px solid rgba(255,255,255,0.10)',
                    color: 'var(--ink)',
                    lineHeight: 1.5,
                    fontSize: 14,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>STEM background</div>
                  {app.stem_background}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

}
