'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/src/lib/supabaseClient'

type Application = {
  id: string
  user_id: string
  name: string
  why_cofounder: string
  what_building: string
  status: 'pending' | 'approved' | 'rejected'
}

export default function ApplyClient() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [session, setSession] = useState<any>(null)
  const [application, setApplication] = useState<Application | null>(null)
  const [applicationLoading, setApplicationLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    why_cofounder: '',
    what_building: '',
  })

  useEffect(() => {
    const error = searchParams.get('error')
    if (error === 'missing_code') {
      setMessage('Login link was invalid — please try again.')
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session)
        fetchApplication(data.session.user.id)
      } else {
        setSession(null)
        setApplication(null)
        setApplicationLoading(false)
      }
    })
  }, [searchParams])

  const fetchApplication = async (userId: string) => {
    setApplicationLoading(true)
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned", which is fine
      setSubmitMessage(`Error loading application: ${error.message}`)
    } else {
      setApplication(data || null)
    }
    setApplicationLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + '/apply',
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
    if (!session?.user?.id) return

    setSubmitting(true)
    setSubmitMessage(null)

    const { error } = await supabase
      .from('applications')
      .insert({
        user_id: session.user.id,
        name: formData.name,
        why_cofounder: formData.why_cofounder,
        what_building: formData.what_building,
      })

    if (error) {
      setSubmitMessage(`Error: ${error.message}`)
    } else {
      setSubmitMessage('Application submitted successfully!')
      await fetchApplication(session.user.id)
    }

    setSubmitting(false)
  }

  return (
    <div>
      <h1>Apply</h1>
      <p>You'll receive a magic link to sign in.</p>

      {session?.user?.email && (
        <p>Signed in as {session.user.email}</p>
      )}

      {message && (
        <p>{message}</p>
      )}

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send magic link'}
        </button>
      </form>

      {session && !applicationLoading && (
        <>
          {!application ? (
            <div>
              <h2>Application Form</h2>
              <form onSubmit={handleApplicationSubmit}>
                <div>
                  <label>
                    Name:
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                      disabled={submitting}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Why cofounder:
                    <textarea
                      value={formData.why_cofounder}
                      onChange={(e) =>
                        setFormData({ ...formData, why_cofounder: e.target.value })
                      }
                      required
                      disabled={submitting}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    What building:
                    <textarea
                      value={formData.what_building}
                      onChange={(e) =>
                        setFormData({ ...formData, what_building: e.target.value })
                      }
                      required
                      disabled={submitting}
                    />
                  </label>
                </div>
                {submitMessage && <p>{submitMessage}</p>}
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit application'}
                </button>
              </form>
            </div>
          ) : (
            <div>
              {application.status === 'pending' && (
                <p>Thanks — your application is pending review.</p>
              )}
              {application.status === 'approved' && (
                <div>
                  <p>You're approved — complete your profile.</p>
                  <Link href="/profile">
                    <button>Go to Profile</button>
                  </Link>
                </div>
              )}
              {application.status === 'rejected' && (
                <p>Sorry — we can't approve this right now.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
