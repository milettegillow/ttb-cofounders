# Admin Setup Guide

## Setting Your Profile to Admin

To set your own profile (or any user's profile) to admin, run this SQL query in your Supabase SQL Editor:

```sql
-- Replace 'your-user-id-here' with your actual user_id from auth.users
UPDATE public.profiles
SET is_admin = true
WHERE user_id = 'your-user-id-here';
```

### Finding Your User ID

1. Go to your Supabase Dashboard
2. Navigate to Authentication > Users
3. Find your user account
4. Copy the User UID
5. Use that UUID in the UPDATE query above

### Alternative: Set by Email

If you know the email address, you can use:

```sql
UPDATE public.profiles p
SET is_admin = true
FROM auth.users u
WHERE p.user_id = u.id
  AND u.email = 'your-email@example.com';
```

## Verifying Admin Status

After setting `is_admin = true`, you can verify it worked:

```sql
SELECT user_id, display_name, email, is_admin
FROM public.profiles
WHERE is_admin = true;
```

## Security Note

Only users with `is_admin = true` in their profile can access:
- `/admin/*` pages
- `/api/admin/*` endpoints

All checks are performed server-side for security.
