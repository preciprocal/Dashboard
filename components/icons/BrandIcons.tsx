// components/icons/BrandIcons.tsx
// Full-colour brand marks for the services Preciprocal connects to: Google
// (the Chrome extension), LinkedIn, and Outlook (email). Lucide's outline
// glyphs read as generic placeholders next to a real product name; these are
// the marks people recognise.
//
// Same API as a lucide icon (className sizes it), so they slot into any place
// that takes `icon: LucideIcon`. Colours are fixed on purpose: a brand mark
// should not pick up the surrounding text colour.
import * as React from "react";

type BrandIconProps = React.SVGProps<SVGSVGElement> & { className?: string };

export function GoogleIcon({ className, ...props }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...props}>
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.38l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77Z" />
    </svg>
  );
}

export function ChromeIcon({ className, ...props }: BrandIconProps) {
  return (
    <svg viewBox="4 4 40 40" className={className} aria-hidden="true" {...props}>
      {/* Green lower-left, yellow right, red top, then the white ring and blue centre. */}
      <path fill="#34A853" d="M44 24c0 11.04-8.96 20-20 20S4 35.04 4 24 12.96 4 24 4s20 8.96 20 20Z" />
      <path fill="#FBBC05" d="M24 4v20l8 4-8.84 16H24c11.05 0 20-8.95 20-20S35.05 4 24 4Z" />
      <path fill="#EA4335" d="M41.84 15H24v13l-3-1L7.16 13.26C10.68 7.69 16.91 4 24 4c7.8 0 14.55 4.48 17.84 11Z" />
      <circle cx="24" cy="24" r="9" fill="#fff" />
      <circle cx="24" cy="24" r="7" fill="#4285F4" />
    </svg>
  );
}

export function LinkedInIcon({ className, ...props }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...props}>
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <path fill="#fff" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13Zm1.78 13.02H3.56V9h3.56v11.45Z" />
    </svg>
  );
}

// The official Office Outlook logo (public/brand/outlook.svg, from Wikimedia
// Commons). Shown as an image, a little larger than the other marks by
// default, since its envelope detail is lost at small sizes.
export function OutlookIcon({ className }: BrandIconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a static brand mark; next/image adds nothing here
    <img src="/brand/outlook.svg" alt="" aria-hidden="true" draggable={false} className={`object-contain flex-shrink-0 ${className ?? "w-5 h-5"}`} />
  );
}

export function GoogleCalendarIcon({ className, ...props }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...props}>
      {/* White page, blue header band, the Google colours along the foot, then "31". */}
      <rect x="2.5" y="2.5" width="19" height="19" rx="2.5" fill="#fff" />
      <path fill="#4285F4" d="M2.5 5A2.5 2.5 0 0 1 5 2.5h14A2.5 2.5 0 0 1 21.5 5v2.5h-19V5Z" />
      <path fill="#1967D2" d="M17 2.5h2A2.5 2.5 0 0 1 21.5 5v2.5H17v-5Z" />
      <path fill="#34A853" d="M2.5 17H7v4.5H5A2.5 2.5 0 0 1 2.5 19v-2Z" />
      <path fill="#FBBC04" d="M7 17h10v4.5H7V17Z" />
      <path fill="#EA4335" d="M17 17h4.5L17 21.5V17Z" />
      <text x="12" y="15.4" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="7.5" fill="#4285F4">31</text>
    </svg>
  );
}
