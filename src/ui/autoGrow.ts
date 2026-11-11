import { type RefObject, useEffect, useLayoutEffect } from 'react';

/**
 * Size a textarea to its content, wrapped lines included, so there is never a
 * small box with its own inner scrollbar (awkward on a phone: two scroll areas
 * fight each other). The page scrolls instead. `minRows` comes from the
 * element's `rows` attribute.
 */
export function fitToContent(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  // Measuring collapses the box for a moment. Near the end of a long note that
  // shortens the page and the browser pulls the scroll position up (the screen
  // "jumps to the top" while typing). Hold the page's height and scroll still.
  const y = window.scrollY;
  const page = document.scrollingElement as HTMLElement | null;
  const hold = page ? page.style.minHeight : '';
  if (page) page.style.minHeight = `${page.scrollHeight}px`;
  el.style.height = 'auto';
  const borders = el.offsetHeight - el.clientHeight;
  const next = el.scrollHeight + borders;
  if (next > 0) el.style.height = `${next}px`;
  if (page) page.style.minHeight = hold;
  if (window.scrollY !== y) window.scrollTo(window.scrollX, y);
}

export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string, enabled = true): void {
  useLayoutEffect(() => {
    if (enabled) fitToContent(ref.current);
  }, [ref, value, enabled]);
  // Width changes (rotation, resize) re-wrap the text.
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof ResizeObserver === 'undefined') return;
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth;
        fitToContent(el);
      }
    });
    ro.observe(el);
    // The bundled fonts can arrive after the first measurement and change line heights.
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) fitToContent(el);
    });
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [ref, enabled]);
}

/** Height of the on-screen keyboard (0 when closed or unknown). */
export function keyboardHeight(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  const h = window.innerHeight - vv.height;
  // Pinch zoom also shrinks the visual viewport: only count it at normal zoom.
  return vv.scale > 1.01 || h < 80 ? 0 : Math.round(h);
}

/**
 * While an editor is open, add the keyboard's height as space at the bottom of
 * the page (--kb), so the last lines of a long note can be scrolled above the
 * keyboard instead of staying hidden behind it.
 */
export function useKeyboardSpace(): void {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    const update = () => root.style.setProperty('--kb', `${keyboardHeight()}px`);
    update();
    vv?.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      root.style.removeProperty('--kb');
    };
  }, []);
}

/** Whether the caret is at the very end of the text (typing there grows the box downwards). */
export function caretAtEnd(el: HTMLTextAreaElement | HTMLInputElement | null): boolean {
  return !!el && el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
}

/**
 * Keep an element (an editor's Done/Cancel row) inside the visible part of the
 * screen while the on-screen keyboard is open. Uses the visual viewport, which
 * shrinks when the keyboard appears on iOS and Android.
 */
export function keepInView(el: Element | null | undefined): void {
  if (!el) return;
  const vv = window.visualViewport;
  const r = el.getBoundingClientRect();
  const top = vv ? vv.offsetTop : 0;
  const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  if (r.bottom > bottom || r.top < top) el.scrollIntoView?.({ block: 'nearest' });
}
