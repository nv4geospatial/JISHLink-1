---
name: Mobile PWA auth
description: How employee auth works in the mobile app; apiFetch URL construction
---

## Employee token storage

`AuthProvider` (lib/auth-context.tsx) stores `jishlink_employee_token` and `jishlink_employee` in `localStorage`. Hydrates on mount for persistence across page reloads.

## apiFetch URL construction

`apiFetch(path)` constructs: `/api-server${path}` — hits the Replit path-based proxy for the API server artifact. Do NOT use `localhost:8080` or `REPLIT_DEV_DOMAIN` in app code.

## Auth routes

- Employee routes: `POST /auth/employee/login|send-otp|verify-otp|forgot-password|reset-password`
- All use custom JWT (Bearer) — NOT Supabase auth
- Admin/recruiter dashboard uses Supabase session tokens (separate auth system)

## PrivateRoute guard

`PrivateRoute` in App.tsx checks `useAuth().token` and redirects to `/login` if missing. Attend page (`/attend/:siteToken`) redirects to `/login?redirect=/attend/<token>` — login page reads `redirect` param and navigates there after auth.

## PWA installability

- `public/manifest.json` — scope `/mobile/`, icons at `/mobile/icons/icon-{192,512}.png`
- `public/sw.js` — caches shell (`/mobile/index.html`); API calls always go to network; static assets cache-first
- `index.html` registers SW on load
