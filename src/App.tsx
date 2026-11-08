import { lazy, Suspense, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useAppData, useRpg, useToday } from './data/useAppData';
import { HomeScreen } from './features/train/HomeScreen';
import { WorkoutScreen } from './features/workout/WorkoutScreen';
import { refreshToUpdate, usePwa } from './pwa';
import { AnnouncerProvider } from './ui/Announcer';
import { AppContext, type AppContextValue } from './ui/DataContext';
import { useHash } from './ui/hooks';
import { IconCoach, IconGear, IconJourney, IconProgress, IconTrain, Logo } from './ui/icons';

// Less-frequent screens load on demand; Train and Workout stay in the main bundle.
const CoachScreen = lazy(() => import('./features/coach/CoachScreen').then((m) => ({ default: m.CoachScreen })));
const HistoryScreen = lazy(() => import('./features/history/HistoryScreen').then((m) => ({ default: m.HistoryScreen })));
const ImportScreen = lazy(() => import('./features/importer/ImportScreen').then((m) => ({ default: m.ImportScreen })));
const JourneyScreen = lazy(() => import('./features/journey/JourneyScreen').then((m) => ({ default: m.JourneyScreen })));
const Onboarding = lazy(() => import('./features/onboarding/Onboarding').then((m) => ({ default: m.Onboarding })));
const GuidedProgramme = lazy(() => import('./features/programmes/GuidedProgramme').then((m) => ({ default: m.GuidedProgramme })));
const ProgrammeEditor = lazy(() => import('./features/programmes/ProgrammeEditor').then((m) => ({ default: m.ProgrammeEditor })));
const ProgressScreen = lazy(() => import('./features/progress/ProgressScreen').then((m) => ({ default: m.ProgressScreen })));
const SettingsScreen = lazy(() => import('./features/settings/SettingsScreen').then((m) => ({ default: m.SettingsScreen })));
const FinishedScreen = lazy(() => import('./features/workout/FinishedScreen').then((m) => ({ default: m.FinishedScreen })));

export type Route =
  | { name: 'train' }
  | { name: 'history' }
  | { name: 'workout' }
  | { name: 'done'; id: string }
  | { name: 'progress' }
  | { name: 'coach'; tab: string | null }
  | { name: 'journey' }
  | { name: 'settings' }
  | { name: 'programme'; id: string; openImport?: boolean }
  | { name: 'guide' }
  | { name: 'import' };

export function parseRoute(hash: string): Route {
  const [, a, b] = (hash.replace(/^#/, '') || '/train').split('/');
  switch (a) {
    case 'train':
      return b === 'history' ? { name: 'history' } : { name: 'train' };
    case 'history':
      return { name: 'history' };
    case 'workout':
      return { name: 'workout' };
    case 'done':
      return b ? { name: 'done', id: decodeURIComponent(b) } : { name: 'train' };
    case 'progress':
      return { name: 'progress' };
    case 'coach':
      return { name: 'coach', tab: b ?? null };
    case 'journey':
      return { name: 'journey' };
    case 'settings':
      return { name: 'settings' };
    case 'programmes':
      if (b === 'guide') return { name: 'guide' };
      if (b === 'import') return { name: 'programme', id: 'new', openImport: true };
      return { name: 'programme', id: b ? decodeURIComponent(b) : 'new' };
    case 'import':
      return { name: 'import' };
    default:
      return { name: 'train' };
  }
}

type Tab = 'train' | 'progress' | 'coach' | 'journey';

function tabOf(r: Route): Tab | null {
  if (r.name === 'train' || r.name === 'history' || r.name === 'done' || r.name === 'import') return 'train';
  if (r.name === 'progress') return 'progress';
  if (r.name === 'coach') return 'coach';
  if (r.name === 'journey') return 'journey';
  return null;
}

export function App() {
  return (
    <AnnouncerProvider>
      <Shell />
    </AnnouncerProvider>
  );
}

function Shell() {
  const live = useAppData();
  const route = parseRoute(useHash());
  const today = useToday(live.data?.profile);
  const rpg = useRpg(live.data, today);
  const mainRef = useRef<HTMLElement>(null);

  // Move focus to the new screen's heading for keyboard and screen-reader users.
  const routeKey = route.name;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.querySelector<HTMLElement>('h1')?.focus();
    window.scrollTo({ top: 0 });
  }, [routeKey]);

  const ctx = useMemo<AppContextValue | null>(
    () => (live.data?.profile && rpg ? { data: { ...live.data, profile: live.data.profile }, today, rpg } : null),
    [live.data, today, rpg],
  );

  if (live.loading) {
    return (
      <div className="app-loading" role="status">
        Loading AdaptFit…
      </div>
    );
  }
  if (live.error) {
    return (
      <div className="app-loading" role="alert">
        AdaptFit couldn't open its on-device storage. Private browsing or disabled site data can cause this. Reload to try again.
      </div>
    );
  }
  if (!ctx)
    return (
      <Suspense fallback={<div className="app-loading">Loading…</div>}>
        <Onboarding />
      </Suspense>
    );

  const inWorkout = route.name === 'workout';
  const tab = tabOf(route);

  return (
    <AppContext.Provider value={ctx}>
      <div className={`app ${inWorkout ? 'app-focused' : ''}`}>
        <a
          className="skip-link"
          href="#main"
          onClick={(e) => {
            e.preventDefault();
            mainRef.current?.querySelector<HTMLElement>('h1')?.focus();
          }}
        >
          Skip to content
        </a>
        {!inWorkout && <Header />}
        <main id="main" ref={mainRef} className="main">
          <Suspense fallback={<p className="muted">Loading…</p>}>
          {route.name === 'train' && <HomeScreen />}
          {route.name === 'history' && <HistoryScreen />}
          {route.name === 'workout' && <WorkoutScreen />}
          {route.name === 'done' && <FinishedScreen id={route.id} />}
          {route.name === 'progress' && <ProgressScreen />}
          {route.name === 'coach' && <CoachScreen tab={route.tab} />}
          {route.name === 'journey' && <JourneyScreen />}
          {route.name === 'settings' && <SettingsScreen />}
          {route.name === 'programme' && <ProgrammeEditor id={route.id} openImport={route.openImport} />}
          {route.name === 'guide' && <GuidedProgramme />}
          {route.name === 'import' && <ImportScreen />}
          </Suspense>
        </main>
        {!inWorkout && <Nav current={tab} hasActive={!!ctx.data.active} />}
      </div>
    </AppContext.Provider>
  );
}

function Header() {
  const pwa = usePwa();
  const online = useOnline();
  let status: [string, string];
  if (!online) status = pwa.offlineReady ? ['Offline · ready', 'chip-ok'] : ['Offline', 'chip-warn'];
  else if (pwa.offlineReady) status = ['Offline ready', 'chip-ok'];
  else if (pwa.supported) status = ['Preparing offline…', 'chip-muted'];
  else status = ['Online only', 'chip-muted'];
  return (
    <>
      <header className="topbar">
        <a href="#/train" className="brand" aria-label="AdaptFit — Train">
          <Logo />
          <span>
            Adapt<span className="brand-fit">Fit</span>
          </span>
        </a>
        <div className="topbar-right">
          <span className={`chip ${status[1]}`} data-testid="offline-status" data-offline-ready={pwa.offlineReady ? 'true' : 'false'}>
            {status[0]}
          </span>
          <a href="#/settings" className="btn btn-ghost btn-icon" aria-label="Profile and settings">
            <IconGear />
          </a>
        </div>
      </header>
      {pwa.needRefresh && (
        <div className="update-banner" role="region" aria-label="Update available">
          <span>A new version of AdaptFit is ready.</span>
          <button type="button" className="btn btn-tertiary btn-sm" onClick={refreshToUpdate}>
            Refresh
          </button>
        </div>
      )}
    </>
  );
}

function useOnline(): boolean {
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

function Nav({ current, hasActive }: { current: Tab | null; hasActive: boolean }) {
  const items = [
    { id: 'train', label: 'Train', href: '#/train', icon: <IconTrain /> },
    { id: 'progress', label: 'Progress', href: '#/progress', icon: <IconProgress /> },
    { id: 'coach', label: 'Coach', href: '#/coach', icon: <IconCoach /> },
    { id: 'journey', label: 'Journey', href: '#/journey', icon: <IconJourney /> },
  ] as const;
  return (
    <nav className="bottomnav" aria-label="Main">
      {items.map((i) => (
        <a key={i.id} href={i.href} className="nav-item" aria-current={current === i.id ? 'page' : undefined}>
          {i.icon}
          <span>{i.label}</span>
          {i.id === 'train' && hasActive && <span className="nav-dot" aria-label="Workout in progress" />}
        </a>
      ))}
    </nav>
  );
}
