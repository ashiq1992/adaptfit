import { type ReactNode, useSyncExternalStore } from 'react';
import { IconBack, IconGear } from './icons';

export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb);
      window.addEventListener('offline', cb);
      return () => {
        window.removeEventListener('online', cb);
        window.removeEventListener('offline', cb);
      };
    },
    () => navigator.onLine,
  );
}

/**
 * Screen header: a slim bar (back link or settings) and a large title, like a
 * native app. Main tabs show the settings icon top-right.
 */
export function ScreenHeader({
  title,
  subtitle,
  back,
  actions,
  settings,
  kicker,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  settings?: boolean;
  /** Small mono label on the left of the bar when there is no back link. */
  kicker?: ReactNode;
}) {
  const online = useOnline();
  return (
    <header className="screen-header">
      <div className="screen-bar">
        {back ? (
          <a href={back.href} className="bar-back">
            <IconBack />
            <span>{back.label}</span>
          </a>
        ) : kicker ? (
          <span className="bar-date">{kicker}</span>
        ) : (
          <span />
        )}
        <div className="bar-actions">
          {!online && (
            <span className="chip chip-warn" data-testid="offline-pill">
              Offline
            </span>
          )}
          {actions}
          {settings && (
            <a href="#/settings" className="btn btn-ghost btn-icon bar-settings" aria-label="Settings">
              <IconGear />
            </a>
          )}
        </div>
      </div>
      <h1 tabIndex={-1}>{title}</h1>
      {subtitle && <p className="screen-subtitle">{subtitle}</p>}
    </header>
  );
}
