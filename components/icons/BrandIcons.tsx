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

export function OutlookIcon({ className, ...props }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...props}>
      {/* Envelope body */}
      <path fill="#0A2767" d="M23 12.2v8.3c0 .83-.67 1.5-1.5 1.5H9.5c-.83 0-1.5-.67-1.5-1.5v-8.3l7.5 4.6 7.5-4.6Z" />
      <path fill="#0364B8" d="M8 6.5c0-.83.67-1.5 1.5-1.5h12c.83 0 1.5.67 1.5 1.5v5.7l-7.5 4.6L8 12.2V6.5Z" />
      <path fill="#28A8EA" d="M15.5 5H23v7.2l-7.5 4.6V5Z" />
      <path fill="#14447D" d="M8 12.2l7.5 4.6 7.5-4.6v.9l-7.5 4.6L8 13.1v-.9Z" opacity=".5" />
      {/* The "O" tile */}
      <rect x="1" y="5.5" width="12" height="13" rx="1.5" fill="#0078D4" />
      <path fill="#fff" d="M7 8.6c-2 0-3.3 1.45-3.3 3.4 0 1.97 1.3 3.4 3.27 3.4 2 0 3.33-1.45 3.33-3.42 0-1.97-1.3-3.38-3.3-3.38Zm-.02 5.36c-1.06 0-1.73-.84-1.73-1.97 0-1.14.67-1.98 1.75-1.98 1.07 0 1.72.85 1.72 1.98 0 1.14-.67 1.97-1.74 1.97Z" />
    </svg>
  );
}
