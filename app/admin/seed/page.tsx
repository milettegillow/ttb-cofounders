'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/src/lib/supabaseClient'

export default function AdminSeed() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(10)
  const [seeding, setSeeding] = useState(false)
  const [result, setResult] = useState<Array<{ user_id: string; email: string }> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [matching, setMatching] = useState<string | null>(null)
  const [matchSuccess, setMatchSuccess] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
  }, [])

  const handleSeed = async () => {
    if (!session?.access_token) return

    setSeeding(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ count }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to seed profiles')
        setSeeding(false)
        return
      }

      const data = await response.json()
      setResult(data.created || [])
    } catch (err: any) {
      setError(err.message || 'Failed to seed profiles')
    } finally {
      setSeeding(false)
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
      <h1>Seed Test Profiles</h1>

      <div>
        <label>
          Count:
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value) || 10)}
            min={1}
            max={100}
          />
        </label>
      </div>

      <button onClick={handleSeed} disabled={seeding}>
        {seeding ? 'Generating...' : 'Generate seed profiles'}
      </button>

      {error && (
        <p>Error: {error}</p>
      )}

      {matchSuccess && (
        <div>
          <p>Match created successfully!</p>
          <Link href="/matches">View matches</Link>
        </div>
      )}

      {result && (
        <div>
          <p>Created {result.length} profiles:</p>
          <ul>
            {result.map((item) => (
              <li key={item.user_id}>
                {item.email}
                <button
                  onClick={() => handleForceMatch(item.user_id)}
                  disabled={matching === item.user_id}
                >
                  {matching === item.user_id ? 'Matching...' : 'Force match with me'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
