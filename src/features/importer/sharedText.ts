/**
 * Text shared into AdaptFit from another app (Android: Notes/Keep → Share →
 * AdaptFit, via the manifest's share_target), arriving as `?title=&text=&url=`.
 * It is moved into session storage and the address is cleaned up, then the
 * Import screen picks it up. Nothing is sent anywhere.
 */
const KEY = 'adaptfit:shared-text';

export function sharedTextFrom(search: string): string | null {
  const p = new URLSearchParams(search);
  const title = p.get('title')?.trim() ?? '';
  const text = p.get('text')?.trim() ?? '';
  const url = p.get('url')?.trim() ?? '';
  const parts: string[] = [];
  // Many apps send the note's first line as the title too: don't repeat it.
  if (title && !text.startsWith(title)) parts.push(title);
  if (text) parts.push(text);
  if (url && !text.includes(url)) parts.push(url);
  const joined = parts.join('\n').trim();
  return joined ? joined : null;
}

/** Called once at start-up. Returns true when shared text was found (the app then opens Import). */
export function captureSharedText(): boolean {
  if (typeof window === 'undefined') return false;
  const text = sharedTextFrom(window.location.search);
  if (!text) return false;
  try {
    sessionStorage.setItem(KEY, text);
  } catch {
    return false;
  }
  window.history.replaceState(null, '', `${window.location.pathname}#/import`);
  return true;
}

export function peekSharedText(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearSharedText(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
