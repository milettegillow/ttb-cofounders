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
  const [swiping, setSwiping] = useState<string | null>(null)
  const [matchedProfileId, setMatchedProfileId] = useState<string | null>(null)

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

  const handleSwipe = async (toUserId: string, direction: 'like' | 'pass') => {
    if (!session?.access_token) return

    setSwiping(toUserId)
    setMatchedProfileId(null)

    try {
      const response = await fetch('/api/swipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ toUserId, direction }),
      })

      if (!response.ok) {
        console.error('Swipe failed')
        return
      }

      const data = await response.json()

      if (data.matched) {
        setMatchedProfileId(toUserId)
        // Keep the profile visible for a moment to show match message
        setTimeout(() => {
          setProfiles((prev) => prev.filter((p) => p.user_id !== toUserId))
          setMatchedProfileId(null)
        }, 2000)
      } else {
        // Remove profile immediately
        setProfiles((prev) => prev.filter((p) => p.user_id !== toUserId))
      }
    } catch (error) {
      console.error('Error swiping:', error)
    } finally {
      setSwiping(null)
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

  return (
    <div>
      <h1>Discover</h1>

      {profiles.length === 0 ? (
        <p>No profiles yet.</p>
      ) : (
        <div>
          {profiles.map((profile) => (
            <div key={profile.id}>
              <h2>{profile.display_name}</h2>
              <p><strong>Role:</strong> {profile.role}</p>
              {profile.location && (
                <p><strong>Location:</strong> {profile.location}</p>
              )}
              {profile.skills && (
                <div>
                  <strong>Skills:</strong>
                  <p>{profile.skills}</p>
                </div>
              )}
              {profile.bio && (
                <div>
                  <strong>Bio:</strong>
                  <p>{profile.bio}</p>
                </div>
              )}
              {profile.links && (
                <div>
                  <strong>Links:</strong>
                  <p>{profile.links}</p>
                </div>
              )}
              {matchedProfileId === profile.user_id && (
                <p>It's a match!</p>
              )}
              <div>
                <button
                  onClick={() => handleSwipe(profile.user_id, 'pass')}
                  disabled={swiping === profile.user_id}
                >
                  {swiping === profile.user_id ? 'Processing...' : 'Pass'}
                </button>
                <button
                  onClick={() => handleSwipe(profile.user_id, 'like')}
                  disabled={swiping === profile.user_id}
                >
                  {swiping === profile.user_id ? 'Processing...' : 'Like'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
