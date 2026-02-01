'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/src/lib/supabaseClient'

type UserInfo = {
  user_id: string
  display_name: string | null
  email: string | null
  photo_path: string | null
}

type Report = {
  id: string
  reporter: UserInfo
  reported: UserInfo
  reason: string | null
  details: string | null
  created_at: string
  status: 'open' | 'investigating' | 'resolved'
}

export default function AdminReports() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<Report[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<{ [userId: string]: string }>({})

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      if (data.session) {
        fetchReports(data.session.access_token)
      }
    })
  }, [])

  useEffect(() => {
    if (session?.access_token) {
      fetchReports(session.access_token)
    }
  }, [statusFilter, session?.access_token])

  const fetchReports = async (accessToken: string) => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const response = await fetch(`/api/admin/reports?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        // Check if reports table is not set up
        if (response.status === 503 && data.setup_required) {
          setError('setup_required')
          setReports([])
          return
        }
        setError(data.error || 'Failed to fetch reports')
        setReports([])
        return
      }

      const data = await response.json()
      setReports(data.reports || [])
      setError(null)

      // Load photo URLs
      if (data.reports && data.reports.length > 0) {
        loadPhotoUrls(data.reports)
      }
    } catch (err: any) {
      // Network errors or other issues
      setError(err.message || 'Failed to fetch reports')
      setReports([])
    }
  }

  const loadPhotoUrls = async (reports: Report[]) => {
    const urls: { [userId: string]: string } = {}
    const userIds = new Set<string>()

    reports.forEach((report) => {
      if (report.reporter.photo_path) userIds.add(report.reporter.user_id)
      if (report.reported.photo_path) userIds.add(report.reported.user_id)
    })

    for (const userId of userIds) {
      const report = reports.find(
        (r) => r.reporter.user_id === userId || r.reported.user_id === userId
      )
      if (!report) continue

      const photoPath =
        report.reporter.user_id === userId
          ? report.reporter.photo_path
          : report.reported.photo_path

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

  const handleUpdateStatus = async (reportId: string, newStatus: 'open' | 'investigating' | 'resolved') => {
    if (!session?.access_token) return

    setUpdatingStatus(reportId)

    try {
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to update report status')
        setUpdatingStatus(null)
        return
      }

      // Refresh reports
      await fetchReports(session.access_token)
      setUpdatingStatus(null)
      if (selectedReport?.id === reportId) {
        setSelectedReport(null)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update report status')
      setUpdatingStatus(null)
    }
  }

  const renderUser = (user: UserInfo, label: string) => {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '48px',
          height: '48px',
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
              fontSize: '20px',
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'var(--pink)'
      case 'investigating':
        return 'var(--teal)'
      case 'resolved':
        return 'var(--muted)'
      default:
        return 'var(--muted)'
    }
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
        Reports
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

      {/* Status Filter */}
      <div style={{ marginBottom: '24px' }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
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
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Reports List */}
      {error === 'setup_required' ? null : !loading && reports.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          No reports found.
        </div>
      ) : reports.length > 0 ? (
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
                  Reporter
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
                  Reported User
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
                  Reason
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
                  Status
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
                  Created
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
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr
                  key={report.id}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedReport(report)}
                >
                  <td style={{ padding: '16px' }}>
                    {renderUser(report.reporter, 'Reporter')}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {renderUser(report.reported, 'Reported')}
                  </td>
                  <td style={{
                    padding: '16px',
                    fontSize: '13px',
                    color: 'var(--ink)',
                    maxWidth: '200px',
                  }}>
                    {report.reason || '—'}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      background: `rgba(${getStatusColor(report.status) === 'var(--pink)' ? '239, 31, 159' : getStatusColor(report.status) === 'var(--teal)' ? '92, 225, 230' : '255, 255, 255'}, 0.2)`,
                      color: getStatusColor(report.status),
                      border: `1px solid ${getStatusColor(report.status)}`,
                      textTransform: 'capitalize',
                    }}>
                      {report.status}
                    </span>
                  </td>
                  <td style={{
                    padding: '16px',
                    fontSize: '13px',
                    color: 'var(--muted)',
                  }}>
                    {new Date(report.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (report.status !== 'resolved') {
                          handleUpdateStatus(report.id, 'resolved')
                        } else {
                          handleUpdateStatus(report.id, 'open')
                        }
                      }}
                      disabled={updatingStatus === report.id}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--teal)',
                        background: updatingStatus === report.id
                          ? 'rgba(92, 225, 230, 0.1)'
                          : 'transparent',
                        color: 'var(--teal)',
                        fontSize: '12px',
                        cursor: updatingStatus === report.id ? 'not-allowed' : 'pointer',
                        fontWeight: '600',
                      }}
                    >
                      {updatingStatus === report.id
                        ? 'Updating...'
                        : report.status === 'resolved'
                        ? 'Reopen'
                        : 'Mark Resolved'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Detail Modal */}
      {selectedReport && (
        <div
          style={{
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
            padding: '20px',
          }}
          onClick={() => setSelectedReport(null)}
        >
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '600',
                color: 'var(--ink)',
              }}>
                Report Details
              </h2>
              <button
                onClick={() => setSelectedReport(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted)',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: 0,
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--muted)',
                marginBottom: '8px',
              }}>
                Reporter
              </div>
              {renderUser(selectedReport.reporter, 'Reporter')}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--muted)',
                marginBottom: '8px',
              }}>
                Reported User
              </div>
              {renderUser(selectedReport.reported, 'Reported')}
            </div>

            {selectedReport.reason && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--muted)',
                  marginBottom: '8px',
                }}>
                  Reason
                </div>
                <div style={{
                  color: 'var(--ink)',
                  fontSize: '14px',
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                }}>
                  {selectedReport.reason}
                </div>
              </div>
            )}

            {selectedReport.details && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--muted)',
                  marginBottom: '8px',
                }}>
                  Details
                </div>
                <div style={{
                  color: 'var(--ink)',
                  fontSize: '14px',
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  whiteSpace: 'pre-wrap',
                }}>
                  {selectedReport.details}
                </div>
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              marginTop: '24px',
            }}>
              <button
                onClick={() => setSelectedReport(null)}
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
                Close
              </button>
              {selectedReport.status !== 'resolved' && (
                <button
                  onClick={() => {
                    handleUpdateStatus(selectedReport.id, 'resolved')
                    setSelectedReport(null)
                  }}
                  disabled={updatingStatus === selectedReport.id}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid var(--teal)',
                    background: 'rgba(92, 225, 230, 0.2)',
                    color: 'var(--teal)',
                    fontSize: '14px',
                    cursor: updatingStatus === selectedReport.id ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                  }}
                >
                  {updatingStatus === selectedReport.id ? 'Updating...' : 'Mark Resolved'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
