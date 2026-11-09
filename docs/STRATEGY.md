# AdaptFit — Market & Product Strategy

*Prepared 2026-11-09 for v0.5.0. All sources accessed 2026-11-09 (numbered list at the end). Prices are US App Store or US-dollar figures unless stated, and they vary by region. Third-party figures that I could not confirm on a primary source are marked **(secondary)**. Claims I could not check at all are marked **unverified**.*

---

## Executive summary

1. **The notes-to-log idea has already been tried.** Since 2025 at least four small iOS apps have pitched "like Notes, but for lifting": Bram [16], JimNotes [14], GymNote+ [13] and GymGPT [15]. None has traction yet. GymNote+ has 28 ratings and GymGPT has 1 [13][15]. The big players (Strong, Hevy) log set by set and each has over 100K ratings [1][2].
2. **The real incumbent is Apple Notes, Google Keep or a spreadsheet.** Lifters and journalists say they prefer them ([18], [29]). One founder in this space puts the gap this way: "Apple Notes is fast, but it doesn't tell you what's improving" [16].
3. **What sets AdaptFit apart is the combination, not any single feature:** (a) you update once a week instead of logging every session, (b) the parser is deterministic and asks one-tap questions instead of guessing, (c) it is local-first with no account, and (d) its analysis needs evidence before it calls a plateau. I found no competitor with the weekly "copy last week, confirm" workflow. Each part is still easy to copy on its own.
4. **Table stakes AdaptFit must not lose:** a free tier with unlimited logging, PRs and charts, and no ads. Hevy, Strong, Boostcamp and Liftosaur all offer this for free [1][2][8][10].
5. **Positioning:** *"For lifters who already keep their workouts in Notes, AdaptFit is the notebook that reads its own pages: update once a week, and it shows you honestly what's adding up, with no account and nothing leaving your phone."*
6. **Monetisation:** keep it free while you validate. Once it is packaged with Capacitor, add a **one-time "Pro" unlock** through the app stores. That can be checked on-device with no account [25], and Apple's commission is 15% under the Small Business Program [20]. Optional subscriptions come later, only for features that need a server (sync, AI fallback, coach links).
7. **Price anchors:** Hevy Pro sells for $2.99/mo, $23.99/yr or $74.99 lifetime [2]. Strong PRO sells for $4.99/mo, $29.99/yr or $99.99 forever [1]. A one-time price of about $15–25 (unverified willingness to pay) undercuts both lifetime plans.
8. **Build next ("must"):** export/share as text, a reliable backup that survives iOS storage eviction, Android share-target plus an iOS Shortcut for "send note to AdaptFit", parser support for supersets and RPE, and a rest timer and plate maths read from the note.
9. **Go-to-market:** this is a founder-led, Singapore-first niche. Use r/Fitness Self-Promotion Saturday [26], r/weightroom and r/SingaporeRaw comments, ActiveSG and HDB-gym communities, and "my gym notes" content on TikTok and Instagram. Hold the Product Hunt launch until there is week-4 retention data.
10. **Four signals that it is working within 30 days:** (1) ≥40% of activated users confirm a week-2 update, (2) ≥25% confirm in week 4, (3) ≥60% of Notes pastes import with ≤2 questions, and (4) ≥5 unprompted "I switched from Notes/Hevy" messages. These targets are my proposals, not industry benchmarks.

---

## 1. Has this been done before? Competitive landscape

### 1.1 Comparison table

| App | Model and price (US) | Logging style | Account / offline | Strengths | Weaknesses vs AdaptFit's idea | Closeness to "notes-first weekly update" |
|---|---|---|---|---|---|---|
| **Apple Notes / Google Keep / spreadsheets** | Free | Free text, copy last session | None / offline | Zero friction, total flexibility [18][29] | No analysis, plateau detection or PRs: "doesn't tell you what's improving" [16] | **Very high**. This is the habit AdaptFit absorbs. |
| **Strong** | Free with 3 routines; PRO $4.99/mo, $29.99/yr, $99.99 forever [1] | Set by set, live | Sign-in and cloud sync appear in the listing; offline unverified [1] | Polished, 4.9★ from ~109K ratings [1] | Live logging is required for the core flow | Low |
| **Hevy** | Free, no ads; Pro $2.99/mo, $23.99/yr, $74.99 lifetime [2]. Free caps: 4 routines, 3 months of graphs **(secondary)** [3] | Set by set, social feed | Account implied (email linked, sync) [2] | 4.9★ from 103K ratings, social features, cheap Pro [2]. Hevy Coach from $25/mo for 1–10 clients **(secondary)** [21] | Social and live logging; per-set friction | Low |
| **JEFIT** | Free with ads; Elite $12.99/mo or $69.99/yr (legacy $6.99/$39.99) **(secondary)** [4] | Set by set, large exercise database | Account (unverified) | Exercise library, plans | Ads, heavy UI | Low |
| **FitNotes (Android)** | Free, no ads, optional "Supporter" app **(secondary)** [5] | Set by set, minimal | No account, fully offline, local/Drive backup **(secondary)** [5] | Closest to AdaptFit's local-first ethos; loved by its users | Android only, still logs per set, basic analysis | Medium (philosophy), low (workflow) |
| **Fitbod** | Subscription, $15.99/mo or $95.99/yr after a 2026 increase **(secondary)** [6] | AI-generated workouts, live logging | Account | Auto-programming | Expensive; the app decides your plan | Very low |
| **Alpha Progression** | Free logging; Pro $12.99/mo or $79.99/yr [7] | Live logging with progression suggestions | Account (unverified) | Strong hypertrophy recommendations | Recommendations are paywalled | Low |
| **Boostcamp** | Free library of 14,000+ programmes; Pro $59.99/yr or $14.99/mo [8] | Programme-led, live | Account implied [8] | Huge free programme library, weekly report, RPE [8] | Built around following other people's programmes | Low |
| **RP Hypertrophy** | Subscription only, about $34.99/mo or $299.99/yr list price, with frequent sales **(secondary)** [9] | Prescriptive mesocycles, live | Account | Evidence-based autoregulation | Expensive and prescriptive | Very low |
| **Liftosaur** | Free (Liftoscript, 61 programmes, logging, import/export); Premium $4.99/mo, $39.99/yr, $99.99 lifetime **(secondary)** [10] | **Text/script-defined programmes** [11], live logging | **No account needed; works offline** [10] | Open source (AGPL), deterministic, MCP/API for AI assistants [10] | Steep learning curve; the developer says this is the top complaint [10] | **Medium**. Text-first like AdaptFit, but it is code, not prose. |
| **StrongLifts 5x5** | Free core; Pro monthly $11.99 on the US listing [12] | Fixed 5x5 programme, live | Unverified | Simple for beginners | One programme | Low |
| **Gymshark Training** | Free; Gymshark support says no ads or subscriptions [13a] | Follow-along workouts | Account (unverified) | Brand, free content | Not a log for self-programmed lifters; less customisable [13b] | Very low |
| **GymNote+** | Free (notes up to 2,000 characters); Pro $4.99/mo, $29.99–39.99/yr, $99.99 lifetime [13] | **Free-text notes "translated" into a log**, plus photos of paper logbooks | Sign-in and email verification; offline-first with later sync [13] | Same core idea, plus OCR of paper notes | 28 ratings; account; parsing method undisclosed [13] | **High** |
| **JimNotes** | Free [14] | **Free-form notes or dictation turned into an AI log**; ask questions of your history | Unverified | Handles typos and slang, has an Apple Watch app [14] | Version 1.0 with no ratings when checked; AI (privacy/cost) **(secondary)** [14] | **High** |
| **GymGPT** | Free download; $5.99 or $24.99/yr in-app purchases [15] | **Natural-language or voice logging via AI** | Email login [15] | Logs in under a second (developer claim) [15] | 1 rating; still per-session logging [15] | Medium |
| **Bram – Workout Notes** | Unverified | "Like notes, but for lifting"; free-form to PRs, volume, weekly progress [16] | Unverified | Same pitch, calm design [16] | Early stage; still logs per session [16] | **High** |
| **Custom GPTs ("Workout Log GPT")** | Needs a ChatGPT account | Chat logging [17] | Account and cloud | Zero build cost for the user | Memory across sessions is unreliable (unverified) | Medium |

### 1.2 What this means

- **The idea isn't new; this execution of it is.** Every notes-to-log app I found (GymNote+, JimNotes, GymGPT, Bram) still assumes you log **each session**. Most rely on AI parsing behind an account. I found none built on a **weekly diff** ("copy last week, change what differed, confirm"). I also found none that asks instead of guesses.
- **Liftosaur and FitNotes prove there is an audience for local, no-account and deterministic apps** [5][10]. Liftosaur also shows that "text-first" turns users away when the text is a programming language [10].
- **The early notes-to-log apps have almost no ratings** [13][15]. Distribution, not the idea, is the hard part.

---

## 2. How AdaptFit is unique (honest view)

| Category | Feature | Assessment |
|---|---|---|
| **Genuinely differentiated** | Weekly update: copy, edit what differed, mark done/partly/skipped, confirm (about 6 taps) | No competitor found with this workflow. It is the core habit and the thing to defend with polish. |
| | Deterministic parser that asks one-tap questions ("30 kg — total or per side?") | Competitors use AI parsing [14][15] or their method is undisclosed [13]. Asking instead of guessing is a trust story. |
| | Honest analysis (a plateau needs evidence; "1 more rep at the same load") | Hard to fake. It depends on careful rules, not features. |
| | Local-first, no account, no AI service | Shared only with FitNotes and Liftosaur's no-account mode [5][10]. It is rare among notes-to-log apps. |
| | Ink & Paper identity: blue ink for what you did, highlighter only for progress | Distinctive and calm, but a brand, not a moat. |
| | Singapore food context in Fuel | A niche local hook. It is currently incomplete (hawker dishes show no numbers). |
| **Table stakes** | PRs, charts, history, programme library, backup/export, dark mode, free unlimited logging | Every major app has these [1][2][8][10]. |
| **Easily copied** | Paste from Notes, a "notes" look, weekly review card, approval-based suggestions | A funded competitor (for example Hevy) could ship a paste importer quickly, and AI apps already parse notes [13][14]. |

**Moat in practice:** the habit loop (one confirm per week) plus trust (no account, no guessing). Speed of iteration and a community in Singapore and on Reddit matter more than any feature.

**Positioning statement**
> For gym-goers who already track lifts in Notes and find set-by-set apps like Strong or Hevy too much, **AdaptFit is an intelligent workout notebook**. You write your plan like a note, update it once a week, and it tells you honestly what's improving. Unlike logging apps, it never asks you to start a workout, never guesses your numbers, and never needs an account.

**Taglines** (consistent with "Write it down. Watch it add up.")
1. *Write it down. Watch it add up.* (keep as the master line)
2. *Your gym notes, finally keeping score.*
3. *Copy last week. Change what's different. See what's working.*

---

## 3. How to monetise

### 3.1 Benchmarks
- Health & Fitness has the highest median revenue per install of any category: **$0.44 at day 14 and $0.63 at day 60**. Median trial-to-paid conversion is **39.9%**, and the top 10% reach **68.3%**. Download-to-paid at the 90th percentile is **12.1%** [19].
- Across all categories, year-1 retention is **44.1% for annual plans and 17.0% for monthly plans**. Only about **20% of new apps reach $1,000 in total revenue within two years** [19].
- Apple's Small Business Program charges **15%** for developers earning under $1M a year [20]. These are the 2020 terms; that they still apply today is **unverified**.
- Stripe in Singapore reportedly charges **3.4% + S$0.50** per domestic card payment **(secondary; check stripe.com/sg/pricing)** [22].

### 3.2 Options

| Option | How it works without accounts or a server | Pros | Cons |
|---|---|---|---|
| **One-time Pro unlock (app stores)** | Capacitor plus a native StoreKit 2 / Play Billing plugin; non-consumable purchase; restore via store transactions, no backend [25] | Fits local-first; the no-subscription stance is itself marketing; competitors anchor lifetime prices at $74.99–99.99 [1][2] | Needs Capacitor packaging and a $99/yr Apple developer fee (unverified for 2026); no recurring revenue |
| **Freemium plus Pro subscription** | Same plugin, auto-renewing product | Recurring revenue; the category converts well [19] | Contradicts the "simple notebook" promise; subscription fatigue; nothing ongoing to justify it without a server |
| **Licence key (web PWA)** | Stripe Payment Link → emailed key → offline signature check in the app | Works before app-store packaging; ~3.4% fees [22] | Keys can be shared; manual support |
| **Coach/PT plan** | Needs a read-only share link, which means a server | PTs pay: Hevy Coach costs $25–160/mo by client bracket **(secondary)** [21] | Needs a backend and accounts; a different product |
| **Programme marketplace** | Sell text programmes as notes | Fits the notes idea; Boostcamp sells some coach programmes one-time [8] | Boostcamp gives away 14,000+ for free [8]; needs creators |
| **B2B: Singapore gyms** | White-label "gym notebook" for small gyms or PT studios | Local relationships; ActiveSG gym demand is growing (4.02M attendances in 2023, **secondary**) [28] | Long sales cycles; ActiveSG is government-run; distraction this early |
| **Affiliate / nutrition partners** | Links in Fuel (protein, meal prep) | No infrastructure | Hurts the "honest, no tracking" brand; low revenue at small scale |
| **Donations / tip jar** | Ko-fi / GitHub Sponsors link, or "Supporter" IAP like FitNotes [5] | Zero friction; on-brand | Small, unpredictable revenue |

### 3.3 Recommended phases
1. **Now to month 3: free, validate.** Put a tip link in Settings. Measure retention (section 5) before pricing anything.
2. **Months 3–6: package with Capacitor and add a one-time "Pro" unlock** (proposed S$18–28, unverified willingness to pay). Pro would include extra themes, advanced analysis (block comparisons, e1RM trends), a templates pack, PDF/CSV export and widgets. **Never paywall** the weekly update, import, PRs or backups.
3. **Month 6 onwards, only if users ask:** an optional subscription for features with real running costs: encrypted multi-device sync, an AI parsing fallback, and read-only coach links. Price it below Hevy Pro ($23.99/yr) [2]. A coach tier could follow the Hevy Coach bracket model [21].

**Before charging, measure:** week-4 confirm rate ≥25%, an import success rate, ≥30% of active users saying in a survey that they would be "very disappointed" if AdaptFit went away (a proposed threshold), and ≥10 people asking for a Pro feature or tip.

---

## 4. What to build next (keeping it as simple as Notes)

| Priority | Feature | User problem | Why it fits notes-first | Effort |
|---|---|---|---|---|
| **Must** | **Share/export a week or day as text** (Web Share API works on iOS [23]) | "I want to send my week to a friend or PT, or keep a Notes copy" | Text in, text out: the note stays portable | S |
| **Must** | **Backup that survives iOS** (one-tap backup to Files/iCloud/Drive; weekly reminder; `navigator.storage.persist()`) | Safari can clear script-written storage after 7 days without a visit; home-screen apps are reportedly exempt, but persistence is not guaranteed **(secondary)** [24] | Losing your notebook is the worst failure for a local-first app | S–M |
| **Must** | **"Send note to AdaptFit"**: Android share target, plus an iOS Shortcut that opens the app with clipboard or URL text | iOS Safari doesn't support Web Share Target, so a PWA can't appear in the share sheet [23] | Moving from Notes to the notebook in one action | M |
| **Must** | **Supersets, RPE/RIR and "+2.5" in the parser** (keep current flags; RIR is kept as text today) | Real notes contain `A1/A2`, `@8` | The note syntax people already write | M |
| **Should** | **Rest timer and plate calculator read from the note** ("Rest 2 min", "100 kg → 2×20 + 2×5 + 2.5") | Mid-set maths and timing | Uses what's already written; no new input | S |
| **Should** | **Templates library as notes** (PPL, Upper/Lower, 5/3/1 as editable text) | "Give me a starting point" | A programme is just a note | S |
| **Should** | **Reminders** (calendar .ics "Update your week" every Sunday; local notifications once packaged) | Forgetting the weekly confirm, which is the core habit | One nudge per week, not per set | S (ics) / M (native) |
| **Should** | **Apple Health / Google Fit (write workouts)** after Capacitor | Rings and closed workouts; Liftosaur includes this free [10] | Output only; no extra logging | M |
| **Later** | **Read-only coach link** | PT wants to see the week | Shares a page of the notebook, but needs a server | M–L |
| **Later** | **Optional AI parsing fallback** (opt-in per paste; show the text being sent; on-device model if possible) | Messy notes the rules miss | Keep "asks, never guesses": AI only *suggests*, the user confirms. Costs money per call and conflicts with the "no AI service" promise, so make it opt-in and Pro-only | M |
| **Later** | **Widgets** ("Today: Push — Bench 3×8 60 kg") | Glance at the plan without opening the app | The note on the home screen | M (native only) |
| **Later** | **Multi-device sync** (end-to-end encrypted, or via the user's own iCloud/Drive file) | Phone plus tablet or laptop | Only if requested; it breaks "no cloud" unless the user owns the storage | L |
| **Avoid** | Social feed, streaks/XP, ads, AI-generated programmes, mandatory accounts, live logging as the default | n/a | Each one turns AdaptFit into Hevy, Fitbod or the v0.3 RPG that was deliberately removed | n/a |

---

## 5. Zero-cost go-to-market (solo, Singapore)

### 5.1 Channels
- **Reddit (value first, rules first).** r/Fitness allows ads only in the weekly *Self-Promotion Saturday* thread and asks creators to message the moderators before posting their own content (via a mirror, **secondary**) [26]. r/bodyweightfitness reportedly permits only fully free apps (**secondary**) [26]. r/singapore and r/askSingapore remove undisclosed promotion quickly (**secondary**) [27]. Approach: answer "how do you track lifts?" threads, show a Notes screenshot next to the AdaptFit weekly review, and disclose that you built it. AdaptFit being free helps.
- **r/weightroom, r/SingaporeRaw, r/SGfitness (unverified).** Check each sidebar first.
- **Local gyms.** Start with ActiveSG gyms (one planned per residential town) [28], plus independent strength gyms and PT studios. Offer PTs a free "client notebook" trial (export a client's week as text) in return for feedback.
- **TikTok / Instagram Reels.** Content format: "My gym notes vs what they actually say", pasting a messy Apple Note and getting a clean week with a plateau flag. Film at a Singapore gym; hawker-protein Fuel clips as a local hook.
- **Product Hunt / Indie Hackers.** Launch after the 30-day validation. The Bram post [16] shows the category gets attention, and you will want retention numbers to quote.
- **Where competitors are discussed.** AlternativeTo listings for Hevy and Strong, and "Hevy alternative" threads.

### 5.2 30-day validation plan

| Days | Actions |
|---|---|
| 1–3 | Host on HTTPS (for example Cloudflare Pages). Add privacy-safe counting: a manual "Send anonymous stats" button that sends a text summary with no identifiers, or an opt-in survey link. Write a one-page site using the positioning statement. |
| 4–7 | Recruit **15–20 Singapore lifters who already use Notes** (friends, gym, r/SingaporeRaw). Run five 20-minute sessions watching them paste their own notes, and time the weekly update (the <60 s target is still untested). |
| 8–14 | Fix the top 3 parser and UX failures. Post one Reddit value comment a day and one TikTok/Reel every two days. |
| 15–21 | Everyone confirms their **2nd and 3rd week**. Send a short survey: "How disappointed would you be…?", "What would you pay for?" |
| 22–30 | Post to r/Fitness Self-Promotion Saturday [26] and local Telegram/WhatsApp gym groups. Decide: continue, change course, or package with Capacitor. |

### 5.3 Metrics that would show it's working (targets are proposals)
1. **Activation:** % of new users who import or write a plan *and* confirm week 1. Target ≥50%.
2. **Habit:** % of activated users who confirm week 2 (target ≥40%) and week 4 (target ≥25%).
3. **Import quality:** % of pasted notes imported with ≤2 questions and no manual retyping. Target ≥60%.
4. **Speed:** median human time for the weekly update. Target <60 s.
5. **Pull:** unprompted referrals or "switched from Notes/Hevy" messages (target ≥5), and ≥30% "very disappointed".

---

## Sources (all accessed 2026-11-09)

1. Strong, US App Store: https://apps.apple.com/us/app/id464254577
2. Hevy, US App Store: https://apps.apple.com/us/app/id1458862350
3. SensAI, *Hevy review 2026* (free-tier caps, secondary): https://www.sensai.fit/blog/hevy-review-2026
4. App Pricing Lab, JEFIT in-app purchases (secondary): https://apppricinglab.com/app/apple/449810000; Boostcamp, *Boostcamp vs JEFIT* (ads): https://www.boostcamp.app/vs/jefit
5. Android Authority / WhistleOut, *FitNotes review* (secondary; the page returned 403 on direct fetch, so details come from search snippets): https://cellphoneplans.androidauthority.com/CellPhones/Guides/fitnotes-app-review
6. SensAI, *Fitbod review 2026* (secondary): https://www.sensai.fit/blog/fitbod-review-2026
7. Alpha Progression blog (developer): https://alphaprogression.com/en/blog/alpha-progression-vs-hevy
8. Boostcamp, *Is Boostcamp free?*: https://www.boostcamp.app/is-boostcamp-free
9. Dr. Muscle, *RP Hypertrophy app review* (secondary): https://dr-muscle.com/rp-hypertrophy-app-review/; RP Hypertrophy App Store listing: https://apps.apple.com/gb/app/id1555614554
10. SensAI, *Liftosaur review* (secondary): https://www.sensai.fit/blog/liftosaur-review
11. Liftosaur, Liftoscript docs: https://www.liftosaur.com/doc/liftoscript
12. StrongLifts, US App Store: https://apps.apple.com/us/app/id488580022
13. GymNote+, US App Store: https://apps.apple.com/us/app/gym-note-plus-fitness-journal/id6746699616
13a. Gymshark support, *The Gymshark Training App*: https://support.gymshark.com/en-US/article/the-gymshark-training-app
13b. Tom's Guide, *Gymshark Training app review*: https://tomsguide.com/wellness/fitness/gymshark-training-app-review-effective-workouts-for-free
14. JimNotes listing, AppAdvice (secondary; the direct fetch failed): https://appadvice.com/app/jimnotes-ai-workout-notes/6752226490
15. GymGPT, US App Store: https://apps.apple.com/app/id6753924117
16. Product Hunt, *Bram – Workout Notes*: https://www.producthunt.com/p/bram-workout-notes/bram-workout-notes
17. *Workout Log GPT* listing: https://theresanaiforthat.com/gpt/workout-log-gpt/
18. TechRadar, *I've ditched my Apple Watch in the gym and just use my Notes app instead*: https://techradar.com/opinion/when-it-comes-to-lifting-weights-smartwatches-will-never-beat-a-simple-notes-app; TechRadar, spreadsheet piece: https://www.techradar.com/health-fitness/forget-whoop-apple-garmin-and-all-the-rest-when-it-comes-to-lifting-weights-ive-never-found-a-better-solution-than-a-spreadsheet (only the headlines could be read)
19. RevenueCat, *State of Subscription Apps 2025*: https://www.revenuecat.com/state-of-subscription-apps-2025/
20. Apple Newsroom, *App Store Small Business Program* (2020): https://www.apple.com/newsroom/2020/11/apple-announces-app-store-small-business-program/
21. Coachway, *Hevy Coach pricing* (secondary): https://coachway.io/articles/hevy-coach-pricing/
22. Airwallex, *Stripe review (Singapore)* (secondary, competitor-written): https://www.airwallex.com/sg/blog/stripe-review
23. WebKit Bug 194593, *Web Share Target API*: https://bugs.webkit.org/show_bug.cgi?id=194593
24. Search Engine Land, *Safari's 7-day cap on script-writeable storage*: https://searchengineland.com/what-safaris-7-day-cap-on-script-writeable-storage-means-for-pwa-developers-332519
25. Capawesome, *Capacitor Purchases plugin*: https://capawesome.io/docs/plugins/purchases/
26. r/Fitness wiki intro (mirror, secondary): https://reddit.rtrace.io/r/Fitness/wiki/intro; r/bodyweightfitness rules (mirror): https://lr.vern.cc/r/bodyweightfitness/wiki/rules
27. MarketingAgency.sg, *Marketing on r/singapore* (secondary): https://marketingagency.sg/reddit-singapore-marketing/
28. MCCY, *ActiveSG gym capacity* (parliamentary reply): https://www.mccy.gov.sg/about-us/news-and-resources/activesg-gym-capacity/; Mordor Intelligence, *SEA health & fitness club market* (attendances, secondary): https://mordorintelligence.com/industry-reports/southeast-asia-health-and-fitness-club-market
29. r/MacroFactor thread on logging workouts in Notes (mirror): https://redlib.hbubli.cc/r/MacroFactor/comments/1f8fvd5/whats_you_macrofactor_equivalent_for_logging
