# AdaptFit anonymous usage counter

A tiny Cloudflare Worker and one D1 table, used only by people who switch on
**Settings → Privacy & about → Help count active users**. It answers "how many
devices used AdaptFit today / this week / this month, and how many came back".

**Stored per device per day:** a random ID made on the phone, the app version,
whether it's installed, and the UTC date. **Never stored:** IP address, name,
email, workouts, notes or body data. Rows are deleted after 90 days (daily cron),
and switching the setting off deletes that device's rows immediately.

| Endpoint | Who | What |
|---|---|---|
| `POST /ping` `{"id","v","installed"}` | the app, from allowed origins only | records today; repeats the same day are ignored |
| `DELETE /ping` `{"id"}` | the app, when the switch is turned off | deletes every row for that ID |
| `GET /stats` + `Authorization: Bearer <ADMIN_KEY>` | the owner's Admin page | counts (today, 7, 30 days, returning, installed, versions) |

Code: `src/logic.ts` (all logic, tested in `tests/server/pings-worker.test.ts`
on real SQLite) and `src/worker.ts` (Cloudflare entry point).

## First deploy (free plan, no card)

A new Cloudflare account first needs a free `*.workers.dev` subdomain:
dashboard → **Workers & Pages** → right-hand **Account details** → **Subdomain** →
Change/Set up. (AdaptFit's is `adaptfit`, so the counter lives at
`https://adaptfit-pings.adaptfit.workers.dev`.) The HTTPS certificate for a new
subdomain can take 5–15 minutes; until then requests fail with a TLS error.

Run from this folder (`server/pings`):

```sh
npx wrangler login                                    # opens the browser once
npx wrangler d1 create adaptfit-pings                 # copy the database_id it prints into wrangler.jsonc
npx wrangler d1 execute adaptfit-pings --remote --file=schema.sql
npx wrangler secret put ADMIN_KEY                     # paste a long random key; keep it private
npx wrangler deploy                                   # prints https://adaptfit-pings.<you>.workers.dev
```

Then turn it on in the app:

```sh
gh variable set PINGS_URL --body "https://adaptfit-pings.<you>.workers.dev"
gh workflow run "Deploy to GitHub Pages"
```

After the site redeploys, the switch appears in Settings, and **Admin → All
users** asks for the owner key.

## Change who may send pings

Edit `ALLOWED_ORIGINS` in `wrangler.jsonc` (origins have no path, e.g.
`https://ashiq1992.github.io`) and run `npx wrangler deploy` again.

## Test locally

```sh
echo ADMIN_KEY=local-test-key > .dev.vars             # git-ignored
npx wrangler d1 execute adaptfit-pings --local --file=schema.sql
npx wrangler dev --port 8787 --var "ALLOWED_ORIGINS:http://127.0.0.1:4176"
# in the project root:
VITE_PINGS_URL=http://127.0.0.1:8787 npx vite build --outDir .e2e-pings
E2E_PINGS_URL=http://127.0.0.1:8787 E2E_PINGS_KEY=local-test-key E2E_PORT=4176 E2E_DIST=.e2e-pings npx playwright test usage-count
```

## Limits worth knowing

- Counts only people who opt in, so numbers are a floor, not a total.
- The origin check stops other websites from sending pings from a browser; it
  can't stop someone scripting fake pings directly. At this scale that's an
  acceptable risk; the data is anonymous counts only.
- Free plan: 100,000 Worker requests per day; D1 free limits are far above one
  row per device per day.
