import { Suspense } from 'react'
import ApplyClient from './ApplyClient'

export default function Apply() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ApplyClient />
    </Suspense>
  )
}
