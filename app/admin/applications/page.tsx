'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/src/lib/supabaseClient'

type Application = {
  id: string
  name: string
  why_cofounder: string
  what_building: string
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
    <div>
      <h1>Pending Applications</h1>

      {error && <p>Error: {error}</p>}

      {applications.length === 0 ? (
        <p>No pending applications</p>
      ) : (
        <ul>
          {applications.map((app) => (
            <li key={app.id}>
              <div>
                <strong>Name:</strong> {app.name}
              </div>
              <div>
                <strong>What building:</strong> {app.what_building}
              </div>
              <div>
                <strong>Why cofounder:</strong> {app.why_cofounder}
              </div>
              <div>
                <strong>Created:</strong> {new Date(app.created_at).toLocaleString()}
              </div>
              <div>
                <button
                  onClick={() => handleStatusUpdate(app.id, 'approved')}
                  disabled={updating === app.id}
                >
                  {updating === app.id ? 'Updating...' : 'Approve'}
                </button>
                <button
                  onClick={() => handleStatusUpdate(app.id, 'rejected')}
                  disabled={updating === app.id}
                >
                  {updating === app.id ? 'Updating...' : 'Reject'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
