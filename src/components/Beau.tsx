/** Beau the firefly — Beacon's mascot and AI companion. */
export function Beau({ size = 100, still = false, className = "" }: { size?: number; still?: boolean; className?: string }) {
  return (
    <svg className={`beau ${still ? "still" : ""} ${className}`} width={size} viewBox="0 0 120 130" role="img" aria-label="Beau the firefly">
      <ellipse cx="46" cy="120" rx="9" ry="5" fill="#0B1122" stroke="#3FD9F5" strokeWidth="1.5" />
      <ellipse cx="74" cy="120" rx="9" ry="5" fill="#0B1122" stroke="#3FD9F5" strokeWidth="1.5" />
      <g transform="rotate(-20 30 42)">
        <ellipse className="wing" cx="30" cy="42" rx="22" ry="15" fill="#CFF3FF" fillOpacity=".8" stroke="#3FD9F5" strokeWidth="2.5" />
      </g>
      <g transform="rotate(20 90 42)">
        <ellipse className="wing" cx="90" cy="42" rx="22" ry="15" fill="#CFF3FF" fillOpacity=".8" stroke="#3FD9F5" strokeWidth="2.5" />
      </g>
      <path d="M50 30Q45 16 38 9M70 30Q75 16 82 9" stroke="#3FD9F5" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="38" cy="9" r="6" fill="#3DE3A6" />
      <circle cx="82" cy="9" r="6" fill="#3DE3A6" />
      <path d="M22 72A38 46 0 0 1 98 72Z" fill="#0B1122" />
      <path d="M22 72A38 46 0 0 0 98 72Z" fill="#3DE3A6" />
      <path d="M30 90Q60 97 90 90M37 105Q60 111 83 105" stroke="#27B886" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="42" cy="82" r="4" fill="#EFFFF8" opacity=".75" />
      <circle cx="46" cy="54" r="9.5" fill="#fff" />
      <circle cx="47" cy="55.5" r="6.8" fill="#3FD9F5" />
      <circle cx="49.5" cy="52.5" r="2.4" fill="#fff" />
      <circle cx="74" cy="54" r="9.5" fill="#fff" />
      <circle cx="75" cy="55.5" r="6.8" fill="#3FD9F5" />
      <circle cx="77.5" cy="52.5" r="2.4" fill="#fff" />
      <ellipse cx="35" cy="66" rx="5.5" ry="3.2" fill="#E36D9B" />
      <ellipse cx="85" cy="66" rx="5.5" ry="3.2" fill="#E36D9B" />
      <path d="M54 66Q60 71.5 66 66" stroke="#3FD9F5" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <ellipse cx="60" cy="72" rx="38" ry="46" fill="none" stroke="#3FD9F5" strokeWidth="3.5" />
    </svg>
  );
}

export function Sparks({ className = "", size = 40 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M6 14 18 20M12 4l10 12M26 2l2 14" stroke="#E7DD6A" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
