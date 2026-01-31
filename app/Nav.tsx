'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/src/lib/supabaseClient'

export default function Nav() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null)
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) {
        fetchOnboardingStatus(data.session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchOnboardingStatus(session.user.id)
      } else {
        setApplicationStatus(null)
        setProfileComplete(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchOnboardingStatus = async (userId: string) => {
    // Fetch application status
    const { data: appData } = await supabase
      .from('applications')
      .select('status')
      .eq('user_id', userId)
      .maybeSingle()

    setApplicationStatus(appData?.status || null)

    // Fetch profile completion status
    const { data: profileData } = await supabase
      .from('profiles')
      .select('is_complete')
      .eq('user_id', userId)
      .maybeSingle()

    setProfileComplete(profileData?.is_complete || false)
    setLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading || !session) {
    return null
  }

  // Determine which nav to show
  const isApproved = applicationStatus === 'approved'
  const isProfileComplete = profileComplete === true

  return (
    <nav>
      {!isApproved ? (
        <>
          <Link href="/apply" className="ttb-link">Apply</Link>
          <span> | </span>
          <button onClick={handleSignOut} className="ttb-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            Sign out
          </button>
        </>
      ) : !isProfileComplete ? (
        <>
          <Link href="/profile" className="ttb-link">Profile</Link>
          <span> | </span>
          <button onClick={handleSignOut} className="ttb-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <Link href="/discover" className="ttb-link">Discover</Link>
          <span> | </span>
          <Link href="/matches" className="ttb-link">Matches</Link>
          <span> | </span>
          <Link href="/profile" className="ttb-link">Profile</Link>
          <span> | </span>
          <button onClick={handleSignOut} className="ttb-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            Sign out
          </button>
        </>
      )}
    </nav>
  )
}
