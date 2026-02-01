# WhatsApp Verification API

This API implements Twilio Verify SMS OTP for phone number verification.

## Setup

1. Install dependencies:
   ```bash
   npm install twilio
   ```

2. Set environment variables (local `.env.local` and Vercel):
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_VERIFY_SERVICE_SID=VA4ffec6d5d3de569dcfe273dd72cbd4ef
   ```

3. Run the migration:
   ```sql
   -- Run migrations/add_twilio_verify_columns.sql in Supabase SQL Editor
   ```

## Endpoints

### POST /api/whatsapp/start

Starts SMS OTP verification for a phone number.

**Request:**
```json
{
  "e164": "+44 7700 900123"
}
```

**Response (200):**
```json
{
  "ok": true
}
```

**Errors:**
- `401`: Unauthorized
- `400`: Invalid phone number format
- `429`: Cooldown (too soon after last request, wait 30 seconds)
- `500`: Twilio error or server error

### POST /api/whatsapp/check

Verifies an SMS OTP code.

**Request:**
```json
{
  "code": "123456"
}
```

**Response (200) - Approved:**
```json
{
  "ok": true,
  "status": "approved"
}
```

**Response (200) - Pending/Expired:**
```json
{
  "ok": false,
  "status": "pending",
  "message": "Code verification is still pending"
}
```

**Errors:**
- `401`: Unauthorized
- `400`: No phone number on profile or invalid/expired code
- `429`: Maximum verification attempts reached
- `500`: Twilio error or server error

## Testing with curl

### 1. Start verification (send OTP)

```bash
curl -X POST http://localhost:3000/api/whatsapp/start \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project>-auth-token=<your-auth-token>" \
  -d '{"e164":"+44 7700 900123"}'
```

**Note:** Replace `<project>` with your Supabase project ID and `<your-auth-token>` with a valid session token. You can get the auth token from your browser's cookies after logging in.

### 2. Verify code (check OTP)

```bash
curl -X POST http://localhost:3000/api/whatsapp/check \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project>-auth-token=<your-auth-token>" \
  -d '{"code":"123456"}'
```

Replace `123456` with the actual OTP code received via SMS.

## Flow

1. User enters phone number in profile page
2. User clicks "Verify WhatsApp" → calls `/api/whatsapp/start`
3. Server normalizes number, persists to `profiles.whatsapp_e164`, sends SMS via Twilio
4. User receives SMS with 6-digit code
5. User enters code → calls `/api/whatsapp/check`
6. Server verifies code with Twilio, updates `profiles.whatsapp_verified = true` if approved

## Database Schema

The following columns are used in `profiles` table:
- `whatsapp_e164` (text): Normalized phone number in E.164 format
- `whatsapp_verified` (boolean): Verification status
- `whatsapp_verified_at` (timestamptz): When verification was completed
- `whatsapp_verify_sent_at` (timestamptz): Last time OTP was sent (for cooldown)

## Cooldown

To prevent abuse, there's a 30-second cooldown between verification requests. If a user requests a code within 30 seconds of the previous request, they'll receive a 429 error with a message indicating how long to wait.
