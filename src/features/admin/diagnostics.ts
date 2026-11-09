/**
 * Pure helpers for the on-device Admin page. Nothing here touches the network:
 * the page describes this browser and this device's IndexedDB only.
 */

/** The minimal shape of each stored record the summary needs (all optional dates). */
export interface DiagnosticsInput {
  profiles: { createdAt?: string; updatedAt?: string }[];
  /** Workout notes / programmes. */
  programmes: { createdAt?: string; updatedAt?: string }[];
  trainingWeeks: { status: 'draft' | 'confirmed'; createdAt?: string; updatedAt?: string; confirmedAt?: string | null }[];
  sessions: { startedAt?: string; updatedAt?: string; completedAt?: string | null }[];
  imports: { createdAt?: string }[];
  bodyweights: { createdAt?: string; updatedAt?: string }[];
  noteRevisions: { at?: string }[];
}

export interface DeviceSummary {
  counts: {
    profiles: number;
    programmes: number;
    weeksConfirmed: number;
    weeksDraft: number;
    sessions: number;
    imports: number;
    bodyweights: number;
    noteRevisions: number;
  };
  /** Earliest timestamp found in any stored record (ISO), or null when empty. */
  firstUse: string | null;
  /** Latest timestamp found in any stored record (ISO), or null when empty. */
  lastActivity: string | null;
}

function validIso(x: unknown): x is string {
  return typeof x === 'string' && x.length >= 10 && !Number.isNaN(Date.parse(x));
}

/** Counts per record type and the first/last dates derived from stored timestamps. */
export function summariseDevice(input: DiagnosticsInput): DeviceSummary {
  const stamps: string[] = [];
  const add = (...xs: unknown[]) => {
    for (const x of xs) if (validIso(x)) stamps.push(x);
  };
  input.profiles.forEach((r) => add(r.createdAt, r.updatedAt));
  input.programmes.forEach((r) => add(r.createdAt, r.updatedAt));
  input.trainingWeeks.forEach((r) => add(r.createdAt, r.updatedAt, r.confirmedAt));
  input.sessions.forEach((r) => add(r.startedAt, r.updatedAt, r.completedAt));
  input.imports.forEach((r) => add(r.createdAt));
  input.bodyweights.forEach((r) => add(r.createdAt, r.updatedAt));
  input.noteRevisions.forEach((r) => add(r.at));
  let first: string | null = null;
  let last: string | null = null;
  let firstMs = Infinity;
  let lastMs = -Infinity;
  for (const s of stamps) {
    const ms = Date.parse(s);
    if (ms < firstMs) {
      firstMs = ms;
      first = s;
    }
    if (ms > lastMs) {
      lastMs = ms;
      last = s;
    }
  }
  return {
    counts: {
      profiles: input.profiles.length,
      programmes: input.programmes.length,
      weeksConfirmed: input.trainingWeeks.filter((w) => w.status === 'confirmed').length,
      weeksDraft: input.trainingWeeks.filter((w) => w.status === 'draft').length,
      sessions: input.sessions.length,
      imports: input.imports.length,
      bodyweights: input.bodyweights.length,
      noteRevisions: input.noteRevisions.length,
    },
    firstUse: first,
    lastActivity: last,
  };
}

/** Human-readable byte size, e.g. 1536 → "1.5 KB". */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return 'Unknown';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10} ${units[i]}`;
}

/** Short "Browser on OS" summary of a user-agent string (best effort, no fingerprinting). */
export function summariseUserAgent(ua: string): string {
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /CrOS/.test(ua)
            ? 'ChromeOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Unknown OS';
  let browser = 'Unknown browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/SamsungBrowser\//.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox\/|FxiOS\//.test(ua)) browser = 'Firefox';
  else if (/CriOS\//.test(ua)) browser = 'Chrome';
  else if (/HeadlessChrome\//.test(ua)) browser = 'Chrome (headless)';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'Safari';
  else if (/AppleWebKit\//.test(ua) && os === 'iOS') browser = 'Safari (home-screen app)';
  return `${browser} on ${os}`;
}

/** Format an ISO timestamp as a readable local date and time, or a dash. */
export function formatWhen(iso: string | null, locale?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
