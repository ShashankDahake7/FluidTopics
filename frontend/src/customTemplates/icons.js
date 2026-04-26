'use client';

// Per-template illustrated icons — designed to read at ~80px on the portal
// home tiles. Each is a self-contained SVG so we don't pull in an icon
// library; tweak colors/layout here when adding new templates.

const wrap = { width: '100%', height: '100%' };

export function WhatsUpcomingIcon() {
  return (
    <svg viewBox="0 0 100 100" style={wrap} aria-hidden="true">
      <defs>
        <linearGradient id="wu-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      {/* Document body */}
      <rect x="20" y="14" width="58" height="72" rx="5" fill="#ffffff" stroke="#e2e8f0" />
      {/* Purple banner */}
      <rect x="20" y="14" width="58" height="22" rx="5" fill="url(#wu-grad)" />
      {/* "What's Upcoming" stripes */}
      <rect x="26" y="20" width="46" height="3" rx="1.5" fill="#ffffff" opacity="0.85" />
      <rect x="26" y="27" width="34" height="2.5" rx="1" fill="#ffffff" opacity="0.65" />
      {/* Body lines */}
      <rect x="28" y="46" width="42" height="3" rx="1.5" fill="#fda4af" />
      <rect x="28" y="55" width="36" height="2" rx="1" fill="#e2e8f0" />
      <rect x="28" y="62" width="42" height="2" rx="1" fill="#e2e8f0" />
      <rect x="28" y="69" width="28" height="2" rx="1" fill="#e2e8f0" />
      <rect x="28" y="76" width="38" height="2" rx="1" fill="#e2e8f0" />
    </svg>
  );
}

export function ReleaseNotesIcon() {
  return (
    <svg viewBox="0 0 100 100" style={wrap} aria-hidden="true">
      {/* Document */}
      <path d="M22 16 h36 l14 14 v54 a4 4 0 0 1 -4 4 H22 a4 4 0 0 1 -4 -4 V20 a4 4 0 0 1 4 -4 z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
      {/* Folded corner */}
      <path d="M58 16 v14 h14" fill="#eef2ff" stroke="#cbd5e1" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Lines */}
      <rect x="28" y="42" width="34" height="3" rx="1.5" fill="#3b82f6" />
      <rect x="28" y="51" width="28" height="2" rx="1" fill="#cbd5e1" />
      <rect x="28" y="58" width="32" height="2" rx="1" fill="#cbd5e1" />
      <rect x="28" y="65" width="20" height="2" rx="1" fill="#cbd5e1" />
      {/* Pencil */}
      <g transform="translate(54 52) rotate(35)">
        <rect x="0" y="0" width="6" height="34" fill="#fbbf24" />
        <polygon points="0,0 6,0 3,-7" fill="#1f2937" />
        <rect x="0" y="34" width="6" height="6" fill="#ec4899" />
        <rect x="0" y="40" width="6" height="2" fill="#9ca3af" />
      </g>
    </svg>
  );
}

export function LegalChangesIcon() {
  return (
    <svg viewBox="0 0 100 100" style={wrap} aria-hidden="true">
      {/* Document */}
      <path d="M24 16 h32 l14 14 v54 a4 4 0 0 1 -4 4 H24 a4 4 0 0 1 -4 -4 V20 a4 4 0 0 1 4 -4 z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
      <path d="M56 16 v14 h14" fill="#ecfdf5" stroke="#cbd5e1" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Title line + check */}
      <rect x="28" y="42" width="34" height="3" rx="1.5" fill="#16a34a" />
      <rect x="28" y="51" width="38" height="2" rx="1" fill="#cbd5e1" />
      <rect x="28" y="58" width="34" height="2" rx="1" fill="#cbd5e1" />
      {/* Big checkmark badge */}
      <circle cx="58" cy="70" r="10" fill="#16a34a" />
      <path d="M53 70 l4 4 l7 -8" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FAQsIcon() {
  return (
    <svg viewBox="0 0 100 100" style={wrap} aria-hidden="true">
      {/* Back bubble */}
      <path d="M30 22 H72 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 H58 l-8 8 v-8 H30 a8 8 0 0 1 -8 -8 V30 a8 8 0 0 1 8 -8 z" fill="#7c3aed" opacity="0.9" />
      {/* Question marks */}
      <text x="36" y="50" fontFamily="Inter, sans-serif" fontSize="22" fontWeight="700" fill="#ffffff">?</text>
      <text x="50" y="50" fontFamily="Inter, sans-serif" fontSize="22" fontWeight="700" fill="#ffffff">?</text>
      <text x="64" y="50" fontFamily="Inter, sans-serif" fontSize="22" fontWeight="700" fill="#ffffff">?</text>
      {/* Front bubble */}
      <path d="M48 60 H82 a6 6 0 0 1 6 6 v14 a6 6 0 0 1 -6 6 H68 l-5 5 v-5 H48 a6 6 0 0 1 -6 -6 V66 a6 6 0 0 1 6 -6 z" fill="#3b82f6" />
      <circle cx="58" cy="74" r="2" fill="#ffffff" />
      <circle cx="66" cy="74" r="2" fill="#ffffff" />
      <circle cx="74" cy="74" r="2" fill="#ffffff" />
    </svg>
  );
}

export function ComingSoonIcon() {
  return (
    <svg viewBox="0 0 100 100" style={wrap} aria-hidden="true">
      {/* Hourglass frame */}
      <rect x="32" y="14" width="36" height="4" rx="1" fill="#f59e0b" />
      <rect x="32" y="82" width="36" height="4" rx="1" fill="#f59e0b" />
      {/* Glass body */}
      <path d="M36 18 H64 V32 L52 50 L64 68 V82 H36 V68 L48 50 L36 32 Z" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Sand top */}
      <path d="M40 22 H60 L52 36 Z" fill="#f59e0b" />
      {/* Falling sand */}
      <rect x="49" y="46" width="2" height="14" fill="#f59e0b" />
      {/* Sand bottom */}
      <path d="M40 78 H60 L52 60 Z" fill="#f59e0b" opacity="0.85" />
    </svg>
  );
}

export function GenericDocIcon() {
  return (
    <svg viewBox="0 0 100 100" style={wrap} aria-hidden="true">
      <path d="M28 14 h32 l14 14 v54 a4 4 0 0 1 -4 4 H28 a4 4 0 0 1 -4 -4 V18 a4 4 0 0 1 4 -4 z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
      <path d="M60 14 v14 h14" fill="#eff6ff" stroke="#cbd5e1" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="32" y="40" width="34" height="3" rx="1.5" fill="#0ea5e9" />
      <rect x="32" y="50" width="30" height="2" rx="1" fill="#cbd5e1" />
      <rect x="32" y="57" width="34" height="2" rx="1" fill="#cbd5e1" />
      <rect x="32" y="64" width="22" height="2" rx="1" fill="#cbd5e1" />
      <rect x="32" y="71" width="30" height="2" rx="1" fill="#cbd5e1" />
    </svg>
  );
}
