import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import { useAppData, useToday } from './data/useAppData';
import { PlanScreen } from './features/plan/PlanScreen';
import { NoteScreen } from './features/notes/NoteScreen';
import { refreshToUpdate, usePwa } from './pwa';
import { AnnouncerProvider } from './ui/Announcer';
import { AppContext, type AppContextValue } from './ui/DataContext';
import { useHash } from './ui/hooks';
import { IconCoach, IconNotes, IconProgress, Logo, Wordmark } from './ui/icons';
import { useKeyboardAwareness } from './ui/keyboard';
import { RestTimerBar } from './ui/RestTimerBar';

// Plan and the workout note are the everyday screens and stay in the main bundle.
const WeeklyScreen = lazy(() => import('./features/weekly/WeeklyScreen').then((m) => ({ default: m.WeeklyScreen })));
const PreviousWeeks = lazy(() => import('./features/weekly/PreviousWeeks').then((m) => ({ default: m.PreviousWeeks })));
const NotesImport = lazy(() => import('./features/importer/NotesImport').then((m) => ({ default: m.NotesImport })));
const LibraryScreen = lazy(() => import('./features/programmes/LibraryScreen').then((m) => ({ default: m.LibraryScreen })));
const GuidedProgramme = lazy(() => import('./features/programmes/GuidedProgramme').then((m) => ({ default: m.GuidedProgramme })));
const ProgrammeEditor = lazy(() => import('./features/programmes/ProgrammeEditor').then((m) => ({ default: m.ProgrammeEditor })));
const ProgressScreen = lazy(() => import('./features/progress/ProgressScreen').then((m) => ({ default: m.ProgressScreen })));
const CoachScreen = lazy(() => import('./features/coach/CoachScreen').then((m) => ({ default: m.CoachScreen })));
const SettingsScreen = lazy(() => import('./features/settings/SettingsScreen').then((m) => ({ default: m.SettingsScreen })));
const AdminScreen = lazy(() => import('./features/admin/AdminScreen').then((m) => ({ default: m.AdminScreen })));
const HistoryScreen = lazy(() => import('./features/history/HistoryScreen').then((m) => ({ default: m.HistoryScreen })));
const WorkoutScreen = lazy(() => import('./features/workout/WorkoutScreen').then((m) => ({ default: m.WorkoutScreen })));
const FinishedScreen = lazy(() => import('./features/workout/FinishedScreen').then((m) => ({ default: m.FinishedScreen })));
const Onboarding = lazy(() => import('./features/onboarding/Onboarding').then((m) => ({ default: m.Onboarding })));

export type Route =
  | { name: 'plan' }
  | { name: 'note'; id: string; dayId: string | null }
  | { name: 'week'; weekStart: string | null }
  | { name: 'weeks' }
  | { name: 'import' }
  | { name: 'library' }
  | { name: 'guide' }
  | { name: 'programme'; id: string }
  | { name: 'progress'; key: string | null }
  | { name: 'coach'; tab: string | null }
  | { name: 'settings' }
  | { name: 'admin' }
  | { name: 'history' }
  | { name: 'workout' }
  | { name: 'done'; id: string };

export function parseRoute(hash: string): Route {
  const [, a, b, c] = (hash.replace(/^#/, '').split('?')[0] || '/plan').split('/');
  const dec = (x: string | undefined) => (x ? decodeURIComponent(x) : null);
  switch (a) {
    case 'note':
      return b ? { name: 'note', id: dec(b)!, dayId: dec(c) } : { name: 'plan' };
    case 'week':
      return { name: 'week', weekStart: dec(b) };
    case 'weeks':
      return { name: 'weeks' };
    case 'import':
      return { name: 'import' };
    case 'library':
      return b === 'guide' ? { name: 'guide' } : { name: 'library' };
    case 'programmes':
      if (b === 'guide') return { name: 'guide' };
      if (b === 'import') return { name: 'import' };
      return b && b !== 'new' ? { name: 'programme', id: dec(b)! } : { name: 'library' };
    case 'progress':
      return { name: 'progress', key: dec(b) };
    case 'coach':
      return { name: 'coach', tab: b ?? null };
    case 'settings':
      return { name: 'settings' };
    case 'admin':
      return { name: 'admin' };
    case 'history':
      return { name: 'history' };
    case 'workout':
      return { name: 'workout' };
    case 'done':
      return b ? { name: 'done', id: dec(b)! } : { name: 'plan' };
    default:
      // V0.3 routes (#/train, #/journey) land on Plan.
      return { name: 'plan' };
  }
}

type Tab = 'plan' | 'progress' | 'coach';

function tabOf(r: Route): Tab | null {
  if (r.name === 'progress' || r.name === 'history') return 'progress';
  if (r.name === 'coach') return 'coach';
  if (r.name === 'workout' || r.name === 'settings' || r.name === 'admin') return null;
  return 'plan';
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
  const mainRef = useRef<HTMLElement>(null);
  useKeyboardAwareness();

  // Move focus to the new screen's heading for keyboard and screen-reader users.
  const routeKey = `${route.name}:${'id' in route ? route.id : ''}:${'dayId' in route ? (route.dayId ?? '') : ''}`;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // ...unless the new screen already put the cursor in a text box (an editor
    // reopened with unsaved text): taking focus from it would close the editor.
    const active = document.activeElement;
    const typing = !!active && mainRef.current?.contains(active) && active.matches('input, textarea, select, [contenteditable="true"]');
    if (!typing) mainRef.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [routeKey, route.name]);

  const ctx = useMemo<AppContextValue | null>(() => (live.data?.profile ? { data: { ...live.data, profile: live.data.profile }, today } : null), [live.data, today]);

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
  const coachDot = ctx.data.profile.notifications.coachFindings && ctx.data.recommendations.some((r) => r.status === 'open');

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
        <UpdateBanner />
        <main id="main" ref={mainRef} className="main">
          <Suspense fallback={<p className="muted">Loading…</p>}>
            {route.name === 'plan' && <PlanScreen />}
            {route.name === 'note' && <NoteScreen id={route.id} dayId={route.dayId} />}
            {route.name === 'week' && <WeeklyScreen weekStart={route.weekStart} />}
            {route.name === 'weeks' && <PreviousWeeks />}
            {route.name === 'import' && <NotesImport />}
            {route.name === 'library' && <LibraryScreen />}
            {route.name === 'guide' && <GuidedProgramme />}
            {route.name === 'programme' && <ProgrammeEditor id={route.id} />}
            {route.name === 'progress' && <ProgressScreen exerciseKey={route.key} />}
            {route.name === 'coach' && <CoachScreen tab={route.tab} />}
            {route.name === 'settings' && <SettingsScreen />}
            {route.name === 'admin' && <AdminScreen />}
            {route.name === 'history' && <HistoryScreen />}
            {route.name === 'workout' && <WorkoutScreen />}
            {route.name === 'done' && <FinishedScreen id={route.id} />}
          </Suspense>
        </main>
        {!inWorkout && <RestTimerBar />}
        {!inWorkout && <Nav current={tab} activeWorkout={!!ctx.data.active} coachDot={coachDot} />}
      </div>
    </AppContext.Provider>
  );
}

function UpdateBanner() {
  const pwa = usePwa();
  if (!pwa.needRefresh) return null;
  return (
    <div className="update-banner" role="region" aria-label="Update available">
      <span>A new version of AdaptFit is ready.</span>
      <button type="button" className="btn btn-secondary btn-sm" onClick={refreshToUpdate}>
        Refresh
      </button>
    </div>
  );
}

function Nav({ current, activeWorkout, coachDot }: { current: Tab | null; activeWorkout: boolean; coachDot: boolean }) {
  const items = [
    { id: 'plan', label: 'Plan', href: '#/plan', icon: <IconNotes /> },
    { id: 'progress', label: 'Progress', href: '#/progress', icon: <IconProgress /> },
    { id: 'coach', label: 'Coach', href: '#/coach', icon: <IconCoach /> },
  ] as const;
  return (
    <nav className="bottomnav" aria-label="Main">
      <a href="#/plan" className="nav-brand" aria-hidden="true" tabIndex={-1}>
        <Logo size={28} />
        <Wordmark />
      </a>
      {items.map((i) => (
        <a key={i.id} href={i.href} className="nav-item" aria-current={current === i.id ? 'page' : undefined}>
          {i.icon}
          <span>{i.label}</span>
          {i.id === 'plan' && activeWorkout && <span className="nav-dot" aria-label="Live log in progress" />}
          {i.id === 'coach' && coachDot && <span className="nav-dot" aria-label="New coach finding" />}
        </a>
      ))}
    </nav>
  );
}
