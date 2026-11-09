# Put AdaptFit on your phone for free (with offline use)

AdaptFit is a set of static files (HTML, JavaScript, icons). It needs no server
and no database: everything you log is stored **on the phone itself**. To install
it and use it offline, the phone has to load those files once from an **HTTPS**
address. This guide shows three free ways to get one.

Sources were checked on **9 Nov 2026**. Free tiers change; check the linked pages
if something looks different.

---

## Shortest path (about 15 minutes, $0)

1. Create a free GitHub account and a new **public** repository (e.g. `adaptfit`), then upload this project to it (GitHub Desktop → *Add existing repository* → *Publish*).
2. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Open the **Actions** tab, choose **Deploy to GitHub Pages**, click **Run workflow** (it also runs on every push to `main`). Wait for the green tick.
4. On your iPhone, open **Safari** at `https://<your-user>.github.io/adaptfit/`.
5. Tap **Share → Add to Home Screen → Add**, open AdaptFit from the new icon once while online, then check **Settings → Install the app** says *Offline: ready*. (Optional: **Settings → Privacy & about → Admin → Keep my data on this device**.)

The details for each option follow.

---

## Option 1 — GitHub Pages (recommended: automatic updates)

The project already contains `.github/workflows/deploy-pages.yml`, which builds
the app (`npm ci`, `npm run build`) and publishes `dist/` to GitHub Pages
whenever you push to `main`, or when you press **Run workflow**.

1. **Create an account** at <https://github.com/signup> (free).
2. **Create a repository**: top-right **+ → New repository**, name it (e.g.
   `adaptfit`), choose **Public**, click **Create repository**.
   GitHub Pages on the Free plan is for public repositories; your *workout data*
   is never in the repository — it stays on your phone — but the app's source
   code will be public.
3. **Upload the project.** Easiest for non-developers: install
   [GitHub Desktop](https://desktop.github.com/), *File → Add local repository*
   → choose the `FitnessApp` folder → *Publish repository* (untick "Keep this
   code private"). Don't upload `node_modules`, `dist` or `.e2e-*` (they are
   already in `.gitignore`).
4. **Turn on Pages**: repository **Settings → Pages**, under *Build and
   deployment → Source* choose **GitHub Actions**.
   ([GitHub docs: configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site))
5. **Deploy**: **Actions** tab → *Deploy to GitHub Pages* → **Run workflow**.
   When it finishes, the job shows the address:
   `https://<your-user>.github.io/<repo-name>/`.
6. **Install on iPhone** — see [Install on the phone](#install-on-the-phone).

Updating later: change the code, push (GitHub Desktop → *Commit* → *Push*). The
workflow redeploys; the app on your phone shows "A new version is ready →
Refresh" next time it is opened online.

Why a sub-path works: the build uses relative paths (`base: './'` in
`vite.config.ts`) and hash routes (`#/plan`), so the same build runs at
`https://example.com/` or `https://<user>.github.io/<repo>/`. This is covered by
the automated test `tests/e2e/subpath.spec.ts` (serves the app only under
`/adaptfit/`, checks icons/manifest/service worker, then reopens it offline).

Limits ([GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)):
site ≤ 1 GB (AdaptFit is ~1.2 MB), soft 100 GB/month bandwidth, soft 10
builds/hour. GitHub Actions minutes are free for public repositories
(*unverified for your account type — check
<https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions>*).

## Option 2 — Cloudflare Pages (drag and drop, no Git)

Build once on your computer, then upload the folder.

1. On your computer, in the project folder: `npm ci` then `npm run build`. This
   creates the `dist` folder.
2. Create a free account at <https://dash.cloudflare.com/sign-up>.
3. In the dashboard: **Workers & Pages → Create application → Get started →
   Drag and drop your files**. Enter a project name (e.g. `adaptfit`), click
   **Deploy site**, drag the **`dist` folder** into the upload area, then
   **Save and Deploy**.
   ([Cloudflare docs: Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/))
4. You get `https://adaptfit.pages.dev` (or similar). Install as below.
5. To update: rebuild, then in the project choose **Create a new deployment**
   and upload `dist` again.

Limits for drag and drop: up to 1,000 files and 25 MiB per file (AdaptFit has
about 65 files). The Cloudflare dashboard menus change from time to time — if
the wording differs, follow the linked doc.

## Option 3 — Netlify Drop (quickest one-off test)

1. Build: `npm ci` then `npm run build`.
2. Open <https://app.netlify.com/drop> and drag the **`dist` folder** onto the
   page. Netlify says this works "no account required"; dropped files are
   published as-is.
   ([Netlify docs: create deploys](https://docs.netlify.com/deploy/create-deploys/))
3. You get an `https://<random-name>.netlify.app` address. **Sign up / claim the
   site** so it doesn't disappear and so you can update it (drag a new `dist`
   onto the site's *Deploys* page). Whether unclaimed Drop sites expire is not
   stated in the docs page above — *unverified*; claim it to be safe.

---

## Install on the phone

### iPhone (Safari)

1. Open the HTTPS address in **Safari**.
2. Tap **Share** (square with arrow) → **Add to Home Screen** → **Add**.
3. Open AdaptFit **from the new icon** while still online, and wait a few
   seconds. **Settings → Install the app** should show *Offline: ready*.
4. Optional but recommended: **Settings → Privacy & about → Admin → Keep my
   data on this device** (asks the browser for persistent storage).
5. Test: turn on Airplane Mode and open AdaptFit from the icon. It should open
   normally.

### Android (Chrome)

Open the address in Chrome → **⋮ → Install app** (or *Add to Home screen*) →
open it once online.

## Why `http://192.168.x.x` doesn't work for install/offline

Opening `npm run preview` from your phone via your computer's Wi-Fi address
(e.g. `http://192.168.1.20:4173`) shows the app, but it **can't install
properly or work offline**. Offline support uses a *service worker*, and
browsers only allow service workers in a **secure context**: HTTPS, or
`localhost` on the same device. A LAN `http://` address is neither.
([MDN: Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts))
The free HTTPS hosts above solve this. (Alternative for developers: a local
mkcert certificate — see `docs/PWA_AND_NATIVE.md`.)

## Moving your data between addresses or phones

Data belongs to one browser on one phone **and one web address**. A new address
(e.g. moving from Netlify to GitHub Pages) starts empty.

1. Old place: **Settings → Data & backups → Export** — save the file (Files app / AirDrop / email to yourself).
2. New place: on the welcome screen choose **Coming back? Restore a backup**, or **Settings → Data & backups → Restore**, and pick the file.

## iOS storage caveat

Safari may delete a website's stored data when the phone is short of space or
when a site hasn't been used for a while; by default storage is "best-effort".
Since Safari 17 a site can ask for persistent storage with
`navigator.storage.persist()`, and WebKit grants it "based on heuristics like
whether the website is opened as a Home Screen Web App".
([WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/))

So: install to the Home Screen, open it from the icon, press **Keep my data on
this device** on the Admin page (AdaptFit never asks automatically), and
**export a backup regularly** anyway. The Admin page shows whether storage is
currently persistent.

## Cost

| Option | Cost | Account | Notes |
| --- | --- | --- | --- |
| GitHub Pages | $0 | GitHub (free) | Public repo; auto-deploy on push; 1 GB site, ~100 GB/month soft bandwidth |
| Cloudflare Pages | $0 | Cloudflare (free) | Manual upload; 1,000 files / 25 MiB per file via drag and drop |
| Netlify Drop | $0 | Optional (claim the site) | Fastest one-off test |

No App Store or Google Play account is needed. AdaptFit makes no network calls
of its own beyond loading its own files, so hosting traffic is tiny.
