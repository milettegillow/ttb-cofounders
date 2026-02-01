'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function Nav() {
  const pathname = usePathname()

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    }}>
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '0 24px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative'
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
      </div>

      <div
        aria-hidden="true"
        style={{
          height: '3px',
          width: '100%',
          background: 'var(--teal)',
          boxShadow: '0 0 18px rgba(92,225,230,0.75)',
        }}
      />
    </header>
  )
}
