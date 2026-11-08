import type { ReactNode } from 'react';

interface P {
  size?: number;
  className?: string;
}

function I({ size = 22, className, children, fill }: P & { children: ReactNode; fill?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

/** AdaptFit mark: an upward chevron over a dumbbell (original glyph). */
export const Logo = ({ size = 26 }: P) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <path d="M9 13 16 5l7 8" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="3" y="16" width="4" height="12" rx="1.5" fill="currentColor" />
    <rect x="8" y="18" width="3" height="8" rx="1" fill="currentColor" />
    <rect x="11" y="21" width="10" height="2.6" rx="1" fill="currentColor" />
    <rect x="21" y="18" width="3" height="8" rx="1" fill="currentColor" />
    <rect x="25" y="16" width="4" height="12" rx="1.5" fill="currentColor" />
  </svg>
);

export const IconTrain = (p: P) => (
  <I {...p}>
    <path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />
  </I>
);
export const IconProgress = (p: P) => (
  <I {...p}>
    <path d="M5 20V12M10 20V6M15 20v-9M20 20V4" />
  </I>
);
export const IconCoach = (p: P) => (
  <I {...p}>
    <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h0V4Z" />
    <path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3V4Z" />
    <path d="M9 10h2M13 14h2" />
  </I>
);
export const IconJourney = (p: P) => (
  <I {...p}>
    <path d="M12 3 4 6v6c0 4.4 3.4 7.8 8 9 4.6-1.2 8-4.6 8-9V6l-8-3Z" />
    <path d="m12 8 1.2 2.6 2.8.3-2.1 1.9.6 2.8L12 14.2l-2.5 1.4.6-2.8L8 10.9l2.8-.3L12 8Z" />
  </I>
);
export const IconGear = (p: P) => (
  <I {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </I>
);
export const IconPlay = (p: P) => (
  <I {...p} fill>
    <path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5Z" />
  </I>
);
export const IconPause = (p: P) => (
  <I {...p}>
    <path d="M9 5v14M15 5v14" />
  </I>
);
export const IconCheck = (p: P) => (
  <I {...p}>
    <path d="M20 6 9 17l-5-5" />
  </I>
);
export const IconPlus = (p: P) => (
  <I {...p}>
    <path d="M12 5v14M5 12h14" />
  </I>
);
export const IconMinus = (p: P) => (
  <I {...p}>
    <path d="M5 12h14" />
  </I>
);
export const IconChevronRight = (p: P) => (
  <I {...p}>
    <path d="m9 6 6 6-6 6" />
  </I>
);
export const IconChevronDown = (p: P) => (
  <I {...p}>
    <path d="m6 9 6 6 6-6" />
  </I>
);
export const IconBack = (p: P) => (
  <I {...p}>
    <path d="M15 18 9 12l6-6" />
  </I>
);
export const IconMore = (p: P) => (
  <I {...p} fill>
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </I>
);
export const IconUp = (p: P) => (
  <I {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </I>
);
export const IconDown = (p: P) => (
  <I {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </I>
);
export const IconDash = (p: P) => (
  <I {...p}>
    <path d="M6 12h12" />
  </I>
);
export const IconCalendar = (p: P) => (
  <I {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </I>
);
export const IconMoon = (p: P) => (
  <I {...p}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </I>
);
export const IconFlame = (p: P) => (
  <I {...p}>
    <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3.5-1-6 1-8.5Z" />
  </I>
);
export const IconTrophy = (p: P) => (
  <I {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6v4" />
  </I>
);
export const IconBolt = (p: P) => (
  <I {...p}>
    <path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" />
  </I>
);
export const IconRunner = (p: P) => (
  <I {...p}>
    <circle cx="14" cy="4.5" r="1.8" />
    <path d="M9 21l2.5-5.5L14 17v4M7.5 11.5 10 9l3 1 2 3h3M10 9l1.5 6.5" />
  </I>
);
export const IconCross = (p: P) => (
  <I {...p} fill>
    <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z" />
  </I>
);
export const IconFlex = (p: P) => (
  <I {...p}>
    <path d="M5 19c3 1 9 1 13-2 2-1.5 2-5-1-6-2-.6-3.5.5-4 1.5L11 9l2-3-3-2-3 4-2 6v5Z" />
  </I>
);
export const IconStar = (p: P) => (
  <I {...p} fill>
    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
  </I>
);
export const IconLock = (p: P) => (
  <I {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </I>
);
export const IconFilter = (p: P) => (
  <I {...p}>
    <path d="M4 5h16l-6 8v6l-4-2v-4L4 5Z" />
  </I>
);
export const IconEdit = (p: P) => (
  <I {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />
  </I>
);
export const IconTrash = (p: P) => (
  <I {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </I>
);
export const IconRepeat = (p: P) => (
  <I {...p}>
    <path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
  </I>
);
export const IconClock = (p: P) => (
  <I {...p}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2M9 2h6" />
  </I>
);
export const IconSpark = (p: P) => (
  <I {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </I>
);
export const IconNotes = (p: P) => (
  <I {...p}>
    <path d="M6 3h9l4 4v14H6V3Z" />
    <path d="M14 3v5h5M9 13h7M9 17h5" />
  </I>
);
export const IconUser = (p: P) => (
  <I {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </I>
);
export const IconBriefcase = (p: P) => (
  <I {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V4h6v3M3 13h18" />
  </I>
);
export const IconUtensils = (p: P) => (
  <I {...p}>
    <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 2-3 6s1 4 3 4v8" />
  </I>
);
export const IconDatabase = (p: P) => (
  <I {...p}>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </I>
);
export const IconShield = (p: P) => (
  <I {...p}>
    <path d="M12 3 4 6v6c0 4.4 3.4 7.8 8 9 4.6-1.2 8-4.6 8-9V6l-8-3Z" />
  </I>
);
export const IconGame = (p: P) => (
  <I {...p}>
    <rect x="2" y="7" width="20" height="11" rx="4" />
    <path d="M7 11v3M5.5 12.5h3M15 12h.01M18 13h.01" />
  </I>
);
export const IconInfo = (p: P) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5h.01" />
  </I>
);
export const IconGem = (p: P) => (
  <I {...p}>
    <path d="M6 3h12l3 6-9 12L3 9l3-6ZM3 9h18M12 21 8 9l4-6 4 6-4 12" />
  </I>
);
export const IconScroll = (p: P) => (
  <I {...p}>
    <path d="M8 3h11v15a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2h11v2a3 3 0 0 0 3 3M8 3a3 3 0 0 0-3 3v10M11 8h5M11 12h5" />
  </I>
);
