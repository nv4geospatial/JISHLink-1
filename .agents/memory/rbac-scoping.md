---
name: RBAC & recruiter scoping
description: How role enforcement and recruiter site-scoping work in the backend
---

## requireRole()

In `lib/rbac.ts`. Validates the Supabase Bearer JWT, looks up `users.role_id → roles.name`, and only allows the request if `roleName` is in `allowedRoles[]`. Returns `{ userId, roleName }` on success or sends 401/403.

Cast pattern for TS: `const roleRow = userRow as unknown as { roles?: { name: string } }` — direct cast fails due to Supabase inferred type overlap.

## getRecruiterSiteIds(userId)

Returns `string[]` of `sites.id` where `assigned_recruiter_id = userId`. Called after `requireRole` in reports.ts and dashboard.ts when `authed.roleName === "recruiter"`.

## Recruiter scope applied to

- `GET /dashboard/stats` — employee, attendance, site queries all `.in("site_id", siteIds)` or `.in("id", siteIds)`; client count derived from their sites' client_ids
- `GET /dashboard/attendance-trend` — `.in("site_id", siteIds)`; validates siteId param is within their allowed list
- `GET /dashboard/recent-checkins` — `.in("site_id", siteIds)`
- `GET /reports/daily`, `/reports/monthly`, export routes — `fetchAttendanceRecords` accepts `siteIds?: string[]` param; intersection logic if caller also specifies `siteId`

**Why:** RLS policies enforce this at DB level too, but backend enforcement is defense-in-depth and avoids leaking data through service-role client.

## QR generation

`POST /qr/generate/:siteId` uses `requireRole(req, res, ["admin"])` — explicitly admin-only. Not `["admin", "recruiter"]` — that would wrongly allow recruiters to generate QR codes.
