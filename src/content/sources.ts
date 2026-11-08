/**
 * Local source registry (V0.3). Records what informed AdaptFit's templates and
 * nutrition engine, when it was checked, and its licensing status. Research
 * happened during development; the app makes no network requests at runtime.
 *
 * status:
 * - accessed: page or data retrieved on the access date.
 * - not-retrievable: tried on the access date but the content couldn't be read.
 * - not-accessed: cited from established literature without retrieval this
 *   sprint — verify before relying on specific details.
 */
export interface SourceEntry {
  id: string;
  short: string;
  title: string;
  author: string;
  url: string;
  accessed: string | null;
  status: 'accessed' | 'not-retrievable' | 'not-accessed';
  evidence: string;
  licence: string;
  use: 'principles' | 'data' | 'not-used';
}

export const SOURCE_REGISTRY: readonly SourceEntry[] = [
  {
    id: 'thefitness-wiki',
    short: 'r/Fitness wiki routines page',
    title: 'Strength Training & Muscle Building routines',
    author: 'r/Fitness wiki contributors',
    url: 'https://thefitness.wiki/routines/strength-training-muscle-building/',
    accessed: '2026-11-06',
    status: 'accessed',
    evidence: 'Lists 3–6 day routines; stresses simple beginner programmes, linear progression, and that strength and size need no radically different methods.',
    licence: 'No licence stated on the page; some listed programmes are commercial. Used for general principles only — no text or programmes copied.',
    use: 'principles',
  },
  {
    id: 'boostcamp',
    short: 'Boostcamp free programmes page',
    title: 'Free workout app',
    author: 'Boostcamp',
    url: 'https://www.boostcamp.app/free-workout-app',
    accessed: '2026-11-06',
    status: 'accessed',
    evidence: 'Product page listing popular programmes (full-body, PPL, upper/lower). Confirms common split structures; no programming detail used.',
    licence: 'Proprietary app content; no reuse licence. Nothing copied.',
    use: 'principles',
  },
  {
    id: 'strengthlog-programs',
    short: 'StrengthLog programme library',
    title: 'Training programs',
    author: 'StrengthLog',
    url: 'https://www.strengthlog.com/training-programs/',
    accessed: '2026-11-06',
    status: 'accessed',
    evidence: 'Beginners 2–3 sessions/week, intermediate/advanced 3–6; full-body, upper/lower, PPL splits; progression by tracking load and reps.',
    licence: '© StrengthLog; no reuse licence. Used for general structure only — no programmes or text copied.',
    use: 'principles',
  },
  {
    id: 'pubmed-41843416',
    short: 'PubMed 41843416',
    title: 'PubMed record 41843416 (named in the sprint brief)',
    author: 'Unknown — record not retrievable',
    url: 'https://pubmed.ncbi.nlm.nih.gov/41843416/',
    accessed: '2026-11-06',
    status: 'not-retrievable',
    evidence: 'Not reviewed: the page required cookies for automated access and a web search did not resolve the ID. Nothing in AdaptFit depends on it.',
    licence: 'n/a',
    use: 'not-used',
  },
  {
    id: 'schoenfeld-volume-2017',
    short: 'Schoenfeld et al. 2017 (weekly volume)',
    title: 'Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis. J Sports Sci 35(11):1073–1082',
    author: 'Schoenfeld BJ, Ogborn D, Krieger JW',
    url: 'https://doi.org/10.1080/02640414.2016.1210197',
    accessed: null,
    status: 'not-accessed',
    evidence: 'More weekly sets per muscle are associated with greater hypertrophy; ~10+ weekly sets is a common reference. Informs template volume (about 6–16 sets per muscle per week).',
    licence: 'Journal article; cited, not reproduced.',
    use: 'principles',
  },
  {
    id: 'schoenfeld-frequency-2016',
    short: 'Schoenfeld et al. 2016 (frequency)',
    title: 'Effects of resistance training frequency on measures of muscle hypertrophy: a systematic review and meta-analysis. Sports Med 46(11):1689–1697',
    author: 'Schoenfeld BJ, Ogborn D, Krieger JW',
    url: 'https://doi.org/10.1007/s40279-016-0543-8',
    accessed: null,
    status: 'not-accessed',
    evidence: 'Training a muscle about twice a week is a reasonable default. Templates train each major muscle at least twice weekly where days allow.',
    licence: 'Journal article; cited, not reproduced.',
    use: 'principles',
  },
  {
    id: 'acsm-progression-2009',
    short: 'ACSM 2009 position stand',
    title: 'Progression models in resistance training for healthy adults. Med Sci Sports Exerc 41(3):687–708',
    author: 'American College of Sports Medicine',
    url: 'https://doi.org/10.1249/MSS.0b013e3181915670',
    accessed: null,
    status: 'not-accessed',
    evidence: 'Gradual progression; moderate rep ranges for hypertrophy; longer rests (2–3 min) for main multi-joint lifts. Informs rest periods and double progression.',
    licence: 'Journal article; cited, not reproduced.',
    use: 'principles',
  },
  {
    id: 'mifflin-1990',
    short: 'Mifflin et al. 1990',
    title: 'A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr 51(2):241–247',
    author: 'Mifflin MD, St Jeor ST, et al.',
    url: 'https://doi.org/10.1093/ajcn/51.2.241',
    accessed: null,
    status: 'not-accessed',
    evidence: 'Resting energy = 10×kg + 6.25×cm − 5×age + 5 (male) or − 161 (female). Used for adults only.',
    licence: 'Equation is a published scientific formula; cited.',
    use: 'principles',
  },
  {
    id: 'issn-protein-2017',
    short: 'ISSN protein position stand 2017',
    title: 'International Society of Sports Nutrition Position Stand: protein and exercise. J Int Soc Sports Nutr 14:20',
    author: 'Jäger R, Kerksick CM, et al.',
    url: 'https://doi.org/10.1186/s12970-017-0177-8',
    accessed: null,
    status: 'not-accessed',
    evidence: '1.4–2.0 g/kg/day is sufficient for most exercising people. AdaptFit suggests ranges inside this band.',
    licence: 'Open-access article (CC BY); cited, not reproduced.',
    use: 'principles',
  },
  {
    id: 'compendium-met',
    short: 'Compendium of Physical Activities',
    title: 'Compendium of Physical Activities (resistance training MET values)',
    author: 'Ainsworth BE, Herrmann SD, et al.',
    url: 'https://pacompendium.com/',
    accessed: null,
    status: 'not-accessed',
    evidence: 'Resistance training roughly 3.5–6 METs depending on effort; AdaptFit uses that range, minus resting energy, to avoid double-counting.',
    licence: 'Cited values only.',
    use: 'principles',
  },
  {
    id: 'usda-fdc',
    short: 'USDA FoodData Central',
    title: 'FoodData Central (SR Legacy)',
    author: 'U.S. Department of Agriculture, Agricultural Research Service',
    url: 'https://fdc.nal.usda.gov/',
    accessed: '2026-11-06',
    status: 'accessed',
    evidence: 'Per-100 g energy, protein, carbohydrate, and fat for home-recipe ingredients, retrieved via the FDC API with record IDs.',
    licence: 'Public domain, CC0 1.0 ("No permission is needed for their use"; source attribution requested).',
    use: 'data',
  },
  {
    id: 'hpb-sgfoodid',
    short: 'HPB SG FoodID',
    title: 'Singapore Food Insights Database (SG FoodID)',
    author: 'Health Promotion Board, Singapore',
    url: 'https://www.hpb.gov.sg/healthy-living/food-and-beverage/sgfoodid/',
    accessed: '2026-11-06',
    status: 'accessed',
    evidence: 'Local food composition for Singapore dishes (search and recipe tools). The page states no reuse or redistribution licence.',
    licence: 'No redistribution licence found — data NOT bundled. Hawker dishes therefore show "Nutrition estimate unavailable".',
    use: 'not-used',
  },
  {
    id: 'healthhub',
    short: 'HealthHub',
    title: 'HealthHub Singapore',
    author: 'Ministry of Health / Health Promotion Board',
    url: 'https://www.healthhub.sg/',
    accessed: null,
    status: 'not-accessed',
    evidence: 'Not reviewed this sprint; no content used.',
    licence: 'Not checked.',
    use: 'not-used',
  },
];

export const SOURCES_BY_ID: ReadonlyMap<string, SourceEntry> = new Map(SOURCE_REGISTRY.map((s) => [s.id, s]));
