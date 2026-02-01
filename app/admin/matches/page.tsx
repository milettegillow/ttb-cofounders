'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/src/lib/supabaseClient'

type UserInfo = {
  user_id: string
  display_name: string | null
  email: string | null
  photo_path: string | null
}

type Match = {
  id: string
  user_a: UserInfo
  user_b: UserInfo
  created_at: string
}

type ConfirmModalProps = {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  matchId: string
}

function ConfirmModal({ isOpen, onConfirm, onCancel, matchId }: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}>
      <div
        ref={modalRef}
        style={{
          background: 'rgba(0, 0, 0, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
        }}
      >
        <h3 style={{
          margin: '0 0 16px 0',
          fontSize: '18px',
          fontWeight: '600',
          color: 'var(--ink)',
        }}>
          Unmatch?
        </h3>
        <p style={{
          margin: '0 0 24px 0',
          color: 'var(--muted)',
          fontSize: '14px',
          lineHeight: '1.6',
        }}>
          Are you sure? This action cannot be undone.
        </p>
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: 'transparent',
              color: 'var(--ink)',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid var(--pink)',
              background: 'rgba(239, 31, 159, 0.2)',
              color: 'var(--pink)',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            Unmatch
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminMatches() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [matches, setMatches] = useState<Match[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmingMatchId, setConfirmingMatchId] = useState<string | null>(null)
  const [unmatchingId, setUnmatchingId] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<{ [userId: string]: string }>({})

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      if (data.session) {
        fetchMatches(data.session.access_token)
      }
    })
  }, [])

  useEffect(() => {
    if (session?.access_token) {
      fetchMatches(session.access_token)
    }
  }, [search, session?.access_token])

  const fetchMatches = async (accessToken: string) => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)

      const response = await fetch(`/api/admin/matches?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to fetch matches')
        return
      }

      const data = await response.json()
      setMatches(data.matches || [])
      setError(null)

      // Load photo URLs
      if (data.matches) {
        loadPhotoUrls(data.matches)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch matches')
    }
  }

  const loadPhotoUrls = async (matches: Match[]) => {
    const urls: { [userId: string]: string } = {}
    const userIds = new Set<string>()

    matches.forEach((match) => {
      if (match.user_a.photo_path) userIds.add(match.user_a.user_id)
      if (match.user_b.photo_path) userIds.add(match.user_b.user_id)
    })

    for (const userId of userIds) {
      const match = matches.find(
        (m) => m.user_a.user_id === userId || m.user_b.user_id === userId
      )
      if (!match) continue

      const photoPath =
        match.user_a.user_id === userId
          ? match.user_a.photo_path
          : match.user_b.photo_path

      if (!photoPath) continue

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
          urls[userId] = publicUrlData.publicUrl
        } else {
          const { data: signedUrlData } = await supabase.storage
            .from('profile-photos')
            .createSignedUrl(photoPath, 3600)

          if (signedUrlData) {
            urls[userId] = signedUrlData.signedUrl
          }
        }
      } catch (err) {
        console.error(`Error loading photo for ${userId}:`, err)
      }
    }

    setPhotoUrls(urls)
  }

  const handleUnmatch = async (matchId: string) => {
    if (!session?.access_token) return

    setConfirmingMatchId(null)
    setUnmatchingId(matchId)

    try {
      const response = await fetch(`/api/admin/matches/${matchId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to unmatch')
        setUnmatchingId(null)
        return
      }

      console.log(`[admin] Successfully unmatched ${matchId}`)

      // Remove from local state
      setMatches((prev) => prev.filter((m) => m.id !== matchId))
      setUnmatchingId(null)
    } catch (err: any) {
      setError(err.message || 'Failed to unmatch')
      setUnmatchingId(null)
    }
  }

  const renderUser = (user: UserInfo, label: string) => {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          flexShrink: 0,
        }}>
          {photoUrls[user.user_id] ? (
            <img
              src={photoUrls[user.user_id]}
              alt={user.display_name || 'User'}
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
              fontSize: '16px',
            }}>
              👤
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--ink)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {user.display_name || 'No name'}
          </div>
          {user.email && (
            <div style={{
              fontSize: '12px',
              color: 'var(--muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {user.email}
            </div>
          )}
          <Link
            href={`/admin/users/${user.user_id}`}
            style={{
              fontSize: '11px',
              color: 'var(--teal)',
              textDecoration: 'none',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            View profile →
          </Link>
        </div>
      </div>
    )
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
      <h1 style={{ fontSize: '32px', marginBottom: '24px', fontWeight: '600' }}>
        All Matches
      </h1>

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

      {/* Search */}
      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(0, 0, 0, 0.3)',
            color: 'var(--ink)',
            fontSize: '14px',
          }}
        />
      </div>

      {/* Matches Table */}
      {matches.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          No matches found.
        </div>
      ) : (
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{
                background: 'rgba(0, 0, 0, 0.5)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              }}>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--muted)',
                  fontWeight: '600',
                }}>
                  Match ID
                </th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--muted)',
                  fontWeight: '600',
                }}>
                  User A
                </th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--muted)',
                  fontWeight: '600',
                }}>
                  User B
                </th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--muted)',
                  fontWeight: '600',
                }}>
                  Created At
                </th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'right',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--muted)',
                  fontWeight: '600',
                }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => (
                <tr
                  key={match.id}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <td style={{
                    padding: '16px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: 'var(--muted)',
                  }}>
                    {match.id.substring(0, 8)}...
                  </td>
                  <td style={{ padding: '16px' }}>
                    {renderUser(match.user_a, 'User A')}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {renderUser(match.user_b, 'User B')}
                  </td>
                  <td style={{
                    padding: '16px',
                    fontSize: '13px',
                    color: 'var(--muted)',
                  }}>
                    {new Date(match.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <button
                      onClick={() => setConfirmingMatchId(match.id)}
                      disabled={unmatchingId === match.id}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: '1px solid var(--pink)',
                        background: unmatchingId === match.id
                          ? 'rgba(239, 31, 159, 0.1)'
                          : 'transparent',
                        color: 'var(--pink)',
                        fontSize: '12px',
                        cursor: unmatchingId === match.id ? 'not-allowed' : 'pointer',
                        fontWeight: '600',
                      }}
                    >
                      {unmatchingId === match.id ? 'Unmatching...' : 'Force Unmatch'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmingMatchId !== null}
        onConfirm={() => confirmingMatchId && handleUnmatch(confirmingMatchId)}
        onCancel={() => setConfirmingMatchId(null)}
        matchId={confirmingMatchId || ''}
      />
    </div>
  )
}
