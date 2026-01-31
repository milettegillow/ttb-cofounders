import { Suspense } from 'react'
import ApplyClient from './apply/ApplyClient'

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ApplyClient />
    </Suspense>
  )
}
