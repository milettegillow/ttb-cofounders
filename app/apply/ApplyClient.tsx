'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/src/lib/supabaseClient'

type Application = {
  id: string
  user_id: string
  email: string
  linkedin: string
  stem_background: string
  status: 'pending' | 'approved' | 'rejected'
}

export default function ApplyClient() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'apply' | 'signin'>('apply')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [session, setSession] = useState<any>(null)
  const [application, setApplication] = useState<Application | null>(null)
  const [applicationLoading, setApplicationLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const [linkedinError, setLinkedinError] = useState<string | null>(null)
  const [existingAccountNotice, setExistingAccountNotice] = useState(false)
  const [applySuccess, setApplySuccess] = useState(false)
  const [applySuccessMessage, setApplySuccessMessage] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    email: '',
    linkedin: '',
    stem_background: '',
  })

  useEffect(() => {
    const error = searchParams.get('error')
    if (error === 'missing_code') {
      setMessage('Login link was invalid — please try again.')
      setActiveTab('signin')
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session)
        // Prefill email from session if signed in
        if (data.session.user.email) {
          setFormData(prev => ({ ...prev, email: data.session.user.email || '' }))
        }
        fetchApplication(data.session.user.id)
      } else {
        setSession(null)
        setApplication(null)
        setApplicationLoading(false)
        // Load draft from localStorage if signed out
        loadDraft()
      }
    })

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchApplication(session.user.id)
      } else {
        setApplication(null)
        setApplicationLoading(false)
        loadDraft()
      }
    })

    return () => subscription.unsubscribe()
  }, [searchParams])

  useEffect(() => {
    // After sign-in, check for draft and restore if no application exists
    if (session?.user?.id && !application && !applicationLoading) {
      const draft = localStorage.getItem('ttb_apply_draft')
      if (draft) {
        try {
          const parsed = JSON.parse(draft)
          setFormData({
            email: parsed.email || session.user.email || '',
            linkedin: parsed.linkedin || '',
            stem_background: parsed.stem_background || '',
          })
          setDraftRestored(true)
          setActiveTab('apply')
        } catch (e) {
          // Invalid draft, ignore
        }
      } else if (session.user.email) {
        // If no draft but signed in, prefill email
        setFormData(prev => ({ ...prev, email: session.user.email }))
      }
    }
  }, [session, application, applicationLoading])

  const loadDraft = () => {
    const draft = localStorage.getItem('ttb_apply_draft')
    if (draft) {
      try {
        const parsed = JSON.parse(draft)
        setFormData({
          email: parsed.email || '',
          linkedin: parsed.linkedin || '',
          stem_background: parsed.stem_background || '',
        })
      } catch (e) {
        // Invalid draft, ignore
      }
    }
  }

  const saveDraft = () => {
    const canonicalized = {
      ...formData,
      linkedin: canonicalizeLinkedIn(formData.linkedin),
    }
    localStorage.setItem('ttb_apply_draft', JSON.stringify(canonicalized))
  }

  const clearDraft = () => {
    localStorage.removeItem('ttb_apply_draft')
  }

  const validateLinkedIn = (url: string): string | null => {
    if (!url || !url.trim()) {
      return 'LinkedIn URL is required'
    }

    const trimmed = url.trim()

    // Must start with https:// or http://
    if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) {
      return 'Please paste your LinkedIn profile URL in the format: https://www.linkedin.com/in/your-handle'
    }

    try {
      const urlObj = new URL(trimmed)
      const host = urlObj.hostname.toLowerCase()
      const path = urlObj.pathname

      // Host must be linkedin.com or www.linkedin.com
      if (host !== 'linkedin.com' && host !== 'www.linkedin.com') {
        return 'Please paste your LinkedIn profile URL in the format: https://www.linkedin.com/in/your-handle'
      }

      // Path must start with /in/
      if (!path.startsWith('/in/')) {
        return 'Please paste your LinkedIn profile URL in the format: https://www.linkedin.com/in/your-handle'
      }

      // Extract handle (everything after /in/)
      const handle = path.substring(4).split('/')[0].split('?')[0]

      // Handle must be at least 2 characters
      if (!handle || handle.length < 2) {
        return 'Please paste your LinkedIn profile URL in the format: https://www.linkedin.com/in/your-handle'
      }

      // Reject invalid paths
      const invalidPaths = ['/pub/', '/company/', '/school/', '/sales/', '/feed/', '/posts/', '/profile/']
      if (invalidPaths.some(invalid => path.includes(invalid))) {
        return 'Please paste your LinkedIn profile URL in the format: https://www.linkedin.com/in/your-handle'
      }

      return null
    } catch (e) {
      return 'Please paste your LinkedIn profile URL in the format: https://www.linkedin.com/in/your-handle'
    }
  }

  const canonicalizeLinkedIn = (url: string): string => {
    if (!url || !url.trim()) return ''

    try {
      const trimmed = url.trim()
      const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
      const path = urlObj.pathname

      // Only canonicalize if path starts with /in/
      if (!path.startsWith('/in/')) {
        return trimmed
      }

      // Extract handle (everything after /in/, before query/hash)
      const handle = path.substring(4).split('/')[0].split('?')[0]

      if (!handle) return trimmed

      // Return canonical URL: https://www.linkedin.com/in/<handle>
      return `https://www.linkedin.com/in/${handle}`
    } catch (e) {
      return url.trim()
    }
  }

  const fetchApplication = async (userId: string) => {
    setApplicationLoading(true)
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      setSubmitMessage(`Error loading application: ${error.message}`)
    } else {
      setApplication(data || null)
      // If application exists, clear any draft
      if (data) {
        clearDraft()
      }
    }
    setApplicationLoading(false)
  }

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // Use NEXT_PUBLIC_SITE_URL for redirect, fallback to window.location.origin for local dev
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const emailRedirectTo = `${siteUrl}/auth/callback`

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
      },
    })

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('Check your email for the magic link!')
    }

    setLoading(false)
  }

  const handleApplicationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate LinkedIn URL
    const linkedinValidationError = validateLinkedIn(formData.linkedin)
    if (linkedinValidationError) {
      setLinkedinError(linkedinValidationError)
      setSubmitMessage('Please fix the errors above.')
      return
    }

    // Validate required fields
    if (!formData.email || !formData.linkedin || !formData.stem_background) {
      setSubmitMessage('Please fill in all required fields.')
      return
    }

    // Signed-out: always check email existence first (deterministic flow)
    if (!session?.user?.id) {
      setSubmitting(true)
      setSubmitMessage(null)
      setApplySuccess(false)
      setApplySuccessMessage(null)

      try {
        // Step 1: Check if email exists in auth (FIRST network call)
        const response = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: formData.email }),
        })

        let emailExists = false
        let degraded = false
        if (response.ok) {
          try {
            const data = await response.json()
            emailExists = data.exists === true
            degraded = data.degraded === true
          } catch (parseError) {
            // JSON parse failed - treat as new email (non-blocking)
            emailExists = false
            degraded = true
          }
        } else {
          // Response not OK - treat as new email (non-blocking)
          emailExists = false
          degraded = true
        }

        // Step 2: If email exists in auth, switch to Sign in tab immediately
        if (emailExists) {
          setExistingAccountNotice(true)
          setEmail(formData.email) // Prefill email in sign in form
          setActiveTab('signin')
          setSubmitting(false)
          return
        }

        // Step 3: Email doesn't exist (or check failed/degraded) - proceed to insert pre_applications
        const canonicalLinkedIn = canonicalizeLinkedIn(formData.linkedin)
        const { error: insertError } = await supabase
          .from('pre_applications')
          .insert({
            email: formData.email,
            linkedin: canonicalLinkedIn, // legacy field
            linkedin_url: canonicalLinkedIn, // canonical field
            stem_background: formData.stem_background,
            status: 'pending',
          })

        if (insertError) {
          // Handle conflict (already applied via pre_applications)
          // Check for PostgreSQL unique constraint violation (code 23505) or duplicate/unique messages
          const isConflict = insertError.code === '23505' || 
                            insertError.message?.toLowerCase().includes('duplicate') || 
                            insertError.message?.toLowerCase().includes('unique') ||
                            insertError.message?.toLowerCase().includes('already exists')
          
          if (isConflict) {
            // Show teal info message on Apply tab (or Sign in if we switch)
            setApplySuccessMessage("We already have an application for this email. If you already created a profile before, use Sign in.")
            // Do NOT set existingAccountNotice (no extra "already have an account" note)
            setEmail(formData.email) // Prefill email in sign in form
            setActiveTab('signin') // Optionally switch to Sign in tab
          } else {
            setSubmitMessage(`Error: ${insertError.message}`)
          }
          setSubmitting(false)
          return
        }

        // Step 4: Insert succeeded - show success message, stay on Apply tab
        setApplySuccess(true)
        setApplySuccessMessage("Thanks for applying! We'll be in touch.")
        setSubmitting(false)
        return
      } catch (error: any) {
        setSubmitMessage(`Error: ${error.message || 'Failed to submit application'}`)
        setSubmitting(false)
        return
      }
    }

    // If signed in, submit to database
    setSubmitting(true)
    setSubmitMessage(null)

    // Use session email if available, otherwise form email
    const emailToStore = session.user.email || formData.email
    const canonicalLinkedIn = canonicalizeLinkedIn(formData.linkedin)

    const { error } = await supabase
      .from('applications')
      .insert({
        user_id: session.user.id,
        email: emailToStore,
        linkedin: canonicalLinkedIn,
        stem_background: formData.stem_background,
      })

    if (error) {
      setSubmitMessage(`Error: ${error.message}`)
    } else {
      setSubmitMessage('Application submitted successfully!')
      clearDraft()
      await fetchApplication(session.user.id)
    }

    setSubmitting(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <>
      {/* Brand label - always show in upper left */}
      <div style={{
        position: 'fixed',
        top: 18,
        left: 24,
        zIndex: 50,
        fontFamily: 'Helvetica, Arial, sans-serif',
        fontSize: '28px',
        letterSpacing: '-0.06em',
        color: 'var(--pink)',
      }}>
        the tech bros
      </div>

      <div style={{
        minHeight: '100vh',
        paddingTop: 60,
        paddingLeft: 24,
        paddingRight: 24,
      }}>
        <div style={{
          maxWidth: 600,
          margin: '0 auto',
        }}>
          <div className="ttb-panel">
            <h1 style={{ marginBottom: '20px', paddingTop: '0', paddingBottom: '0', marginTop: '0' }}>co-founder matching platform</h1>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '32px', borderBottom: '1px solid var(--border)' }}>
              <button
                onClick={() => setActiveTab('apply')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: activeTab === 'apply' ? 'var(--pink)' : 'var(--muted)',
                  fontSize: '16px',
                  padding: '12px 0',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'apply' ? '2px solid var(--pink)' : '2px solid transparent',
                  fontWeight: activeTab === 'apply' ? '600' : '400',
                }}
              >
                Apply
              </button>
              <button
                onClick={() => {
                  setActiveTab('signin')
                  setExistingAccountNotice(false) // Clear notice when manually switching to Sign in tab
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: activeTab === 'signin' ? 'var(--pink)' : 'var(--muted)',
                  fontSize: '16px',
                  padding: '12px 0',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'signin' ? '2px solid var(--pink)' : '2px solid transparent',
                  fontWeight: activeTab === 'signin' ? '600' : '400',
                }}
              >
                Sign in
              </button>
            </div>

      {/* Apply Tab */}
      {activeTab === 'apply' && (
        <>
          {draftRestored && (
            <p style={{ color: 'var(--teal)', marginBottom: '12px', fontSize: '14px' }}>
              Draft restored
            </p>
          )}

          {session && !applicationLoading && application ? (
            <div>
              {application.status === 'pending' && (
                <p style={{ marginBottom: '20px' }}>Thanks — your application is pending review.</p>
              )}
              {application.status === 'approved' && (
                <div>
                  <p style={{ marginBottom: '20px' }}>You're approved — complete your profile.</p>
                  <Link href="/profile" className="ttb-btn ttb-btn-primary">
                    Go to Profile
                  </Link>
                </div>
              )}
              {application.status === 'rejected' && (
                <p style={{ marginBottom: '20px' }}>Sorry — we can't approve this right now.</p>
              )}
            </div>
          ) : (
            <form onSubmit={handleApplicationSubmit}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ color: 'var(--ink)', fontWeight: 'bold' }}>
                  Email:
                </label>
                <input
                  type="email"
                  className="ttb-input"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="you@domain.com"
                  required
                  disabled={submitting || !!session?.user?.email || applySuccess}
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ color: 'var(--ink)', fontWeight: 'bold' }}>
                  LinkedIn:
                </label>
                <input
                  type="url"
                  className="ttb-input"
                  value={formData.linkedin}
                  onChange={(e) => {
                    setFormData({ ...formData, linkedin: e.target.value })
                    // Clear error when user types
                    if (linkedinError) {
                      setLinkedinError(null)
                    }
                  }}
                  onBlur={() => {
                    const error = validateLinkedIn(formData.linkedin)
                    setLinkedinError(error)
                  }}
                  placeholder="https://www.linkedin.com/in/your-handle"
                  required
                  disabled={submitting || applySuccess}
                />
                {linkedinError && (
                  <p style={{ color: 'var(--pink)', fontSize: '14px', marginTop: '4px', marginBottom: 0 }}>
                    {linkedinError}
                  </p>
                )}
              </div>
              <div style={{ marginBottom: '24px' }}>
                <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '8px' }}>
                  This cofounder matching is for women in STEM. Tell us your STEM background so we can review your application.
                </p>
                <label style={{ color: 'var(--ink)', fontWeight: 'bold' }}>
                  STEM background:
                </label>
                <textarea
                  className="ttb-textarea"
                  value={formData.stem_background}
                  onChange={(e) =>
                    setFormData({ ...formData, stem_background: e.target.value })
                  }
                  placeholder="Degree / work experience / technical areas..."
                  required
                  disabled={submitting || applySuccess}
                  style={{ minHeight: '80px' }}
                />
              </div>
              {submitMessage && <p style={{ marginBottom: '20px', color: 'var(--pink)' }}>{submitMessage}</p>}
              {applySuccessMessage && (
                <p style={{ marginBottom: '20px', color: 'var(--teal)', fontWeight: '500' }}>
                  {applySuccessMessage}
                </p>
              )}
              <button 
                type="submit" 
                disabled={submitting || !!linkedinError || !formData.email || !formData.linkedin || !formData.stem_background || applySuccess} 
                className="ttb-btn ttb-btn-primary"
                style={{ marginTop: '8px' }}
              >
                {submitting ? 'Submitting...' : 'Submit application'}
              </button>
            </form>
          )}
        </>
      )}

      {/* Sign in Tab */}
      {activeTab === 'signin' && (
        <>
          {session ? (
            <>
              <p style={{ marginBottom: '32px' }}>Signed in as {session.user.email}</p>
              <button onClick={handleSignOut} className="ttb-btn ttb-btn-secondary">
                Sign out
              </button>
            </>
          ) : (
            <>
              {/* Always show default helper text at top */}
              <p style={{ color: 'var(--muted)', marginBottom: '24px' }}>
                If you already have an account, sign in with the magic link below.
              </p>

              {/* Show applySuccessMessage if present (e.g., from pre_applications conflict) */}
              {applySuccessMessage && (
                <div className="ttb-info" style={{ marginBottom: '24px' }}>
                  <p style={{ margin: 0, fontWeight: '500' }}>{applySuccessMessage}</p>
                </div>
              )}
              
              <form onSubmit={handleSignInSubmit}>
                <div style={{ marginBottom: '28px' }}>
                  <input
                    type="email"
                    className="ttb-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    disabled={loading}
                  />
                </div>
                <button type="submit" disabled={loading} className="ttb-btn ttb-btn-primary">
                  {loading ? 'Sending...' : 'Send magic link'}
                </button>
              </form>

              {/* Show existing account notice at bottom only when exists === true */}
              {existingAccountNotice && (
                <div className="ttb-info" style={{ marginTop: '24px' }}>
                  <p style={{ margin: 0, fontWeight: '500' }}>You already have an account. Please sign in.</p>
                </div>
              )}

              {/* Show other messages (e.g., from URL params) if present */}
              {message && !existingAccountNotice && (
                <div style={{
                  background: 'rgba(239, 31, 159, 0.1)',
                  border: '1px solid var(--pink)',
                  borderRadius: '8px',
                  padding: '16px',
                  marginTop: '24px',
                  color: 'var(--ink)',
                }}>
                  <p style={{ margin: 0, fontWeight: '500' }}>{message}</p>
                </div>
              )}
            </>
          )}
        </>
      )}
          </div>
        </div>
      </div>
    </>
  )
}
