import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { caretAtEnd, keepInView, useAutoGrow, useKeyboardSpace } from '../../ui/autoGrow';

const DRAFT_PREFIX = 'adaptfit:draft:';

/** Unsaved text for an open editor, kept synchronously so a refresh, lock or crash can't lose it. */
export function readDraft(key: string): string | null {
  try {
    return window.localStorage.getItem(DRAFT_PREFIX + key);
  } catch {
    return null;
  }
}

export function writeDraft(key: string, text: string | null): void {
  try {
    if (text === null) window.localStorage.removeItem(DRAFT_PREFIX + key);
    else window.localStorage.setItem(DRAFT_PREFIX + key, text);
  } catch {
    // Storage full or blocked: the editor still works, the text just isn't mirrored.
  }
}

/** All pending drafts whose key starts with `prefix` (e.g. one note). */
export function listDrafts(prefix: string): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(DRAFT_PREFIX + prefix)) out.push({ key: k.slice(DRAFT_PREFIX.length), text: window.localStorage.getItem(k) ?? '' });
    }
  } catch {
    /* ignore */
  }
  return out;
}

/**
 * Notes-style inline editor. Text is mirrored to local storage on every
 * keystroke and committed when the user taps Done, leaves the field, switches
 * app, or locks the phone.
 */
export function BlockEditor({
  initial,
  draftKey,
  label,
  onCommit,
  onCancel,
  toolbar,
  restored,
  minRows = 2,
  hint,
  single,
}: {
  initial: string;
  draftKey: string;
  label: string;
  /** Persist the text. `closing` is false when saving because the app was hidden. */
  onCommit: (text: string, closing: boolean) => void | Promise<void>;
  onCancel: () => void;
  toolbar?: ReactNode;
  restored?: boolean;
  minRows?: number;
  hint?: ReactNode;
  single?: boolean;
}) {
  const [text, setText] = useState(() => readDraft(draftKey) ?? initial);
  const committed = useRef(initial);
  const textRef = useRef(text);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const done = useRef(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useAutoGrow(ref, text, !single);
  useKeyboardSpace();

  useEffect(() => {
    textRef.current = text;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const len = el.value.length;
    el.setSelectionRange?.(len, len);
    // Bring the end of the text and Done into view; again once the keyboard has
    // opened. Only right after opening: later the user scrolls where they want to
    // edit, and the screen must not be pulled back down.
    keepInView(toolbarRef.current);
    const vv = window.visualViewport;
    const opened = Date.now();
    const onResize = () => {
      if (Date.now() - opened < 1500 && caretAtEnd(ref.current)) keepInView(toolbarRef.current);
    };
    vv?.addEventListener('resize', onResize);
    return () => vv?.removeEventListener('resize', onResize);
  }, []);

  // Save when the app is hidden (phone locked, app switched, tab changed).
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden' && textRef.current !== committed.current) {
        committed.current = textRef.current;
        void onCommit(textRef.current, false);
      }
    };
    const pagehide = () => {
      if (textRef.current !== committed.current) {
        committed.current = textRef.current;
        void onCommit(textRef.current, false);
      }
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', pagehide);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', pagehide);
    };
  }, [onCommit]);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    writeDraft(draftKey, null);
    void onCommit(textRef.current, true);
  };

  const rows = Math.max(minRows, text.split('\n').length + (single ? 0 : 1));
  const common = {
    ref,
    value: text,
    'aria-label': label,
    'aria-describedby': hint ? hintId : undefined,
    className: single ? 'note-input' : 'note-textarea',
    autoCapitalize: 'sentences' as const,
    spellCheck: false,
    onChange: (e: { target: { value: string } }) => {
      setText(e.target.value);
      writeDraft(draftKey, e.target.value);
      // Typing at the very end grows the box downwards: keep Done above the
      // keyboard. Typing anywhere else leaves the screen where the user put it.
      if (caretAtEnd(ref.current)) requestAnimationFrame(() => keepInView(toolbarRef.current));
    },
    onKeyDown: (e: { key: string; metaKey: boolean; ctrlKey: boolean; preventDefault: () => void }) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        done.current = true;
        writeDraft(draftKey, null);
        onCancel();
      } else if (e.key === 'Enter' && (single || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        finish();
      }
    },
  };

  return (
    <div
      className="block-editor"
      ref={wrapRef}
      onBlur={(e) => {
        // Leaving the editor (not moving between its own controls) saves it.
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) finish();
      }}
    >
      {restored && <p className="restored-note small">Restored your unsaved edit.</p>}
      {single ? <input {...common} type="text" enterKeyHint="done" /> : <textarea {...common} rows={rows} />}
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      <div className="block-toolbar" ref={toolbarRef}>
        {toolbar}
        <span className="grow" />
        <button
          type="button"
          className="btn btn-tertiary btn-sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            done.current = true;
            writeDraft(draftKey, null);
            onCancel();
          }}
        >
          Cancel
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={finish}>
          Done
        </button>
      </div>
    </div>
  );
}
