# JISHLink Database Setup

## Supabase Setup Steps

1. Create a new Supabase project at https://app.supabase.com
2. Go to **Project Settings → API** and copy:
   - Project URL → `SUPABASE_URL` secret in Replit
   - `anon` public key → `SUPABASE_ANON_KEY` secret in Replit
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` secret in Replit

## Run Schema

1. Go to **Database → SQL Editor → New Query**
2. Paste the contents of `schema.sql` and run it
3. This creates all tables, indexes, RLS policies, and helper functions

## Create Storage Buckets

In **Storage**, create two public buckets:
- `employee-photos`
- `site-qr-codes`

## Create Admin & Recruiter Users

1. Go to **Authentication → Users → Invite user**
2. Create:
   - `admin@jishlink.com` (password: `JISHLink@Admin2024`)
   - `recruiter1@jishlink.com` (password: `JISHLink@Rec2024`)
   - `recruiter2@jishlink.com` (password: `JISHLink@Rec2024`)

3. After users are created, insert their role assignments into the `users` table:
   ```sql
   -- Replace <auth-user-id> with the UUID from Auth > Users
   INSERT INTO users (id, email, role_id) VALUES
     ('<admin-auth-uid>', 'admin@jishlink.com', '00000000-0000-0000-0000-000000000001'),
     ('<recruiter1-auth-uid>', 'recruiter1@jishlink.com', '00000000-0000-0000-0000-000000000002'),
     ('<recruiter2-auth-uid>', 'recruiter2@jishlink.com', '00000000-0000-0000-0000-000000000002');
   ```

## Seed Demo Data

After running schema.sql and adding users, run `seed.sql` to populate:
- 2 clients (Tata Projects, L&T Construction)
- 3 sites with realistic GPS coordinates
- 2 shifts (Day: 08:00–17:00, Night: 20:00–05:00)
- 10 employees (JL1001–JL1010)
- ~30 days of realistic attendance history

## Demo Login Credentials

### HR Admin (web dashboard)
- Email: `admin@jishlink.com`
- Password: `JISHLink@Admin2024`

### Recruiter (web dashboard)
- Email: `recruiter1@jishlink.com`
- Password: `JISHLink@Rec2024`

### Employee (mobile PWA)
- Employee Code: `JL1001`
- Mobile: `+91-9001001001`
- Default password: Set via the admin dashboard after initial login via OTP

## Employee Password Setup

Employees first log in via SMS OTP. After first login, they can set a password via:
1. The mobile PWA profile page
2. The admin assigning a temporary password via the dashboard

## Notes

- The `service_role` key bypasses RLS — it's only used in the Express backend, never in the frontend
- The `anon` key is safe to expose in the frontend — RLS policies control what each role can access
- OTP logs are purged automatically after 24 hours (add a Supabase Edge Function or cron if needed)
