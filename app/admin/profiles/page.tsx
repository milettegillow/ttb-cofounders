'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/src/lib/supabaseClient'

type Profile = {
  user_id: string
  display_name: string
  technical_expertise: string | null
  location_tz: string | null
  is_complete: boolean
  updated_at: string
}

export default function AdminProfiles() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [filter, setFilter] = useState('')
  const [matching, setMatching] = useState<string | null>(null)
  const [matchSuccess, setMatchSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      if (data.session) {
        fetchProfiles(data.session.access_token)
      }
    })
  }, [])

  const fetchProfiles = async (accessToken: string) => {
    try {
      const response = await fetch('/api/admin/profiles', {
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
    } catch (err: any) {
      setError(err.message || 'Failed to fetch profiles')
    }
  }

  const handleForceMatch = async (targetUserId: string) => {
    if (!session?.access_token) return

    setMatching(targetUserId)
    setMatchSuccess(null)
    setError(null)

    try {
      const response = await fetch('/api/admin/force-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ targetUserId }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to force match')
        setMatching(null)
        return
      }

      setMatchSuccess(targetUserId)
    } catch (err: any) {
      setError(err.message || 'Failed to force match')
    } finally {
      setMatching(null)
    }
  }

  const filteredProfiles = profiles.filter((profile) =>
    profile.display_name.toLowerCase().includes(filter.toLowerCase())
  )

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
      <h1>All Profiles</h1>

      {error && <p>Error: {error}</p>}

      {matchSuccess && (
        <div>
          <p>Matched! Check <Link href="/matches">/matches</Link></p>
        </div>
      )}

      <div>
        <label>
          Filter by name:
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search display name..."
          />
        </label>
      </div>

      <table>
        <thead>
          <tr>
            <th>Display Name</th>
            <th>Technical Expertise</th>
            <th>Location + Timezone</th>
            <th>Complete</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredProfiles.map((profile) => (
            <tr key={profile.user_id}>
              <td>{profile.display_name}</td>
              <td>{profile.technical_expertise || '-'}</td>
              <td>{profile.location_tz || '-'}</td>
              <td>{profile.is_complete ? 'Yes' : 'No'}</td>
              <td>
                <button
                  onClick={() => handleForceMatch(profile.user_id)}
                  disabled={matching === profile.user_id}
                >
                  {matching === profile.user_id ? 'Matching...' : 'Force match with me'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filteredProfiles.length === 0 && (
        <p>No profiles found.</p>
      )}
    </div>
  )
}
