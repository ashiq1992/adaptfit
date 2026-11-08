import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react';

type Announce = (message: string) => void;

const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

const AnnouncerContext = createContext<Announce>(() => {});

/** Screen-reader status announcements for meaningful updates. */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const counter = useRef(0);
  const announce = useCallback<Announce>((text) => {
    counter.current += 1;
    // Toggle a zero-width suffix so repeated identical messages are re-announced.
    setMessage(counter.current % 2 ? text : `${text}${ZERO_WIDTH_SPACE}`);
  }, []);
  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true" data-testid="announcer">
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnounce(): Announce {
  return useContext(AnnouncerContext);
}
