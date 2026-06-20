# Build Prompt — Orenew Marketing + Store + License-Management Website

> **How to use this file:** This is a self-contained build prompt. Paste it into a fresh Claude Code session whose workspace also contains the existing **orenew** desktop repo (for brand assets + screenshots + the backend contract). Build the website in a **new, separate repository**. Use the `/claude-design` skill for the visual design work, and `/llm-council` only if you hit a genuinely high-stakes fork. Everything you need is below; do not assume facts not stated here — verify against the orenew repo.

---

## Overview

- **Goal:** Build the public website for **Orenew** — a Tauri desktop app that lets event photographers batch-apply decorative frames to photos for print/magnet production. The site does three jobs: **advertise**, **sell subscriptions**, and **manage licenses/subscriptions**.
- **Separate repo, shared backend.** New standalone **Next.js (App Router)** project, deployed on **Vercel**. It talks to the **same Supabase project** as the desktop app — it does not fork the data model, it extends it.
- **Tier is owned by the existing backend.** The desktop app already treats tier as a server-signed, device-bound entitlement. The website's job on the commerce side is to drive **Lemon Squeezy** checkout and let its webhook write the paid tier into the existing `entitlements` table. The desktop refresh loop then picks it up. The website must never invent a second source of truth for tier.
- **Payments via Lemon Squeezy (merchant-of-record)** so global tax/VAT is handled for us. Subscription management is **hybrid**: a custom plan-pick/upgrade page on our site, then hand off to Lemon Squeezy's hosted customer portal for card updates, invoices, and cancellation.
- **Two audiences in scope:** customer self-serve portal (buy, upgrade, manage subscription, manage device seats) **and** a vendor admin dashboard (view customers, tiers, subscriptions).
- **Design:** premium but conversion-focused — clean product-led SaaS blended with premium photography/editorial feel; screenshot- and video-forward. Reuse Orenew's existing brand (logo + indigo/dark palette).
- **Scope of "manage products":** managing the **Orenew subscription products/licenses** (Free / Pro / Studio) and their customers — not the photographer's own photo products.

---

## Expected behavior

**Visitor (unauthenticated)**
- Lands on a marketing site: Hero, Features, Gallery/before-after, Pricing, Download, FAQ.
- Can download the desktop app freely without signing in (links resolve to GitHub Releases, OS auto-detected).
- Sees a 3-column pricing table: Free, Pro, Studio, with a monthly/annual toggle.

**Buyer**
- Clicks "Get Pro/Studio" → must sign in (Supabase Auth: email/password, Google, Facebook) → redirected to Lemon Squeezy checkout.
- Checkout carries the buyer's Supabase `user_id` so the purchase can be tied back to their account.
- On success, the Lemon Squeezy webhook upgrades their `entitlements` row; the next time their desktop app refreshes, it reflects the new tier (no manual key entry).

**Subscriber (self-serve portal)**
- Signs in on the website, sees current plan, renewal date, and seat usage.
- Can upgrade/downgrade tier (custom page) and open the Lemon Squeezy portal for card/invoices/cancellation.
- Can view and disconnect their registered devices (seats), reusing the existing `entitlement_devices` + `disconnect-device` flow.
- On cancellation, access continues until period end (`expires_at = period end`), matching the desktop's grace behavior.

**Vendor admin**
- Signs in with the same Supabase Auth; access gated by an `is_admin` flag/role enforced via RLS.
- Sees a dashboard of customers: email, tier, subscription status, seat count, renewal/cancel state.

**Interaction with the existing desktop app**
- Tier changes made via the website propagate to the desktop through the existing `entitlements` table + refresh loop — no desktop code change required for tier delivery.
- **Seat-count change:** Pro is now **1 seat** (was 2). This is a deliberate change to the existing seat limit and must be updated in the backend seat-enforcement logic (see Open questions / Implementation plan).

---

## Implementation plan

### Stack & repo
- New repo, **Next.js (App Router) + TypeScript + Tailwind CSS**, deployed on **Vercel**.
- `@supabase/supabase-js` + `@supabase/ssr` for auth/session on the web.
- Server-only Supabase **service-role** client used exclusively inside webhook/admin route handlers (never shipped to the client).
- English-only UI now, but wrap copy in an i18n-ready structure (e.g. a `dictionaries/en.ts`) so Hebrew/RTL can be added later, mirroring the desktop's `src/locales` approach.

### Brand / design tokens (reuse from orenew repo)
- Logo: `public/orenew.svg`, `public/orenew-detailed.svg|png` (copy into the web repo's `public/`).
- Palette: accent indigo `#5b5bd6` (hover `#6e6ee0`, active `#4b4bc4`, fg `#ffffff`), dark base `#0a0a0b`, text `#f0f0f0`, neutral scale (e.g. `--color-neutral-850: #1c1c1f`).
- Define these as Tailwind theme tokens so utilities like `bg-accent`, `text-accent` exist, matching the desktop's `@theme` convention in `src/index.css`.
- Pull **real screenshots** of the desktop app from the orenew repo (Gallery, Lightbox, Export dialog) for the marketing visuals; reserve a slot for a demo video.

### Marketing pages (`app/`)
- `app/page.tsx` — Hero, Features, Gallery/before-after, demo video slot, pricing teaser, FAQ, footer.
- `app/pricing/page.tsx` — full pricing table + monthly/annual toggle + CTAs.
- `app/download/page.tsx` — OS auto-detect, links to GitHub Releases, system requirements.
- `app/faq/page.tsx` (or a section) — covers Free watermark, seats, refunds, offline grace.
- Shared components: `Header`, `Footer`, `PricingTable`, `BillingToggle`, `FeatureCard`, `BeforeAfter`, `Screenshot`, `CTAButton`.

### Pricing model (concrete)
- **Free** — watermarked output, uncapped devices. Shown as a pricing column; CTA = Download.
- **Pro** — **$15/mo**, **$150/yr**, **1 seat**.
- **Studio** — **$45/mo**, **$450/yr**, **5 seats**.
- One Lemon Squeezy product per paid tier with monthly + annual variants (4 variant IDs total), stored in env.

### Auth (`lib/`, `app/`)
- `lib/supabase/client.ts`, `lib/supabase/server.ts` — browser + server clients.
- `app/(auth)/sign-in` — email/password + Google + Facebook via Supabase Auth.
- Middleware to refresh the Supabase session cookie; gate `/account` and `/admin`.
- Download stays public; only buy/manage require auth.

### Commerce — Lemon Squeezy (`app/api/`, `lib/`)
- `lib/lemonsqueezy.ts` — wrapper to create checkout URLs with the buyer's Supabase `user_id` passed as **custom data**, and to build customer-portal URLs.
- `app/api/checkout/route.ts` — authenticated; returns a checkout URL for the chosen tier+period.
- `app/api/webhooks/lemonsqueezy/route.ts` — verifies LS webhook signature; handles `subscription_created`, `subscription_updated`, `subscription_cancelled`:
  - Resolve Supabase `user_id` from checkout custom data.
  - Upsert mapping row (`user_id ↔ ls_customer_id ↔ ls_subscription_id`).
  - Update `entitlements.tier` + `expires_at` via service role.
  - On cancel: set `expires_at = current period end` (grace), keep tier until then; flip to `free` after.

### Supabase schema deltas (new SQL migration in the web repo, run against the shared project)
- `public.billing_subscriptions` — `user_id` (FK), `ls_customer_id`, `ls_subscription_id`, `tier`, `status`, `current_period_end`, timestamps. RLS: user reads own; only service role writes.
- Add `is_admin boolean default false` to `public.entitlements` (or a dedicated `admins` table); RLS policy allowing admins to read all customer rows.
- Reuse existing `public.entitlements` and `public.entitlement_devices` (do not redefine).

### Customer portal (`app/account/`)
- `app/account/page.tsx` — current tier, renewal date, seat usage; upgrade/downgrade actions; "Manage billing" → LS portal.
- `app/account/devices/page.tsx` — list `entitlement_devices`, disconnect via the existing `disconnect-device` Edge Function (call with the user's access token).

### Vendor admin (`app/admin/`)
- `app/admin/page.tsx` — customer table (email, tier, status, seats, renewal/cancel), gated by `is_admin` RLS.
- Read-only first; mutation actions are an open question.

### Backend contract (existing — DO NOT BREAK)
- Tier is delivered to the desktop as an EdDSA-signed, device-bound entitlement token minted by the `issue-entitlement` Edge Function, which reads `entitlements` server-side. 14-day offline grace from the token's `iat`.
- Paid tier is **only** writable by the **service role** (our webhook). There is no client-writable tier policy — preserve this.
- `entitlement_devices` = per-user device registry for seat enforcement; seat limits live in the Edge Functions' `_shared/auth.ts` (currently Free uncapped, **Pro 2**, Studio 5). **Change Pro 2 → Pro 1** there as part of this work.
- `disconnect-device` Edge Function frees a seat; reuse it from the web portal.
- Supabase config (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) is shared; the website needs its own `SUPABASE_SERVICE_ROLE_KEY` (server-only) plus Lemon Squeezy keys/variant IDs/webhook secret.

---

## Implementation phases

1. **Scaffold & brand** — Next.js + Tailwind on Vercel; copy logo + define design tokens; static Hero/Footer. Deploys and renders.
2. **Marketing site** — Features, Gallery/before-after with real screenshots, Pricing table + monthly/annual toggle, Download (GitHub Releases, OS detect), FAQ. Fully browsable, no auth.
3. **Auth** — Supabase sign-in (email/Google/Facebook), session middleware, gate `/account`.
4. **Checkout** — Lemon Squeezy products/variants; `checkout` route passing `user_id`; buy flow reaches LS checkout.
5. **Webhook + schema** — `billing_subscriptions` migration; webhook updates `entitlements` + mapping; verify a real purchase flips tier and the desktop reflects it.
6. **Customer portal** — current plan, upgrade/downgrade, LS portal handoff, device list + disconnect; cancel→grace behavior.
7. **Admin dashboard** — `is_admin` RLS + customer table (read-only).
8. **Seat change + polish** — set Pro = 1 seat in `_shared/auth.ts`; SEO/meta/OG, analytics hook, accessibility pass, i18n scaffolding.

Each phase leaves a working (if incomplete) system.

---

## Testing strategy

- **Unit:** pricing/tier mapping helpers; LS variant ↔ tier/period resolution; webhook payload → entitlements update logic; OS-detection for download links.
- **Integration:** webhook signature verification (valid/invalid); `subscription_created/updated/cancelled` each producing the correct `entitlements` + `billing_subscriptions` state via a test service-role client; RLS — non-admin cannot read others' rows, admin can; user can read only own devices.
- **End-to-end (LS test mode):** sign in → checkout → webhook → tier upgraded → portal shows new plan → cancel → access persists to period end → downgrades to Free after.
- **Edge cases:** webhook arrives before auth redirect completes; duplicate/retried webhooks (idempotency on `ls_subscription_id`); user buys while at seat limit; checkout custom data missing `user_id`; annual vs monthly proration; desktop offline during a tier change (grace + next refresh).
- **Cross-app:** confirm a web-driven tier change is honored by the desktop refresh loop without desktop code changes; confirm Pro seat limit of 1 is enforced by `issue-entitlement`.

---

## Open questions

- **Pro seat reduction (2 → 1):** changing `_shared/auth.ts` affects existing Pro users who already registered 2 devices. Grandfather them, or force-disconnect down to 1 on next issue? Needs a decision before shipping the seat change.
- **Admin mutations:** is the admin dashboard read-only, or should admins be able to grant/revoke tiers and disconnect devices? If write, define the audit trail.
- **Lemon Squeezy ↔ Supabase identity edge:** primary mapping is `user_id` in checkout custom data; do we also need an email fallback for purchases made before sign-in, or block unauthenticated checkout entirely?
- **Free tier seats:** currently uncapped — keep uncapped on the pricing page, or cap to reduce abuse?
- **Demo video:** produce/host where (e.g. Vercel asset, YouTube, Supabase Storage)? Marketing leans on it.
- **Refund/dunning copy:** Lemon Squeezy handles billing emails — confirm what the site's FAQ should state about refunds and failed payments.
- **Annual discount framing:** $150/yr vs $180 monthly-equivalent ≈ 17% off — confirm how to label it on the toggle.
- **Studio "5 seats" enforcement** already matches backend; confirm no change needed there.
