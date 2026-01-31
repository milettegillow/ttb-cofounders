'use client'

import { useEffect, useState, useCallback } from 'react'
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
  skills: string | null
  bio: string | null
  links: string | null
  updated_at: string
}

export default function Discover() {
  const [session, setSession] = useState<any>(null)
  const [application, setApplication] = useState<Application | null>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [inFlight, setInFlight] = useState(false)
  const [swipeAnim, setSwipeAnim] = useState<'left' | 'right' | null>(null)
  const [showMatchToast, setShowMatchToast] = useState(false)

  const currentProfile = profiles[currentIndex]

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session)
        checkAccess(data.session.user.id)
      } else {
        setLoading(false)
      }
    })
  }, [])

  const doSwipe = useCallback(async (direction: 'like' | 'pass') => {
    if (!session?.access_token || !currentProfile || inFlight) return

    setInFlight(true)
    setSwipeAnim(direction === 'pass' ? 'left' : 'right')

    try {
      const response = await fetch('/api/swipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ toUserId: currentProfile.user_id, direction }),
      })

      if (!response.ok) {
        console.error('Swipe failed')
        setSwipeAnim(null)
        setInFlight(false)
        return
      }

      const data = await response.json()

      if (data.matched) {
        setShowMatchToast(true)
      }

      // Advance to next card after animation
      setTimeout(() => {
        setCurrentIndex((i) => i + 1)
        setSwipeAnim(null)
        setInFlight(false)
      }, 300)
    } catch (error) {
      console.error('Error swiping:', error)
      setSwipeAnim(null)
      setInFlight(false)
    }
  }, [session?.access_token, currentProfile, inFlight])

  useEffect(() => {
    if (inFlight || !currentProfile) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        doSwipe('pass')
      } else if (e.key === 'ArrowRight') {
        doSwipe('like')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [inFlight, currentProfile, doSwipe])

  useEffect(() => {
    if (showMatchToast) {
      const timer = setTimeout(() => {
        setShowMatchToast(false)
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [showMatchToast])

  const checkAccess = async (userId: string) => {
    // Check application status
    const { data: appData, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (appError && appError.code !== 'PGRST116') {
      setLoading(false)
      return
    }

    if (!appData || appData.status !== 'approved') {
      setApplication(null)
      setLoading(false)
      return
    }

    setApplication(appData)

    // Check user's own profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      setLoading(false)
      return
    }

    if (!profileData || !profileData.is_complete) {
      setUserProfile(null)
      setLoading(false)
      return
    }

    setUserProfile(profileData)
    fetchProfiles(userId)
  }

  const fetchProfiles = async (currentUserId: string) => {
    // Query swipes to get all users already swiped on
    const { data: swipesData } = await supabase
      .from('swipes')
      .select('to_user_id')
      .eq('from_user_id', currentUserId)

    // Query matches to get all matched users
    const { data: matchesData } = await supabase
      .from('matches')
      .select('user_a, user_b')
      .or(`user_a.eq.${currentUserId},user_b.eq.${currentUserId}`)

    // Build exclusion set
    const exclusionSet = new Set<string>([currentUserId])

    // Add all swiped user IDs
    if (swipesData) {
      swipesData.forEach((swipe) => {
        exclusionSet.add(swipe.to_user_id)
      })
    }

    // Add all matched user IDs (the "other" user in each match)
    if (matchesData) {
      matchesData.forEach((match) => {
        const otherUserId = match.user_a === currentUserId ? match.user_b : match.user_a
        exclusionSet.add(otherUserId)
      })
    }

    // Build exclusion array (excluding current user)
    const excludedIds = Array.from(exclusionSet).filter((id) => id !== currentUserId)

    // Build profiles query
    let query = supabase
      .from('profiles')
      .select('*')
      .eq('is_complete', true)
      .neq('user_id', currentUserId)

    // Apply exclusion filter if there are excluded users
    if (excludedIds.length > 0) {
      query = query.not('user_id', 'in', `(${excludedIds.map(id => `"${id}"`).join(',')})`)
    }

    const { data, error } = await query
      .order('updated_at', { ascending: false })
      .limit(25)

    if (error) {
      console.error('Error fetching profiles:', error)
    } else {
      setProfiles(data || [])
    }

    setLoading(false)
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

  if (!userProfile || !userProfile.is_complete) {
    return (
      <div>
        <p>Please complete your profile first.</p>
        <Link href="/profile">Go to profile</Link>
      </div>
    )
  }

  if (profiles.length === 0 || !currentProfile) {
    return (
      <div>
        <h1>Discover</h1>
        <p>No profiles yet.</p>
      </div>
    )
  }

  const cardStyle: React.CSSProperties = {
    transition: 'transform 0.3s ease, opacity 0.3s ease',
    transform: swipeAnim === 'left' ? 'translateX(-100px)' : swipeAnim === 'right' ? 'translateX(100px)' : 'translateX(0)',
    opacity: swipeAnim ? 0.5 : 1,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
      <h1>Discover</h1>

      {showMatchToast && (
        <div style={{ 
          position: 'fixed', 
          top: '20px', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          background: 'var(--pink)', 
          color: 'white', 
          padding: '15px 20px', 
          borderRadius: '8px',
          zIndex: 1000,
        }}>
          It's a match! <Link href="/matches" style={{ color: 'white', textDecoration: 'underline' }}>Go to Matches →</Link>
        </div>
      )}

      <div className="ttb-card" style={{ 
        width: '100%', 
        maxWidth: '500px', 
        margin: '20px 0',
        ...cardStyle,
      }}>
        <h2 style={{ fontSize: '32px', marginBottom: '10px' }}>{currentProfile.display_name}</h2>
        
        <span className="ttb-pill" style={{ marginBottom: '15px' }}>
          {currentProfile.role}
        </span>

        {currentProfile.location && (
          <p style={{ marginBottom: '15px', color: 'var(--muted)' }}>📍 {currentProfile.location}</p>
        )}

        {currentProfile.skills && (
          <div style={{ marginBottom: '20px' }}>
            <strong>Skills:</strong>
            <p style={{ marginTop: '5px' }}>{currentProfile.skills}</p>
          </div>
        )}

        {currentProfile.bio && (
          <div style={{ marginBottom: '20px' }}>
            <strong>Bio:</strong>
            <p style={{ marginTop: '5px' }}>{currentProfile.bio}</p>
          </div>
        )}

        {currentProfile.links && (
          <div style={{ marginBottom: '20px' }}>
            <strong>Links:</strong>
            <p style={{ marginTop: '5px' }}>{currentProfile.links}</p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        <button
          onClick={() => doSwipe('pass')}
          disabled={inFlight}
          className="ttb-btn ttb-btn-secondary"
          style={{ fontSize: '18px', padding: '15px 40px' }}
        >
          {inFlight ? 'Processing...' : 'Pass'}
        </button>
        <button
          onClick={() => doSwipe('like')}
          disabled={inFlight}
          className="ttb-btn ttb-btn-primary"
          style={{ fontSize: '18px', padding: '15px 40px' }}
        >
          {inFlight ? 'Processing...' : 'Like'}
        </button>
      </div>

      <p style={{ marginTop: '20px', color: 'var(--muted)', fontSize: '14px' }}>
        Use ← → arrow keys to swipe
      </p>
    </div>
  )
}
