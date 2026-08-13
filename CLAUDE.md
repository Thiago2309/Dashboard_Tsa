
## Project overview

Sistema TSA Dashboard — a Next.js 15 (App Router) + TypeScript business application for a trucking/logistics company, built on the PrimeReact "Sakai" admin template. Supabase (Postgres) is the backend for all data, and Supabase's client SDK is called directly from the browser (no custom REST/GraphQL API layer, aside from one file upload route).

## Environment

Supabase credentials live in `.env.local` (not committed):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The single Supabase client is created in [Services/superbase.service.tsx](Services/superbase.service.tsx) and imported everywhere as `supabase`.

## Architecture

### Route groups
- `app/(main)/` — the authenticated app shell (sidebar/topbar), wrapped by [layout/layout.tsx](layout/layout.tsx). Contains all real business pages under `pages/crud/*`, `inventario/`, `utilities/`, plus the original Sakai `uikit/` demo/reference pages.
- `app/(full-page)/` — chrome-less pages: `auth/login`, `auth/access`, `auth/error`, and `landing`.
- `app/api/upload.ts` — the only server API route (file upload); everything else talks to Supabase directly from client components.

### Data access: `Services/BD/*`
Business data access is organized one file per domain, all importing the shared `supabase` client, e.g.:
- `Services/BD/logistica/logisticaService.ts`, `viajeService.ts` — viajes (trips), logistics assignment/status workflow
- `Services/BD/Nomina/*` — payroll (nóminas, bonos, descuentos, préstamos)
- `Services/BD/estimacionesService.ts` — client trip estimates/billing exports (Excel)
- `Services/BD/cuentasPorCobrarService.ts`, `CxPService.ts` — accounts receivable/payable
- `Services/BD/inventario/camion/camionService.ts` — truck/fleet inventory
- `Services/BD/facturacion/fiscalApiService.ts` — invoicing
- `Services/BD/userService.ts` — auth (custom login/register against Supabase `user` table) + role assignment via a `userroles` table (`roleid` cached in `localStorage`, read with `getUserRoleIdFromLocalStorage`)
- Others: `combustibleService.ts` (fuel), `cajaChicaService.ts` (petty cash), `Vacaciones/vacacionesService.ts`, `gastoService.ts`, `materialService.ts`, `origenDestinoService.ts`, `provedoresService.ts`, `operadoresService.ts`, `clientesService.ts`, `invitadosService.ts`

Each service typically exports a TS interface for its entity plus a `transform*Data` mapper that normalizes a Supabase row (which often comes from a `fetch_*` view joining related tables) into that interface — follow this pattern (interface + fetch/create/update/delete functions + row-transform helper) when adding new services rather than querying Supabase ad hoc from components.

Auth is **not** Supabase Auth's session system — it's a custom flow against the app's own `user`/`userroles` tables, with the logged-in user's id/role persisted client-side (see `userService.ts` and `login/page.tsx`). There is no `middleware.ts`; route protection, if any, happens client-side.

### UI pages (`app/(main)/pages/crud/*`)
Each business module is a folder of `'use client'` React components combining PrimeReact `DataTable`/`Dialog`/`Toolbar` CRUD patterns with a matching `Services/BD/*` service:
- `Logistica/` — trip assignment/tracking, split into admin (`LogisticaAdmin.tsx`), operator table (`LogisticaEmpleadoTabla.tsx`), and general table/crud views
- `Nomina/` — payroll CRUD + a printable payslip (`recibo/ReciboNominaPrint.tsx`, uses `react-to-print`)
- `Estimaciones/` — client trip estimation/reporting with Excel export (`exceljs`/`xlsx`)

### Layout (Sakai template)
`layout/` holds the template chrome — `AppMenu.tsx` (nav tree), `AppSidebar.tsx`, `AppTopbar.tsx`, `AppFooter.tsx`, `AppConfig.tsx` (theme/scale settings), and `context/layoutcontext.tsx` + `context/menucontext.tsx` for layout/menu state via React context. When adding a new business page, register it in `AppMenu.tsx` so it's reachable from the sidebar.

### `demo/` directory
This is the original Sakai template's demo content (sample components/services). It's reference/scaffolding, not part of the live business app — don't wire real data into it, and don't assume code there reflects current patterns (prefer `Services/BD/*` as the model to follow).

### Path alias
`@/*` maps to the repo root (see `tsconfig.json`), but most existing code uses relative imports (e.g. `../../../../Services/BD/...`) — match the style of the file you're editing.

### Conventions in this codebase
- Spanish is the working language throughout: entity/field names (`viaje`, `folio`, `operador`, `cliente`, `nomina`), UI copy, and commit messages are all in Spanish — keep new code consistent with this.
- Components are client components (`'use client'`) using local `useState`/`useEffect` for data fetching from Supabase; there's no global state library or data-fetching cache (no Redux/Zustand/React Query).
