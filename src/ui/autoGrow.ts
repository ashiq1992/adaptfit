import { type RefObject, useEffect, useLayoutEffect } from 'react';

/**
 * Size a textarea to its content, wrapped lines included, so there is never a
 * small box with its own inner scrollbar (awkward on a phone: two scroll areas
 * fight each other). The page scrolls instead. `minRows` comes from the
 * element's `rows` attribute.
 */
export function fitToContent(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = 'auto';
  const borders = el.offsetHeight - el.clientHeight;
  const next = el.scrollHeight + borders;
  if (next > 0) el.style.height = `${next}px`;
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
