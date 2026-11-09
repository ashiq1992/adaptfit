# Admin page and "who is using AdaptFit?"

## What exists today: the on-device Admin page (`#/admin`)

**Settings → Privacy & about → Admin** opens a diagnostics page for **this
device only**. It reads the local IndexedDB and browser APIs and sends nothing
anywhere. It shows:

- App version (from `package.json`, injected at build time) and database version (`adaptfit` v5).
- Record counts: profiles, workout notes/programmes, weekly records (confirmed / draft), workout sessions, imports, bodyweight entries, note revisions.
- First use and last activity, derived from the earliest and latest timestamps in stored records.
- Storage used / available (`navigator.storage.estimate()`), whether storage is persistent (`persisted()`), and a **Keep my data on this device** button (`persist()`, only on tap).
- Installed (standalone) or browser tab, service-worker / offline-ready status, update waiting, online/offline, theme, and a short browser summary ("Safari on iOS").

**What it cannot do:** see other people. AdaptFit has no accounts and no server.
Each phone's data lives only in that phone's browser, so there is nothing
central to look at. The privacy promise in the README and in *Settings →
Privacy & about* ("No account, cloud storage, analytics…") depends on that.

Code: `src/features/admin/` (`AdminScreen.tsx`, pure helpers in
`diagnostics.ts`). Tests: `tests/unit/admin.test.ts`, `tests/e2e/admin.spec.ts`
(also asserts the page makes no requests to other origins).

---

## What an owner dashboard of all users would need

To know "who is logged in and using the tool", every installed copy would have
to **send something to a server you control**. That needs:

1. **A small backend**: an HTTPS endpoint that accepts a ping, plus a database.
2. **An identifier**: accounts (email/password — heavy, and personal data), or
   an **anonymous random install ID** generated on the device (recommended).
3. **App changes**: an opt-in setting, the ping code, and a CSP change
   (`connect-src 'self' https://<your-endpoint>` in `vite.config.ts`) — today
   the CSP blocks all outside connections on purpose.
4. **A dashboard**: a query or tiny page showing daily/weekly active devices.
5. **Privacy changes**: updated wording in the README, Settings → Privacy, and
   a privacy notice; an off switch; a deletion route.

This is a **product decision for the owner**: it changes "nothing leaves this
device" to "an anonymous ping leaves this device if you allow it", and it needs
the owner's own cloud account. It is **not implemented**.

## Zero-cost backend options

Checked **9 Nov 2026**. Free tiers change — re-check before relying on them.

| Option | Free tier (as published) | Fit for a heartbeat | Notes |
| --- | --- | --- | --- |
| **Cloudflare Workers + D1** | Workers: 100,000 requests/day, 10 ms CPU per request ([limits](https://developers.cloudflare.com/workers/platform/limits/)). D1: 5 million rows read/day, 100,000 rows written/day, 5 GB storage, 10 databases, 500 MB per database ([pricing](https://developers.cloudflare.com/d1/platform/pricing/), [limits](https://developers.cloudflare.com/d1/platform/limits/)) | **Best**: one Worker + one table; same company can host the app (Pages) | Daily limits reset 00:00 UTC; over-limit requests error until reset |
| **Supabase** (Postgres) | 500 MB database per project, 50,000 monthly active users, 5 GB egress, 2 active projects, **free projects paused after 1 week of inactivity** ([pricing](https://supabase.com/pricing)) | Good; insert via REST with row-level security (insert-only) | The inactivity pause matters for a hobby project — a paused project drops pings |
| **Firebase Spark** (Firestore) | 1 GiB stored, 50K reads/day, 20K writes/day, 20K deletes/day; Cloud Functions **not available** on Spark ([pricing](https://firebase.google.com/pricing)) | OK; write directly from the client with strict security rules | Google SDK is large; can call the REST API instead |
| **PocketBase on PocketHost** | **No free tier found** — paid plans from $9.99/instance/month with a 7-day trial ([pricing](https://pockethost.io/pricing)) | — | Self-hosting PocketBase is free software but needs an always-on server (not zero cost) |

At AdaptFit's scale (one ping per device per day) any of the first three is far
inside its free limits: 1,000 devices = 1,000 writes/day.

## Privacy implications (basics, not legal advice)

- **Is an install ID personal data?** Under the GDPR, online identifiers that
  can single out a device can be personal data
  ([GDPR Recital 30](https://gdpr-info.eu/recitals/no-30/)); a random ID plus IP
  addresses seen by the server is safest treated as personal data. *Interpretation — unverified for your specific case.*
- **Singapore PDPA**: organisations must obtain consent before collecting,
  using or disclosing personal data for a purpose (Consent Obligation, ss. 13–17)
  and may only do so for purposes a reasonable person would consider
  appropriate (s. 18) ([PDPC advisory guidelines on key concepts](https://www.pdpc.gov.sg/-/media/Files/PDPC/PDF-Files/Advisory-Guidelines/overview-of-dp-provisions---ch-10-(270717).pdf)).
  Whether the PDPA applies to a personal, non-commercial project is *unverified* — assume it does.
- **GDPR** (if anyone in the EU/UK uses it): needs a lawful basis — use
  **consent** (opt-in, freely given, withdrawable), data minimisation
  (Art. 5(1)(c)), and a clear notice ([GDPR Art. 5](https://gdpr-info.eu/art-5-gdpr/), [Art. 7](https://gdpr-info.eu/art-7-gdpr/)).
  Storing an ID on the device for analytics also falls under ePrivacy
  "cookie" rules in the EU, which again points to opt-in. *Summary, not legal advice.*
- **Health data**: workout, bodyweight and nutrition data can be sensitive /
  health-related. **Never send it.** The design below sends none.
- **Practical rules**: opt-in only (default off); say exactly what is sent; let
  people turn it off and delete their ID; keep raw pings for a short time (e.g.
  90 days) and keep only aggregate counts after that; don't log IPs in your
  table.

## Recommended minimal design ("active device" heartbeat)

- **Opt-in switch** in *Settings → Privacy & about*: "Help the owner count
  active devices (sends an anonymous ping once a day: random ID, app version,
  date). No workout, body or personal data." Default **off**.
- **Install ID**: `crypto.randomUUID()` created only when the switch is turned
  on, stored in the `meta` table; deleted (and a "forget me" request sent) when
  turned off. Not included in backups, so a restored phone gets a new ID.
- **Payload** (POST JSON): `{ "id": "<uuid>", "v": "0.5.0", "day": "2026-11-09", "standalone": true }`. Nothing else.
- **When**: at most once per local day, on app open, only when online; failures
  are ignored silently (offline use is unaffected).
- **Server table**: `pings(id TEXT, day TEXT, v TEXT, standalone INTEGER, PRIMARY KEY (id, day))` — the primary key de-duplicates. No IP column.
- **Dashboard**: `SELECT day, COUNT(*) FROM pings GROUP BY day ORDER BY day DESC;` (daily active devices) and `COUNT(DISTINCT id)` over 7/30 days. Protect it (e.g. Cloudflare Access, free for small teams — *unverified*) or just run queries in the provider's console.
- **CSP**: add only your endpoint to `connect-src`.
- **Abuse**: the endpoint is public, so counts are "best effort"; validate the
  payload shape and size, and rate-limit per ID.

## Steps the owner would take (if you decide to do it)

1. **Decide** and update the privacy wording (README, Settings → Privacy, a short privacy notice page).
2. **Create the backend** (example: Cloudflare, free):
   1. Sign up at <https://dash.cloudflare.com/sign-up>.
   2. Install Wrangler on your computer: `npm create cloudflare@latest adaptfit-pings` (choose "Hello World Worker").
   3. `npx wrangler d1 create adaptfit-pings` and add the binding it prints to `wrangler.toml`/`wrangler.jsonc`.
   4. `npx wrangler d1 execute adaptfit-pings --remote --command "CREATE TABLE pings(id TEXT, day TEXT, v TEXT, standalone INTEGER, PRIMARY KEY(id, day))"`.
   5. Write the Worker: accept `POST /ping` with the JSON above, validate it, `INSERT OR IGNORE`, return 204; answer CORS only for your app's origin.
   6. `npx wrangler deploy` → note the `https://adaptfit-pings.<you>.workers.dev` URL.
   (Docs: <https://developers.cloudflare.com/d1/get-started/>.)
3. **Change the app** (a developer task): the opt-in switch, the once-a-day ping, the `connect-src` entry, and tests that no request is made while the switch is off.
4. **Deploy** the app (see `docs/DEPLOY_FREE.md`).
5. **Look at the numbers** in the D1 console (*Workers & Pages → D1 → adaptfit-pings → Console*) with the queries above.
6. **Housekeeping**: a monthly `DELETE FROM pings WHERE day < date('now','-90 days')`, after storing monthly totals if you want history.

Until then, the honest answer to "who is using it?" is: only the people you've
shared the link with — and each of them can see their own device on the Admin page.
