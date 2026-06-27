# QC Vendor Portal

Internal portal for the QuiltComfort vendor: pull orders from a sheet, push batches to ShipStation, auto-invoice when labels print, and track billing.

## Local dev

```bash
npm install
cp .env.example .env.local      # then fill in ShipStation + (optional) Sheets keys
npm run db:migrate              # create qcvp.db
npm run db:seed                 # creates admin@quiltcomfort.com / admin12345
npm run dev                     # http://localhost:3000
```

Default seeded accounts (override via `SEED_*` env vars before running `db:seed`):

| Email | Password | Role |
|---|---|---|
| `admin@quiltcomfort.com` | `admin12345` | admin |
| `vendor@example.com` | `vendor12345` | vendor |

## What this app does

| Route | Who | Purpose |
|---|---|---|
| `/login` | anyone | Email + password sign-in |
| `/queue` | vendor + admin | Queued orders, urgent flagged red, item-level checkboxes, "Pull new orders", "Push to ShipStation" |
| `/merge-report` | vendor + admin | Orders grouped by shared customer email |
| `/batches` | vendor + admin | All batches; click into detail page to refresh status |
| `/batches/[id]` | vendor + admin | Per-batch items + "Refresh status from ShipStation" |
| `/billing` | vendor + admin | Invoices + outstanding totals + "Record payment" |
| `/ledger` | vendor + admin | Running statement: opening balance + invoices − payments |
| `/payments` | **admin only** | Approve vendor-recorded payments + split across invoices |
| `/settings/skus` | **admin only** | SKU price table (base cost + shipping add-on) |
| `/settings/alerts` | **admin only** | Recipient lists for `new_orders` + `new_invoice` emails |
| `/settings/opening-balance` | **admin only** | One-time seed of current vendor balance |

## Stack

- Next.js 15 App Router + TypeScript
- Tailwind v4 + shadcn/ui (base-ui primitives)
- Drizzle ORM + SQLite (`better-sqlite3`) for local dev → swap to Supabase Postgres before deploy
- `iron-session` + `bcryptjs` (will swap to Supabase Auth for prod)
- `xlsx` + `googleapis` for sheet ingest
- `resend` for transactional mail in prod (dev logs to console)

## ShipStation integration

The portal looks up shipments by `external_shipment_id` (= the WooCommerce order number) and applies the `Shipping` tag plus a `Batch-B-YYYY-NNNN` tag. Tracking comes from `/v2/labels` (per the existing CS pipeline).

Env vars (mirror from `O:\SECRETS\claude-secrets\.env.local`):

```
SHIPSTATION_API_KEY=...
SHIPSTATION_BASE=https://api.shipstation.com/v2
SS_TAG_NAME=Shipping
```

## Source CSV format

The 15-column "Filtered" CSV from the existing CS workflow is the canonical input. Header (with UTF-8 BOM tolerated):

```
Order Number, Email (Billing), First Name (Shipping), Last Name (Shipping),
Address 1 (Shipping), Address 2 (Shipping), City (Shipping), State (Shipping),
Zip (Shipping), Country Code (Shipping), Name, Quantity, Cost of Goods,
Order Notes, SKU
```

Multiple rows can share an order number (one row = one line item). `Cost of Goods` is cross-checked against the SKU DB at invoice time — mismatches become invoice warnings; SKU DB price always wins.

## Migrating to production (Vercel + Supabase)

The DB layer is isolated in `db/client.ts` + `db/schema.ts`. To switch:

1. Provision Supabase Postgres project; copy connection string.
2. Change `drizzle.config.ts` dialect to `postgresql` and update `db/client.ts` to use `drizzle-orm/postgres-js`.
3. Run `npm run db:generate` against the new dialect, then push the migration.
4. Swap `iron-session` for Supabase Auth on `/login` + `lib/auth.ts`.
5. Set `RESEND_API_KEY` on Vercel; remove the console fallback in `lib/mailer.ts` if desired.
6. Deploy.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run db:generate` | Generate new Drizzle migration from schema diff |
| `npm run db:migrate` | Apply migrations to `DB_FILE` |
| `npm run db:studio` | Drizzle Studio (web UI for the DB) |
| `npm run db:seed` | Seed admin + vendor accounts + opening balance row |
