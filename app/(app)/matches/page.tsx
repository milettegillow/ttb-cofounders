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
  domain_expertise: string | null
  technical_expertise: string | null
  location_tz: string | null
  skills_background: string | null
  interests_building: string | null
  links: string | null
  linkedin_url: string | null
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
      .select('display_name, domain_expertise, technical_expertise, location_tz, skills_background, interests_building, links, linkedin_url, user_id')
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
      <h1 style={{ marginBottom: '30px' }}>Matches</h1>

      {matches.length === 0 ? (
        <div className="ttb-card" style={{ textAlign: 'center', padding: '40px' }}>
          <h2 style={{ marginBottom: '10px', fontSize: '24px' }}>No matches yet</h2>
          <p style={{ color: 'var(--muted)', fontSize: '16px' }}>Head to Discover and start swiping.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px',
        }}>
          {matches.map((item) => {
            const otherUserId = item.profile.user_id
            const contact = contactsByUserId[otherUserId]
            const whatsapp = contact?.whatsapp
            const digitsOnly = whatsapp?.replace(/\D/g, '') || ''

            return (
              <div
                key={item.match.id}
                className="ttb-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Header */}
                <div style={{ marginBottom: '16px', borderBottom: '1px solid #333', paddingBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
                      {item.profile.display_name}
                    </h2>
                    {item.profile.technical_expertise && (
                      <span className="ttb-pill">
                        {item.profile.technical_expertise}
                      </span>
                    )}
                  </div>
                  {item.profile.location_tz && (
                    <p style={{ margin: 0, color: '#999', fontSize: '14px' }}>
                      📍 {item.profile.location_tz}
                    </p>
                  )}
                </div>

                {/* Skills & Background */}
                {item.profile.skills_background && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{
                      margin: '0 0 8px 0',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: '#999',
                      fontWeight: '500',
                    }}>
                      Skills & Background
                    </h3>
                    <p style={{ margin: 0, color: '#ccc', fontSize: '14px', lineHeight: '1.5' }}>
                      {item.profile.skills_background}
                    </p>
                  </div>
                )}

                {/* Interested in Building */}
                {item.profile.interests_building && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{
                      margin: '0 0 8px 0',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: '#999',
                      fontWeight: '500',
                    }}>
                      Interested in Building
                    </h3>
                    <p style={{ margin: 0, color: '#ccc', fontSize: '14px', lineHeight: '1.5' }}>
                      {item.profile.interests_building}
                    </p>
                  </div>
                )}

                {/* Links */}
                {item.profile.links && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{
                      margin: '0 0 8px 0',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: '#999',
                      fontWeight: '500',
                    }}>
                      Links
                    </h3>
                    <p style={{ margin: 0, color: '#ccc', fontSize: '14px', lineHeight: '1.5' }}>
                      {item.profile.links}
                    </p>
                  </div>
                )}

                {/* Contact Section */}
                <div style={{
                  marginTop: 'auto',
                  paddingTop: '20px',
                  borderTop: '1px solid #333',
                }}>
                  {whatsapp ? (
                    <div>
                      <p style={{ margin: '0 0 12px 0', color: '#999', fontSize: '14px' }}>
                        <strong style={{ color: '#fff' }}>WhatsApp:</strong> {whatsapp}
                      </p>
                      {digitsOnly ? (
                        <a
                          href={`https://wa.me/${digitsOnly}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ttb-btn ttb-btn-secondary"
                          style={{ width: '100%' }}
                        >
                          Message on WhatsApp
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: '#666', fontSize: '14px', fontStyle: 'italic' }}>
                      WhatsApp not shared yet.
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
