'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/src/lib/supabaseClient'

type Application = {
  id: string
  user_id: string
  status: 'pending' | 'approved' | 'rejected'
}

type Profile = {
  id: string
  user_id: string
  display_name: string
  role: string
  location: string | null
  timezone: string | null
  skills: string | null
  bio: string | null
  links: string | null
  is_complete: boolean
}

export default function Profile() {
  const [session, setSession] = useState<any>(null)
  const [application, setApplication] = useState<Application | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [markingComplete, setMarkingComplete] = useState(false)

  const [formData, setFormData] = useState({
    display_name: '',
    role: '',
    location: '',
    timezone: '',
    skills: '',
    bio: '',
    links: '',
    whatsapp: '',
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session)
        fetchApplication(data.session.user.id)
      } else {
        setLoading(false)
      }
    })
  }, [])

  const fetchApplication = async (userId: string) => {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      setMessage(`Error loading application: ${error.message}`)
      setLoading(false)
      return
    }

    if (!data || data.status !== 'approved') {
      setApplication(null)
      setLoading(false)
      return
    }

    setApplication(data)
    fetchProfile(userId)
  }

  const fetchProfile = async (userId: string) => {
    // Fetch profile
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      setMessage(`Error loading profile: ${error.message}`)
    } else if (data) {
      setProfile(data)
      setFormData({
        display_name: data.display_name || '',
        role: data.role || '',
        location: data.location || '',
        timezone: data.timezone || '',
        skills: data.skills || '',
        bio: data.bio || '',
        links: data.links || '',
        whatsapp: '',
      })
    }

    // Fetch user_contacts for WhatsApp
    const { data: contactsData } = await supabase
      .from('user_contacts')
      .select('whatsapp, share_whatsapp')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (contactsData) {
      setFormData((prev) => ({
        ...prev,
        whatsapp: contactsData.whatsapp || '',
      }))
    }

    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user?.id) return

    setSaving(true)
    setMessage(null)

    // Upsert user_contacts with WhatsApp
    const { error: contactsError } = await supabase
      .from('user_contacts')
      .upsert(
        {
          user_id: session.user.id,
          whatsapp: formData.whatsapp || null,
          share_whatsapp: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )

    if (contactsError) {
      setMessage(`Error saving contacts: ${contactsError.message}`)
      setSaving(false)
      return
    }

    // Update profile (without whatsapp)
    const updateData = {
      display_name: formData.display_name,
      role: formData.role,
      location: formData.location || null,
      timezone: formData.timezone || null,
      skills: formData.skills || null,
      bio: formData.bio || null,
      links: formData.links || null,
      updated_at: new Date().toISOString(),
    }

    if (profile) {
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id)

      if (error) {
        setMessage(`Error: ${error.message}`)
      } else {
        setMessage('Profile updated successfully!')
        await fetchProfile(session.user.id)
      }
    } else {
      const { error } = await supabase
        .from('profiles')
        .insert({
          user_id: session.user.id,
          ...updateData,
        })

      if (error) {
        setMessage(`Error: ${error.message}`)
      } else {
        setMessage('Profile created successfully!')
        await fetchProfile(session.user.id)
      }
    }

    setSaving(false)
  }

  const handleMarkComplete = async () => {
    if (!session?.user?.id || !profile) return

    setMarkingComplete(true)
    setMessage(null)

    // Ensure user_contacts exists when marking complete
    await supabase
      .from('user_contacts')
      .upsert(
        {
          user_id: session.user.id,
          whatsapp: formData.whatsapp || null,
          share_whatsapp: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )

    const { error } = await supabase
      .from('profiles')
      .update({ is_complete: true, updated_at: new Date().toISOString() })
      .eq('id', profile.id)

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('Profile marked as complete!')
      await fetchProfile(session.user.id)
    }

    setMarkingComplete(false)
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

  if (!application || application.status !== 'approved') {
    return (
      <div>
        <p>Your application isn't approved yet.</p>
        <Link href="/apply">Go to application</Link>
      </div>
    )
  }

  return (
    <div>
      {/* Identity and sign out */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Signed in as {session.user.email}
        </p>
        <button 
          onClick={async () => {
            await supabase.auth.signOut()
            window.location.href = '/'
          }}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '6px 12px',
            cursor: 'pointer',
            color: 'var(--ink)',
            fontSize: '14px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--pink)'
            e.currentTarget.style.opacity = '0.9'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.opacity = '1'
          }}
        >
          Sign out
        </button>
      </div>

      <h1>Profile</h1>

      {message && <p>{message}</p>}

      {profile?.is_complete && (
        <p>Profile is complete!</p>
      )}

      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Display Name: *
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) =>
                setFormData({ ...formData, display_name: e.target.value })
              }
              required
              disabled={saving}
            />
          </label>
        </div>

        <div>
          <label>
            Role: *
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value })
              }
              required
              disabled={saving}
            >
              <option value="">Select a role</option>
              <option value="Technical cofounder">Technical cofounder</option>
              <option value="Business cofounder">Business cofounder</option>
              <option value="Open">Open</option>
            </select>
          </label>
        </div>

        <div>
          <label>
            Location:
            <input
              type="text"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              disabled={saving}
            />
          </label>
        </div>

        <div>
          <label>
            Timezone:
            <input
              type="text"
              value={formData.timezone}
              onChange={(e) =>
                setFormData({ ...formData, timezone: e.target.value })
              }
              disabled={saving}
            />
          </label>
        </div>

        <div>
          <label>
            Skills:
            <textarea
              value={formData.skills}
              onChange={(e) =>
                setFormData({ ...formData, skills: e.target.value })
              }
              disabled={saving}
            />
          </label>
        </div>

        <div>
          <label>
            Bio:
            <textarea
              value={formData.bio}
              onChange={(e) =>
                setFormData({ ...formData, bio: e.target.value })
              }
              disabled={saving}
            />
          </label>
        </div>

        <div>
          <label>
            Links:
            <textarea
              value={formData.links}
              onChange={(e) =>
                setFormData({ ...formData, links: e.target.value })
              }
              disabled={saving}
            />
          </label>
        </div>

        <div>
          <label>
            WhatsApp:
            <input
              type="text"
              value={formData.whatsapp}
              onChange={(e) =>
                setFormData({ ...formData, whatsapp: e.target.value })
              }
              disabled={saving}
            />
          </label>
        </div>

        <button type="submit" disabled={saving} className="ttb-btn ttb-btn-primary">
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>

      {profile && !profile.is_complete && (
        <div>
          <button onClick={handleMarkComplete} disabled={markingComplete} className="ttb-btn ttb-btn-secondary">
            {markingComplete ? 'Marking...' : 'Mark profile as complete'}
          </button>
        </div>
      )}
    </div>
  )
}
