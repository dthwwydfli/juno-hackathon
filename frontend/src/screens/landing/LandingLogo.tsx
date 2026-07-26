/** App mark for landing header/footer — fill uses --accent-solid to match primary CTAs. */
export function LandingLogo({ size = 38 }: { size?: number }) {
  return (
    <span
      className="landing-logo-mark"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
        <rect width="512" height="512" rx="112" fill="currentColor" />
        <g
          transform="translate(256 256) rotate(45)"
          stroke="#FFFFFF"
          strokeWidth="34"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="-150" y="-70" width="300" height="140" rx="70" fill="none" />
          <path d="M0 -70 V70" />
        </g>
      </svg>
    </span>
  );
}
