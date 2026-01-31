import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import ApplyClient from './apply/ApplyClient'

export default async function Home() {
  // Check if user is signed in - redirect to profile if so
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (session) {
    redirect('/profile')
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ApplyClient />
    </Suspense>
  )
}
