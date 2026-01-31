'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/src/lib/supabaseClient'

type Match = {
  id: string
  user_a: string
  user_b: string
  created_at: string
}

type Profile = {
  user_id: string
  display_name: string
  role: string
  location: string | null
  skills: string | null
  bio: string | null
  links: string | null
}

type MatchWithProfile = {
  match: Match
  profile: Profile
}

export default function Matches() {
  const [session, setSession] = useState<any>(null)
  const [matches, setMatches] = useState<MatchWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [contactsByUserId, setContactsByUserId] = useState<{ [userId: string]: { whatsapp: string } }>({})
  const [contactsFetchStatus, setContactsFetchStatus] = useState<number | null>(null)

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

  const fetchMatches = async (userId: string) => {
    // Fetch matches where user is either user_a or user_b
    const { data: matchesData, error: matchesError } = await supabase
      .from('matches')
      .select('*')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (matchesError) {
      console.error('Error fetching matches:', matchesError)
      setLoading(false)
      return
    }

    if (!matchesData || matchesData.length === 0) {
      setMatches([])
      setLoading(false)
      return
    }

    // Compute other user IDs
    const otherUserIds = matchesData.map((match) =>
      match.user_a === userId ? match.user_b : match.user_a
    )

    // Fetch profiles for other users
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('display_name, role, location, skills, bio, links, user_id')
      .in('user_id', otherUserIds)

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      setLoading(false)
      return
    }

    // Combine matches with profiles
    const matchesWithProfiles: MatchWithProfile[] = matchesData
      .map((match) => {
        const otherUserId = match.user_a === userId ? match.user_b : match.user_a
        const profile = profilesData?.find((p) => p.user_id === otherUserId)
        return profile ? { match, profile } : null
      })
      .filter((item): item is MatchWithProfile => item !== null)

    setMatches(matchesWithProfiles)
    setLoading(false)
  }

  // Fetch contacts after matches are loaded
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
      <h1>Matches</h1>

      {matches.length === 0 ? (
        <p>No matches yet. Keep swiping!</p>
      ) : (
        <div>
          {matches.map((item) => (
            <div key={item.match.id}>
              <h2>{item.profile.display_name}</h2>
              <p><strong>Role:</strong> {item.profile.role}</p>
              {item.profile.location && (
                <p><strong>Location:</strong> {item.profile.location}</p>
              )}
              {item.profile.skills && (
                <div>
                  <strong>Skills:</strong>
                  <p>{item.profile.skills}</p>
                </div>
              )}
              {item.profile.bio && (
                <div>
                  <strong>Bio:</strong>
                  <p>{item.profile.bio}</p>
                </div>
              )}
              {item.profile.links && (
                <div>
                  <strong>Links:</strong>
                  <p>{item.profile.links}</p>
                </div>
              )}
              {(() => {
                const otherUserId = item.profile.user_id
                const contact = contactsByUserId[otherUserId]
                const whatsapp = contact?.whatsapp

                if (whatsapp) {
                  const digitsOnly = whatsapp.replace(/\D/g, '')
                  return (
                    <div>
                      <p><strong>WhatsApp:</strong> {whatsapp}</p>
                      {digitsOnly ? (
                        <a
                          href={`https://wa.me/${digitsOnly}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <button>Message on WhatsApp</button>
                        </a>
                      ) : null}
                    </div>
                  )
                } else {
                  return <p>WhatsApp not shared yet.</p>
                }
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
