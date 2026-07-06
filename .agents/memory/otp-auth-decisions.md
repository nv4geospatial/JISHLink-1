---
name: OTP & Auth decisions
description: Why we use otp_logs for OTP (not supabase.auth), and how employee JWT works
---

## OTP — otp_logs is the single source of truth

`supabase.auth.signInWithOtp` was removed from all routes. It sends a **different** OTP than the one we bcrypt-hash in `otp_logs`, causing an unresolvable verification mismatch.

The correct flow:
1. `generateOtp()` → plain OTP
2. `hashOtp(otp)` → store in `otp_logs` (bcrypt, 10 rounds)
3. SMS delivery: in dev, return `otp_for_dev` in response; in production wire Twilio/MSG91
4. `verifyOtp(submitted, otp_logs.otp_hash)` → bcrypt.compare

**Why:** supabase.auth OTP and our otp_logs OTP are independent values — comparing them always fails.

## Employee JWT

- Signed with `SESSION_SECRET` (HS256, `jsonwebtoken`, 7-day expiry)
- `auth.ts` **throws on startup** if `SESSION_SECRET` is missing — no silent fallback
- Contains: `{ employee_id, employee_code, site_id }`
- Verified by `verifyEmployeeToken()` — used in attendance.ts and the new attendance/employee/:id route
- Admin/recruiter routes use Supabase JWTs verified via `supabase.auth.getUser()`; employee routes use this custom JWT — they are separate auth systems
