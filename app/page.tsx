'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/src/lib/supabaseClient'

export default function Home() {
  const [status, setStatus] = useState<string>('Loading...')

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) {
          setStatus(`Error: ${error.message}`)
        } else {
          const sessionStatus = data.session ? 'present' : 'none'
          setStatus(`Supabase OK. Session: ${sessionStatus}`)
        }
      })
      .catch((error) => {
        setStatus(`Error: ${error.message}`)
      })
  }, [])

  return (
    <div>
      <h1>Supabase Status</h1>
      <p>{status}</p>
    </div>
  )
}
