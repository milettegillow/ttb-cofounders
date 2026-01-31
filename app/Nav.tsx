'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/src/lib/supabaseClient'

export default function Nav() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  // Only show nav when signed in
  if (loading || !session) {
    return null
  }

  return (
    <div>
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 20px 12px',
        marginBottom: '20px',
      }}>
        {/* Left: Brand */}
        <div style={{ 
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontSize: '28px',
          letterSpacing: '-0.06em',
          color: 'var(--pink)',
        }}>
          the tech bros
        </div>

        {/* Center: Nav links */}
        <div style={{
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
        }}>
          <Link 
            href="/discover" 
            style={{
              color: 'var(--ink)',
              fontWeight: pathname === '/discover' ? 'bold' : 'normal',
              textDecoration: pathname === '/discover' ? 'underline' : 'none',
              textDecorationColor: pathname === '/discover' ? 'var(--pink)' : 'transparent',
              textUnderlineOffset: '4px',
              fontSize: '16px',
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Discover
          </Link>
          <Link 
            href="/matches" 
            style={{
              color: 'var(--ink)',
              fontWeight: pathname === '/matches' ? 'bold' : 'normal',
              textDecoration: pathname === '/matches' ? 'underline' : 'none',
              textDecorationColor: pathname === '/matches' ? 'var(--pink)' : 'transparent',
              textUnderlineOffset: '4px',
              fontSize: '16px',
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Matches
          </Link>
          <Link 
            href="/profile" 
            style={{
              color: 'var(--ink)',
              fontWeight: pathname === '/profile' ? 'bold' : 'normal',
              textDecoration: pathname === '/profile' ? 'underline' : 'none',
              textDecorationColor: pathname === '/profile' ? 'var(--pink)' : 'transparent',
              textUnderlineOffset: '4px',
              fontSize: '16px',
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Profile
          </Link>
        </div>

        {/* Right: Sign out */}
        <button 
          onClick={handleSignOut} 
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer',
            color: 'var(--ink)',
            fontSize: '14px',
            textDecoration: 'none',
            transition: 'opacity 0.2s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          Sign out
        </button>
      </nav>
      
      {/* Neon line */}
      <div style={{
        height: '1px',
        background: 'linear-gradient(90deg, var(--pink) 0%, var(--teal) 100%)',
        boxShadow: '0 0 8px rgba(239, 31, 159, 0.5), 0 0 8px rgba(92, 225, 230, 0.5)',
        width: '100%',
        marginBottom: '20px',
      }} />
    </div>
  )
}
