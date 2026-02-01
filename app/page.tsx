import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import ApplyClient from './apply/ApplyClient'

export const dynamic = 'force-dynamic'

export default async function Home() {
  // Check if user is signed in - redirect to profile if so
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  // If user exists (no error and user is truthy), redirect immediately
  if (!error && user) {
    redirect('/profile')
  }

  // If no user, render the signed-out Apply/Sign-in UI
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ApplyClient />
    </Suspense>
  )
}
