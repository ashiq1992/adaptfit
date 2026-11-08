# AdaptFit V0.3 — Research and source registry

The machine-readable registry is `src/content/sources.ts`, and per-food provenance is in `src/content/fdcNutrients.ts`. All research was done during development (2026-11-06). The app makes **no network requests at runtime**.

## Status key

- **Accessed:** the page or data was retrieved on the date shown.
- **Not retrievable:** access was attempted but the content couldn't be read.
- **Not accessed:** cited from established literature without retrieval this sprint. Verify before relying on specific details.

## Registry

| Source | Author | Accessed | Status | How it's used | Licence / reuse |
|---|---|---|---|---|---|
| thefitness.wiki — Strength training & muscle building routines | r/Fitness wiki | 2026-11-06 | Accessed | General principles: 3–6 day routines, simple beginner programmes, linear progression | No licence stated; some listed programmes are commercial. Nothing copied |
| Boostcamp — free workout app page | Boostcamp | 2026-11-06 | Accessed | Confirms common split types (full-body, PPL, upper/lower) | Proprietary; nothing copied |
| StrengthLog — training programs | StrengthLog | 2026-11-06 | Accessed | Frequency by experience (2–3 beginner, 3–6 intermediate+); split types; progression by tracking | © StrengthLog; nothing copied |
| PubMed 41843416 | — | 2026-11-06 | **Not retrievable** | Not used: the page required cookies for automated access and web search didn't resolve the ID | n/a |
| Schoenfeld, Ogborn, Krieger 2017, J Sports Sci 35(11) — weekly volume | — | — | Not accessed | ~10+ weekly sets per muscle as a hypertrophy reference; templates give ~6–16 | Cited only |
| Schoenfeld, Ogborn, Krieger 2016, Sports Med 46(11) — frequency | — | — | Not accessed | Train each muscle ≥ 2×/week where days allow | Cited only |
| ACSM 2009 position stand, Med Sci Sports Exerc 41(3) | ACSM | — | Not accessed | Gradual progression; 2–3 min rest on main lifts; double progression | Cited only |
| Mifflin et al. 1990, Am J Clin Nutr 51(2) | — | — | Not accessed | Resting energy equation (adults) | Formula cited |
| ISSN protein position stand 2017, JISSN 14:20 | Jäger et al. | — | Not accessed | 1.4–2.0 g/kg/day protein reference range | CC BY article; cited |
| Compendium of Physical Activities | Ainsworth, Herrmann et al. | — | Not accessed | Resistance training ~3.5–6 METs (net of rest) | Cited values |
| USDA FoodData Central (SR Legacy) | USDA ARS | 2026-11-06 | **Accessed (API)** | Per-100 g energy and macros for 9 ingredients (IDs in `fdcNutrients.ts`) | **Public domain, CC0 1.0** — "No permission is needed for their use"; attribution requested |
| HPB SG FoodID | Health Promotion Board | 2026-11-06 | Accessed (landing page) | **Not used for data** | No reuse or redistribution licence found → not bundled. Hawker dishes show "Nutrition estimate unavailable" |
| HealthHub | MOH / HPB | — | Not accessed | Not used | Not checked |

## FoodData Central retrieval log

- **Retrieved 2026-11-06 via the FDC search API (DEMO_KEY):**

  | FDC ID | Food |
  |---|---|
  | 171077 | Chicken breast, raw |
  | 173627 | Chicken thigh, raw |
  | 171287 | Egg, whole, raw |
  | 168878 | White rice, cooked |
  | 169704 | Brown rice, cooked |
  | 172475 | Firm tofu |
  | 175167 | Atlantic salmon, farmed, raw |
  | 175176 | Tilapia, raw |
  | 175179 | Shrimp, raw |

- **Not retrieved.** The DEMO_KEY rate limit was hit on the bulk request, so these candidate IDs are referenced in `ingredients.ts` but have **no values**:

  | FDC ID | Intended food |
  |---|---|
  | 170390 | Pak choi |
  | 170379 | Broccoli |
  | 173904 | Oats |
  | 170903 | Greek yogurt |
  | 173944 | Banana |
  | 172421 | Lentils |
  | 173757 | Chickpeas |
  | 170457 | Tomato |
  | 172336 | Canola oil |
  | 171413 | Olive oil |

  The app treats them as unsourced and excludes them from nutrition totals. To complete them, get a free key at <https://fdc.nal.usda.gov/api-key-signup> and run `FDC_API_KEY=… node scripts/fetch-fdc.mjs`. Then check each printed description matches the ingredient before committing; the candidate IDs haven't been verified.

## Programme content

All five starter templates are **original AdaptFit templates**, written from the general principles above. No proprietary programme, text, logo, or exercise illustration was reproduced.
