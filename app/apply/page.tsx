import { Suspense } from 'react'
import ApplyClient from './ApplyClient'

export default function Apply() {
  return (
    <div>
      <h1>Apply</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <ApplyClient />
      </Suspense>
    </div>
  )
}
