'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV_LINKS = [
  { href: '/discover', label: 'Discover' },
  { href: '/matches', label: 'Matches' },
  { href: '/profile', label: 'Profile' },
] as const

export default function Nav() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

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
      }}>
        {/* Left: Brand */}
        <div style={{
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontSize: '28px',
          letterSpacing: '-0.06em',
          color: 'var(--pink)',
          flexShrink: 0,
        }}>
          the tech bros
        </div>

        {/* Desktop nav links */}
        <nav className="nav-desktop" style={{
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
        }}>
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                color: 'var(--ink)',
                fontWeight: pathname === href ? 'bold' : 'normal',
                textDecoration: pathname === href ? 'underline' : 'none',
                textDecorationColor: pathname === href ? 'var(--pink)' : 'transparent',
                textUnderlineOffset: '4px',
                fontSize: '16px',
                transition: 'opacity 0.2s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <div className="nav-mobile" ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
            }}
          >
            <span style={{
              display: 'block',
              width: '24px',
              height: '2px',
              background: 'var(--ink)',
              borderRadius: '1px',
              transition: 'transform 0.2s ease, opacity 0.2s ease',
              transform: menuOpen ? 'translateY(7px) rotate(45deg)' : 'none',
            }} />
            <span style={{
              display: 'block',
              width: '24px',
              height: '2px',
              background: 'var(--ink)',
              borderRadius: '1px',
              transition: 'opacity 0.2s ease',
              opacity: menuOpen ? 0 : 1,
            }} />
            <span style={{
              display: 'block',
              width: '24px',
              height: '2px',
              background: 'var(--ink)',
              borderRadius: '1px',
              transition: 'transform 0.2s ease, opacity 0.2s ease',
              transform: menuOpen ? 'translateY(-7px) rotate(-45deg)' : 'none',
            }} />
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <nav style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '8px 0',
              minWidth: '160px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display: 'block',
                    padding: '12px 20px',
                    color: pathname === href ? 'var(--pink)' : 'var(--ink)',
                    fontWeight: pathname === href ? 'bold' : 'normal',
                    fontSize: '16px',
                    textDecoration: 'none',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {label}
                </Link>
              ))}
            </nav>
          )}
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
