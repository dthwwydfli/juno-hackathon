import type { SVGProps } from 'react';

export type IconName =
  | 'profile' | 'qr' | 'share' | 'archive' | 'chevron' | 'back' | 'close' | 'check'
  | 'warning' | 'plus' | 'tablet' | 'capsule' | 'liquid' | 'inhaler' | 'injection'
  | 'camera' | 'sync' | 'search' | 'calendar' | 'clock' | 'edit' | 'lock' | 'faceid'
  | 'bell' | 'info' | 'external' | 'apple' | 'google' | 'nhs' | 'pill' | 'shield'
  | 'trash' | 'settings' | 'download' | 'link' | 'chevronDown' | 'home';

/** Stroke-based line icons on a 24×24 grid (matches the mockups). `google`/`apple` are filled and handled separately. */
const paths: Record<Exclude<IconName, 'apple' | 'google'>, React.ReactNode> = {
  profile: <><circle cx="12" cy="8" r="3.6" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1.4" /><rect x="14" y="3" width="7" height="7" rx="1.4" /><rect x="3" y="14" width="7" height="7" rx="1.4" /><path strokeWidth="2" d="M6.5 6.5h.01M17.5 6.5h.01M6.5 17.5h.01M14 14h.01M21 14h.01M17.5 17.5h.01M14 21h.01M21 21h.01" /></>,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></>,
  archive: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" /><path d="M10 12h4" /></>,
  chevron: <path d="M9 6l6 6-6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  back: <path d="M15 6l-6 6 6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M20 6L9 17l-5-5" />,
  warning: <><path d="M12 3L2 20h20L12 3z" /><path d="M12 10v4" /><path d="M12 17.5v.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  tablet: <><circle cx="12" cy="12" r="8" /><path d="M4 12h16" /></>,
  capsule: <><rect x="3" y="9" width="18" height="6" rx="3" /><path d="M12 9v6" /></>,
  liquid: <><path d="M7 8h10l-1 11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2L7 8z" /><path d="M6 8h12M9 4h6v4H9z" /></>,
  inhaler: <><rect x="7" y="9" width="7" height="12" rx="2" /><path d="M14 11l4-3M14 15h5" /></>,
  injection: <><path d="M14 4l6 6M18 6l-9 9-4 5 5-4 9-9M9 15l-2-2" /></>,
  camera: <><path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L18 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" /><circle cx="12" cy="12.5" r="3.2" /></>,
  sync: <><path d="M20 11a8 8 0 0 0-14-4.5L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14 4.5L20 16" /><path d="M20 20v-4h-4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  edit: <><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M13.5 6.5l3 3" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  faceid: <><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M9 10v1.5M15 10v1.5M12 9.5v3l-1 1M9.5 15s1 1 2.5 1 2.5-1 2.5-1" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.5" /></>,
  external: <><path d="M14 5h5v5M19 5l-8 8" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></>,
  link: <><path d="M9 15l6-6" /><path d="M10.5 7.5l1-1a4 4 0 0 1 6 6l-1 1M13.5 16.5l-1 1a4 4 0 0 1-6-6l1-1" /></>,
  nhs: <path d="M3 5h18v14H3z" />,
  pill: <path d="M10.5 3.5L3.5 10.5a5 5 0 0 0 7 7l7-7a5 5 0 0 0-7-7zM8 6l7 7" />,
  shield: <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></>,
  trash: <><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 8 4.6a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 18 4.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H24" /></>,
  download: <><path d="M12 4v11M7 11l5 5 5-5" /><path d="M5 20h14" /></>,
  home: <><path d="M4 10.5L12 4l8 6.5" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></>,
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 24, ...rest }: IconProps) {
  // Filled brand marks
  if (name === 'apple') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...rest}>
        <path d="M16.4 12.9c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1 2.8-2.1c.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.7zM14.1 6.1c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3z" />
      </svg>
    );
  }
  if (name === 'google') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden {...rest}>
        <path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6a4.8 4.8 0 0 1-2.1 3.2v2.6h3.4c2-1.8 3.1-4.5 3.1-7.6z" />
        <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.4-2.6c-.9.6-2.1 1-3.3 1-2.6 0-4.7-1.7-5.5-4.1H3v2.6A10 10 0 0 0 12 22z" />
        <path fill="#FBBC05" d="M6.5 13.9a6 6 0 0 1 0-3.8V7.5H3a10 10 0 0 0 0 9l3.5-2.6z" />
        <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3 7.5l3.5 2.6C7.3 7.6 9.4 5.9 12 5.9z" />
      </svg>
    );
  }
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden {...rest}
    >
      {paths[name]}
    </svg>
  );
}

