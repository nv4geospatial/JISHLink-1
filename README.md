# JISHLink Workforce & Manpower Management System

**JISHLink Consulting India Private Limited** — Full-stack attendance and workforce management platform.

---

## What the App Does

JISHLink manages employee check-in/check-out at client sites using QR codes and GPS geofencing. It has three surfaces:

- **Web Dashboard** — HR Admin & Recruiter: manage employees, sites, clients, generate QR codes, view real-time attendance and reports.
- **Employee Mobile PWA** — Employees scan the site QR code on their phone, the app gets GPS, and records attendance in real time. Installable as a PWA on Android/iOS.
- **REST API** — Express.js backend powering both surfaces; Supabase for the database, auth, and file storage.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web Dashboard | React 18, Vite, Tailwind CSS, Shadcn/ui |
| Mobile PWA | React 18, Vite, Tailwind CSS, Shadcn/ui, jsQR |
| API Server | Express.js, pnpm workspace, TypeScript, pino |
| Database | Supabase (PostgreSQL + RLS) |
| Auth (Admin/Recruiter) | Supabase Auth (email/password) |
| Auth (Employee) | Custom JWT (`SESSION_SECRET`) |
| File Storage | Supabase Storage (`site-qr-codes` bucket) |
| Reports | ExcelJS (xlsx) + PDFKit (pdf) |
| QR Generation | `qrcode` npm package |
| QR Scanning | `jsQR` (camera-based, mobile browser) |

---

## Supabase Setup (required before running)

### 1. Add Secrets in Replit

In your Replit project, go to **Secrets** and add:

| Secret Key | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase project → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase project → Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API → service_role secret key |
| `SESSION_SECRET` | Any random 32+ character string — used to sign employee JWTs |

### 2. Apply the Database Schema

In your Supabase project, go to **SQL Editor → New Query** and paste the full contents of [`database/schema.sql`](database/schema.sql). Run it.

### 3. Seed Demo Data (optional)

Run [`database/seed.sql`](database/seed.sql) in the SQL Editor to create:
- 2 clients, 3 sites, 2 shifts
- 10 employees (JL1001–JL1010) with ~30 days of historical attendance

### 4. Create Storage Bucket

In Supabase → Storage → New Bucket: create a **public** bucket named `site-qr-codes`.

### 5. Create Admin & Recruiter Users

In Supabase → Authentication → Add User, create:
- An admin user (email/password) — then in SQL Editor run:
  ```sql
  INSERT INTO users (id, email, role_id)
  VALUES ('<auth-user-uuid>', 'admin@jishlink.com',
    (SELECT id FROM roles WHERE name = 'admin'));
  ```
- A recruiter user similarly with role `'recruiter'`

---

## Running the App

All three services start automatically with the Replit **Run** button.

| Service | URL |
|---|---|
| Dashboard | `https://<your-repl>.replit.app/` |
| API Server | `https://<your-repl>.replit.app/api-server/` |
| Employee Mobile PWA | `https://<your-repl>.replit.app/mobile/` |

---

## Demo Login Credentials (after running seed.sql)

### Dashboard (Admin)
- URL: `/` (dashboard)
- Email: `admin@jishlink.com`
- Password: set when you created the Supabase user

### Dashboard (Recruiter)
- Email: `recruiter@jishlink.com`
- Password: set when you created the Supabase user
- **Scoped access**: only sees data for sites where `assigned_recruiter_id = their user id`

### Employee Mobile (Password login)
- URL: `/mobile/`
- Employee ID: `JL1001` through `JL1010`
- Password: `password123` (as set in seed.sql — change in production)

### Employee Mobile (OTP login)
- Employee ID: any seeded employee code
- Click **OTP** tab → Send OTP
- In development (`NODE_ENV !== production`), the OTP is returned in the API response as `otp_for_dev`
- In production: wire up an SMS gateway (Twilio, MSG91, etc.) in `routes/auth.ts`

---

## Installing the PWA on a Real Phone

### Android (Chrome)
1. Open `https://<your-repl>.replit.app/mobile/` in Chrome
2. Tap the **⋮** menu → **Add to Home screen**
3. The app installs and appears as a native icon

### iOS (Safari)
1. Open `https://<your-repl>.replit.app/mobile/` in Safari (must be Safari, not Chrome)
2. Tap the **Share** icon → **Add to Home Screen**
3. The app installs and runs in standalone mode without the browser chrome

---

## Full QR Scan → Check-In → Dashboard Flow

```
Admin generates QR code (Dashboard → Sites → Generate QR)
  ↓ QR encodes: https://<domain>/mobile/attend/<site_token>
  
Employee scans QR with phone camera
  ↓ Browser opens /mobile/attend/<site_token>
  
If not logged in → redirected to /mobile/login?redirect=/attend/<token>
Employee logs in (password or OTP)
  ↓ Gets employee JWT

App requests GPS permission
GPS coords sent to POST /attendance/scan with:
  - site_token (from URL)
  - latitude, longitude (from device GPS)
  - device_id (stored in localStorage)
  
API server validates:
  1. Employee JWT → gets employee_id
  2. site_token → finds site + geofence params
  3. employee.site_id === site.id (assignment check)
  4. Haversine distance ≤ geofence_radius_meters
  5. Server time within ±2h of shift window
  6. Existing record today? → check_in or check_out
  
Response → "Checked In! ✅" or "Checked Out! 👋" with status

Dashboard auto-refreshes: admin sees new entry in Recent Check-ins
Reports available immediately in /reports/daily
```

---

## SMS OTP & Password Reset via SMS

Both flows use the same OTP pipeline:

1. `POST /auth/employee/send-otp` or `POST /auth/employee/forgot-password` → generates a 6-digit OTP, bcrypt-hashes it, stores in `otp_logs` table with 10-minute expiry
2. **In development**: `otp_for_dev` field in the response contains the plain OTP
3. **In production**: remove that field and deliver via your SMS gateway:
   ```typescript
   // In routes/auth.ts — replace the req.log.info call:
   await twilioClient.messages.create({
     to: employee.mobile,
     from: process.env.TWILIO_FROM_NUMBER,
     body: `Your JISHLink OTP is: ${otp}`,
   });
   ```
4. `POST /auth/employee/verify-otp` / `POST /auth/employee/reset-password` → bcrypt-compares the submitted code against the stored hash

---

## Testing the API with the .http Collection

Open `artifacts/api-server/api-endpoints.http` in VS Code with the **REST Client** extension:

1. Set `@adminToken` to a Supabase JWT for your admin user (get from Supabase Auth → Users → copy access token, or from the dashboard login flow)
2. Set `@employeeToken` to the JWT returned by `POST /auth/employee/login`
3. Run requests with **Send Request** (click the link above each block)

---

## Database Schema & RLS Summary

| Table | Purpose | RLS |
|---|---|---|
| `roles` | admin / recruiter / employee | readable by all authed |
| `users` | admin & recruiter Supabase users, role link | admin: all; self: own row |
| `clients` | client companies | admin: all; recruiter: their sites' clients |
| `sites` | work sites with geofence + QR token | admin: all; recruiter: assigned sites |
| `employees` | employee profiles, mobile, password_hash | admin: all; recruiter: their sites' employees |
| `shift_master` | shift schedules | admin: all; authenticated: read |
| `attendance` | check-in/out records | admin: all; recruiter: their sites; employee: own |
| `otp_logs` | bcrypt-hashed OTPs with expiry | service-role only (no client access) |
| `qr_codes` | QR code audit trail | admin: all; recruiter: their sites |
| `app_settings` | system-wide config | admin: all |

**Key RLS helpers (Postgres functions):**
- `get_user_role()` — returns `'admin'` / `'recruiter'` / `'employee'` for the current session
- `get_recruiter_site_ids()` — returns array of site UUIDs assigned to the current recruiter

---

## Recruiter Access Scoping

Recruiters are assigned to sites via `sites.assigned_recruiter_id`. The backend enforces this in every query:

- `GET /dashboard/stats` — employee counts, attendance counts, site counts all filtered to their sites
- `GET /dashboard/attendance-trend` — only their sites' data
- `GET /dashboard/recent-checkins` — only their sites' check-ins
- `GET /reports/daily` / `/reports/monthly` — only their sites' attendance
- `GET /reports/export/excel` / `/reports/export/pdf` — same scope

---

## Troubleshooting

### Camera / Geolocation Permission Denied
- Chrome Android: tap the lock icon in the address bar → Allow Camera and Location
- Safari iOS: Settings → Safari → Camera/Location → Allow
- Must be **HTTPS** (not HTTP) — Replit dev URL is always HTTPS ✓

### SMS OTP Not Arriving
- In development, `otp_for_dev` in the API response gives you the OTP directly
- In production, set up an SMS gateway and wire it into `routes/auth.ts` (see above)

### QR Not Scanning
- Ensure good lighting and hold camera steady
- The QR code must be a JISHLink QR (encoded URL contains `/attend/<token>`)
- Try the camera at ~20–30cm distance from the code

### Missing Supabase Secrets
- Check Replit Secrets for `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`
- The API server **throws on startup** if any secret is missing (check workflow logs)

### "Employee not assigned to this site"
- The employee's `site_id` in the `employees` table must match the scanned site's `id`
- Update via Supabase → Table Editor → employees → set `site_id`

### "Outside attendance window"
- The API uses **server time** (UTC). Shift windows allow ±2h from shift start/end.
- Check `shift_master.start_time` and `end_time` for the employee's shift

### Dashboard Shows No Data
- Confirm schema.sql was applied and seed.sql was run
- Check that your Supabase user has the correct role in the `users` table
- Check workflow logs: `artifacts/api-server: API Server`

### Recruiter Sees No Data
- Set `sites.assigned_recruiter_id` to the recruiter's Supabase Auth `user.id`
