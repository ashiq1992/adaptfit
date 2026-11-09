import { useRef, useState } from 'react';
import { Dialog } from './Dialog';

/**
 * Show text to copy, with the phone's Share sheet when the browser offers one
 * (WhatsApp, Messages, Notes…). Nothing is sent anywhere by AdaptFit itself.
 */
export function CopyDialog({ text, title = 'Copy as text', label = 'Note text', shareTitle, onClose }: { text: string; title?: string; label?: string; shareTitle?: string; onClose: () => void }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual' | 'shared'>('idle');
  const ref = useRef<HTMLTextAreaElement>(null);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const copy = () => {
    const fallback = () => {
      ref.current?.select();
      setState('manual');
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => setState('copied'), fallback);
    else fallback();
  };
  const share = () => {
    navigator.share({ title: shareTitle ?? title, text }).then(
      () => setState('shared'),
      // Cancelled or refused: leave the dialog as it is.
      () => undefined,
    );
  };
  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-tertiary" onClick={onClose}>
            Close
          </button>
          {canShare && (
            <button type="button" className="btn btn-secondary" onClick={share}>
              Share…
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={copy}>
            Copy
          </button>
        </>
      }
    >
      <textarea ref={ref} className="textarea" readOnly value={text} rows={10} aria-label={label} />
      {state === 'copied' && <p className="success">Copied. Paste it into Notes or a message.</p>}
      {state === 'shared' && <p className="success">Shared.</p>}
      {state === 'manual' && <p className="small muted">Text selected — use your device’s Copy.</p>}
    </Dialog>
  );
}
