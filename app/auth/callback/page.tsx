'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/src/lib/supabaseClient'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

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
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as any,
        })

        if (verifyError) {
          router.replace(
            `/?error=auth_error&reason=${encodeURIComponent(verifyError.message)}`
          )
          return
        }

        router.replace('/profile')
        return
      }

      // Neither code nor token_hash/type present
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
