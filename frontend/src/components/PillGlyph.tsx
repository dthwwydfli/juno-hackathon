import { useId } from 'react';
import type { MedForm } from '../data/types';

/**
 * A medication's visual identity.
 *
 * Every row on Home used to render the same glyph, because MedCard picked its
 * icon from `med.route` and every medication in the cabinet is Oral. Five
 * identical tiles is what made the list read as placeholder data.
 *
 * Here the shape comes from `form` (the field that actually varies) and the
 * colour from a hash of the name, so Atorvastatin is the same colour in every
 * session and on every device. The list becomes memorable — you learn to find
 * "the blue one" — without the colour meaning anything.
 *
 * Colour is decorative only. It never encodes category, severity or any
 * interaction state; the name identifies the medicine and the amber badge
 * carries the interaction signal.
 */

/** Plausible pharmaceutical colours, not a UI palette — these are the shades
 *  real tablets and capsules actually come in. Theme-invariant: a pill does
 *  not change colour when you turn the lights off. */
const PILL_COLOURS: { fill: string; light: string; edge: string }[] = [
  { fill: '#F2F0EA', light: '#FBFAF6', edge: '#CFCABB' }, // chalk
  { fill: '#C3D4E8', light: '#DEE8F4', edge: '#93AECC' }, // pale blue
  { fill: '#6F93C0', light: '#9DB6D6', edge: '#4E6E96' }, // deep blue
  { fill: '#EDDCA4', light: '#F6EDCB', edge: '#C9B36F' }, // butter
  { fill: '#E9BCC0', light: '#F4DADC', edge: '#C99096' }, // blush
  { fill: '#F0C6A4', light: '#F8E1CC', edge: '#CE9C71' }, // peach
  { fill: '#CBBEE0', light: '#E3DBEF', edge: '#A492C2' }, // lilac
  { fill: '#8E7FB8', light: '#B3A7D0', edge: '#6B5E92' }, // violet
  { fill: '#B7D8C5', light: '#D6EADF', edge: '#89B49A' }, // mint
  { fill: '#5E9E86', light: '#8CBFAC', edge: '#417561' }, // teal-green
  { fill: '#C4705E', light: '#D99485', edge: '#9C5344' }, // brick
  { fill: '#A6B0BC', light: '#C6CDD6', edge: '#7C8894' }, // slate
  { fill: '#D9C39F', light: '#EADCC3', edge: '#B29775' }, // tan
  { fill: '#E8E3D6', light: '#F4F1E9', edge: '#C2BAA6' }, // bone
  { fill: '#D4838F', light: '#E3A9B2', edge: '#AB606C' }, // rose
  { fill: '#EFA96B', light: '#F6C89B', edge: '#C9853F' }, // amber-tan
];

/** FNV-1a. Stable across sessions and machines — the point is that a given
 *  drug always looks the same, so a plain hash is exactly right here. */
function colourFor(name: string) {
  let h = 0x811c9dc5;
  const s = name.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return PILL_COLOURS[h % PILL_COLOURS.length];
}

interface PillGlyphProps {
  name: string;
  form: MedForm;
  size?: number;
  className?: string;
}

export function PillGlyph({ name, form, size = 40, className }: PillGlyphProps) {
  const uid = useId().replace(/:/g, '');
  const c = colourFor(name);
  const clip = `pg-${uid}`;

  return (
    <svg
      className={`pill-glyph${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden
      focusable="false"
    >
      {form === 'tablet' && (
        <>
          <circle cx="20" cy="20" r="15.5" fill={c.fill} stroke={c.edge} strokeWidth="1" />
          {/* score line — what makes a disc read as a tablet rather than a dot */}
          <path d="M20 6 V34" stroke={c.edge} strokeWidth="1" opacity=".75" />
        </>
      )}

      {form === 'capsule' && (
        <>
          <defs>
            <clipPath id={clip}>
              <rect x="2" y="12" width="36" height="16" rx="8" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clip})`}>
            <rect x="2" y="12" width="18" height="16" fill={c.fill} />
            <rect x="20" y="12" width="18" height="16" fill={c.light} />
          </g>
          <rect x="2" y="12" width="36" height="16" rx="8" fill="none" stroke={c.edge} strokeWidth="1" />
          <path d="M20 12 V28" stroke={c.edge} strokeWidth="1" opacity=".5" />
        </>
      )}

      {form === 'liquid' && (
        <>
          <rect x="16" y="5" width="8" height="5" rx="1.5" fill={c.edge} />
          <path d="M17.5 10 h5 v3 l3 3 v16 a2 2 0 0 1 -2 2 h-7 a2 2 0 0 1 -2 -2 V16 l3 -3 Z" fill={c.light} stroke={c.edge} strokeWidth="1" />
          <path d="M14.5 24 h11 v9 a2 2 0 0 1 -2 2 h-7 a2 2 0 0 1 -2 -2 Z" fill={c.fill} />
        </>
      )}

      {form === 'inhaler' && (
        <>
          <rect x="13" y="6" width="9" height="12" rx="3" fill={c.light} stroke={c.edge} strokeWidth="1" />
          <path d="M13 18 h13 a3 3 0 0 1 3 3 v10 a3 3 0 0 1 -3 3 h-10 a3 3 0 0 1 -3 -3 Z" fill={c.fill} stroke={c.edge} strokeWidth="1" />
        </>
      )}

      {form === 'injection' && (
        <>
          <path d="M11 29 L21 19" stroke={c.edge} strokeWidth="1.6" strokeLinecap="round" />
          <rect x="18.5" y="12" width="13" height="9" rx="2" transform="rotate(45 25 16.5)" fill={c.fill} stroke={c.edge} strokeWidth="1" />
          <path d="M27 7 L33 13" stroke={c.edge} strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {form === 'other' && (
        <g transform="rotate(-38 20 20)">
          <defs>
            <clipPath id={`${clip}-o`}>
              <rect x="5" y="14" width="30" height="12" rx="6" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clip}-o)`}>
            <rect x="5" y="14" width="15" height="12" fill={c.fill} />
            <rect x="20" y="14" width="15" height="12" fill={c.light} />
          </g>
          <rect x="5" y="14" width="30" height="12" rx="6" fill="none" stroke={c.edge} strokeWidth="1" />
        </g>
      )}
    </svg>
  );
}
