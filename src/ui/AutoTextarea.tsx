import { type TextareaHTMLAttributes, useRef } from 'react';
import { useAutoGrow } from './autoGrow';

/** A textarea that grows with its text (wrapped lines included) instead of scrolling inside itself. */
export function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(ref, props.value);
  return <textarea {...props} ref={ref} className={`${props.className ?? ''} autogrow`.trim()} />;
}
