# TTB Cofounders — Project Context

## What this is
A cofounder matching platform for "The Tech Bros" community. Users apply, get screened by admins, build profiles, then discover and swipe on potential cofounders. Mutual likes create matches and exchange contact info. Think Tinder for finding a cofounder.

## Current situation (April 2026)
The project was built but went dormant before getting real traction. I'm bringing it back online for beta users to test. Two things need fixing:

1. **Supabase is paused** — The hosted Supabase project (`jogauozpusuvnopucqoc.supabase.co`) was paused due to inactivity. It needs to be reactivated in the Supabase dashboard before anything works (database, auth, storage all depend on it).

2. **Email confirmation was broken** — The early registration steps weren't working. The sign-in uses magic links via Supabase Auth, and the approval flow sends emails via Resend. Something in this chain was failing.

## Tech stack
- **Framework:** Next.js 16 (App Router, React 19, TypeScript, Tailwind CSS 4)
- **Database & Auth:** Supabase (PostgreSQL + Auth with magic link OTP)
- **Email:** Resend (sends approval emails from `no-reply@thetechbros.io`)
- **SMS:** Twilio Verify (WhatsApp number verification)
- **Hosting:** Vercel
- **Production URL:** `https://cofounders.thetechbros.io`

## Database tables
- `pre_applications` — application queue (email, linkedin_url, stem_background, status: pending/approved/rejected)
- `profiles` — approved user profiles (linked to auth.users, has `is_complete` and `is_live` flags that gate visibility)
- `profile_photos` — photo metadata, stored in Supabase Storage
- `swipes` — like/pass actions (from_user_id, to_user_id, direction)
- `matches` — created automatically on mutual likes (user_a, user_b)
- `reports` — user reporting

## User lifecycle (the full flow)

### 1. Apply (`/apply`)
User submits email, LinkedIn URL, and STEM background. Saved to `pre_applications` with status `pending`. Returning users can sign in via a "Sign In" tab on the same page.

### 2. Admin reviews (`/admin/applications`)
Admin sees pending applications and approves or rejects them. Approval triggers a chain of actions in `PATCH /api/admin/applications`:
- Creates a Supabase auth user via `inviteUserByEmail()`
- Upserts a `profiles` row (is_complete: false, is_live: false)
- Generates a magic link via `supabaseAdmin.auth.admin.generateLink()`
- Sends an approval email via Resend with the magic link
- Updates `pre_applications.status` to `approved`

### 3. User clicks magic link → `/auth/callback`
The callback page handles both PKCE (code param) and email OTP (token_hash + type params). It calls `verifyOtp()` or `exchangeCodeForSession()`, then redirects to `/profile`.

### 4. Profile completion (`/profile`)
User fills out display name, expertise, availability, photo, etc. Profile marked `is_complete` when all required fields are filled. User toggles `is_live` to appear in discovery.

### 5. Discover & match (`/discover`, `/matches`)
Shows profiles where `is_complete=true` AND `is_live=true`. Swipes hit `POST /api/swipe`. Mutual likes auto-create matches. Matches visible at `/matches` with contact info.

## Key files
- `app/apply/ApplyClient.tsx` — registration/sign-in form (~750 lines)
- `app/auth/callback/page.tsx` — auth callback handler
- `app/api/admin/applications/route.ts` — approval flow with email sending
- `app/api/swipe/route.ts` — swipe/match logic
- `app/(app)/discover/page.tsx` — swipe UI
- `app/(app)/profile/page.tsx` — profile editor
- `app/admin/applications/page.tsx` — admin approval dashboard
- `src/lib/supabaseClient.ts` — browser Supabase client
- `src/lib/supabaseAdmin.ts` — admin Supabase client (service role)
- `lib/supabase/server.ts` — server Supabase client (SSR)
- `lib/profile/isComplete.ts` — profile completion validation
- `middleware.ts` — protects admin routes

## Environment variables
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public anon key
- `SUPABASE_SERVICE_ROLE_KEY` — server-side service role key
- `RESEND_API_KEY` — for sending emails
- `NEXT_PUBLIC_SITE_URL` — must match deployment URL (used for magic link redirects)
- Twilio credentials for SMS verification

## Admin access
Controlled by `profiles.is_admin = true`. Set via SQL: `UPDATE profiles SET is_admin = true WHERE user_id = '...'`

## Likely failure points for the email/auth issue
- `NEXT_PUBLIC_SITE_URL` not matching the actual deployment URL (magic link redirects to wrong place)
- Supabase email/SMTP settings not configured or expired
- Resend API key expired or domain verification lapsed
- The admin-generated magic link URL being constructed incorrectly
- Auth callback not handling OTP params correctly
