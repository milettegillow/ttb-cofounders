This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environment Variables

### Required
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (server-side only)

### Optional
- `NEXT_PUBLIC_SITE_URL` - The canonical origin URL for magic-link redirects
  - **Local dev** (`.env.local`): `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
  - **Production** (Vercel): `NEXT_PUBLIC_SITE_URL=https://cofounders.thetechbros.io`
  - **Preview** (Vercel): `NEXT_PUBLIC_SITE_URL=https://$VERCEL_URL` or set manually
  - If not set, defaults to `window.location.origin` (works for local dev)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Database Schema Notes

### Canonical Fields
- **LinkedIn URL**: Use `linkedin_url` as the canonical field for both `profiles` and `pre_applications` tables.
  - The `linkedin` column in `pre_applications` is maintained for backward compatibility during migration.
  - When reading LinkedIn data, prefer `linkedin_url ?? linkedin ?? ''` for fallback support.
  - When writing LinkedIn data, write to both `linkedin` (legacy) and `linkedin_url` (canonical) for compatibility.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
