import { useEffect } from 'react';

const TEXT_INPUT = /^(text|number|search|tel|url|email|password|date|decimal)$/;

function isTextField(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return TEXT_INPUT.test(el.type || 'text');
  return el.isContentEditable;
}

/**
 * Mobile keyboard handling (no permanent background work, just browser events):
 * - while a text field is focused, `html.kb-open` is set so the bottom
 *   navigation steps aside and cannot cover the field or its buttons;
 * - when the visual viewport shrinks (keyboard opens), the focused field is
 *   scrolled into the visible area.
 */
export function useKeyboardAwareness(): void {
  useEffect(() => {
    const root = document.documentElement;
    let timer: number | undefined;
    const reveal = () => {
      const el = document.activeElement;
      if (!isTextField(el)) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => el.scrollIntoView?.({ block: 'center', behavior: 'auto' }), 60);
    };
    const onIn = (e: FocusEvent) => {
      if (!isTextField(e.target)) return;
      root.classList.add('kb-open');
      reveal();
    };
    const onOut = () => {
      // Focus may move straight to another field; check after it settles.
      window.setTimeout(() => {
        if (!isTextField(document.activeElement)) root.classList.remove('kb-open');
      }, 0);
    };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    window.visualViewport?.addEventListener('resize', reveal);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
      window.visualViewport?.removeEventListener('resize', reveal);
      window.clearTimeout(timer);
      root.classList.remove('kb-open');
    };
  }, []);
}
