export default function Splash() {
  return (
    <div className="splash" role="status" aria-live="polite" aria-label="Loading SkyWindow">
      <div className="splash__inner">
        <svg
          className="splash__mark"
          viewBox="0 0 56 56"
          width="56"
          height="56"
          aria-hidden
        >
          <defs>
            <linearGradient id="splash-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4dd9c0" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#0a0e1a" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <rect
            x="6"
            y="10"
            width="44"
            height="36"
            rx="5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.9"
          />
          <rect className="splash__sky" x="8.5" y="12.5" width="39" height="31" rx="3.5" fill="url(#splash-sky)" />
          <path
            className="splash__horizon"
            d="M8.5 32 C20 26, 36 26, 47.5 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        </svg>
        <h1 className="splash__title">SkyWindow</h1>
      </div>
    </div>
  )
}
