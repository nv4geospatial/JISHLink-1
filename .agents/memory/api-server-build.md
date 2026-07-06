---
name: API server build quirks
description: esbuild externals, Supabase-only data layer, key decisions
---

## pdfkit / exceljs externalized

In `artifacts/api-server/build.mjs`, `pdfkit`, `fontkit`, `exceljs`, and related packages are in the `external` array. They use CJS internals (`@swc/helpers` path resolution) that esbuild cannot bundle. They are installed as runtime deps and `node_modules` is present in the dist environment.

## Supabase-only, no Drizzle

`lib/db` exists in the workspace but is **not imported** by any API server route. All DB access uses the Supabase service-role client from `lib/supabase.ts`. Do not add Drizzle/Postgres direct queries unless the user explicitly asks.

## Service-role client usage

The Supabase service-role client bypasses RLS. RBAC enforcement (`requireRole`, `getRecruiterSiteIds`) is done **before** any service-role query runs. The service-role client is used because admin routes need cross-user data access.
