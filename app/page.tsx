import Link from 'next/link'

export default function Home() {
  return (
    <div>
      <h1>TTB Cofounder Matching</h1>
      <p>A lightweight, curated way to meet potential cofounders.</p>

      <ol>
        <li>Apply (3 questions)</li>
        <li>Get approved</li>
        <li>Match and chat</li>
      </ol>

      <div>
        <Link href="/apply">
          <button>Get Started</button>
        </Link>
      </div>
    </div>
  )
}
