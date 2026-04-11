'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/src/lib/supabaseClient'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleCallback = async () => {
      // DEBUG: Log everything arriving at the callback
      const allParams: Record<string, string> = {}
      searchParams.forEach((value, key) => { allParams[key] = value })
      console.log('[auth/callback] URL:', window.location.href)
      console.log('[auth/callback] Query params:', allParams)
      console.log('[auth/callback] Hash fragment:', window.location.hash)

      const code = searchParams.get('code')
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      console.log('[auth/callback] Parsed:', { code, tokenHash, type, error })

      // Handle error from URL params
      if (error) {
        router.replace(
          `/?error=auth_error&reason=${encodeURIComponent(errorDescription || error)}`
        )
        return
      }

      // Handle PKCE flow (code parameter)
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError) {
          router.replace(
            `/?error=auth_error&reason=${encodeURIComponent(exchangeError.message)}`
          )
          return
        }

        router.replace('/profile')
        return
      }

      // Handle email OTP flow (token_hash and type parameters)
      if (tokenHash && type) {
        console.log('[auth/callback] Calling verifyOtp with:', { token_hash: tokenHash, type })
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as any,
        })

        console.log('[auth/callback] verifyOtp result:', { data: verifyData, error: verifyError })

        if (verifyError) {
          console.error('[auth/callback] verifyOtp error:', verifyError.message)
          router.replace(
            `/?error=auth_error&reason=${encodeURIComponent(verifyError.message)}`
          )
          return
        }

        router.replace('/profile')
        return
      }

      // Neither code nor token_hash/type present
      console.log('[auth/callback] No code or token_hash — redirecting to homepage')
      router.replace('/?error=auth_error&reason=missing_params')
    }

    handleCallback()
  }, [searchParams, router])

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '50vh',
      color: 'var(--ink)',
    }}>
      <p>Signing you in...</p>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '50vh',
        color: 'var(--ink)',
      }}>
        <p>Loading...</p>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}
