// lib/session/describe-device.ts
// "Chrome on macOS" from a user agent. Shared by the new-device email and the
// Devices tab in Settings, so the device a user is warned about by email has
// the same name as the one they then find and remove in the app.
//
// Best effort and never throws. A user agent is self-reported and trivially
// faked, so this is a label for a human, never an input to a security check.

export type DeviceKind = 'desktop' | 'phone' | 'tablet';

export interface DeviceDescription {
  /** "Chrome on macOS", or "Unknown device". */
  label: string;
  kind: DeviceKind;
}

export function describeDevice(userAgent: string | null | undefined): DeviceDescription {
  const ua = userAgent ?? '';

  // Order matters: Edge and Opera also say "Chrome", and Chrome also says
  // "Safari", so the more specific names are tested first.
  const browser =
    /edg\//i.test(ua)                  ? 'Edge'
    : /opr\/|opera/i.test(ua)          ? 'Opera'
    : /samsungbrowser/i.test(ua)       ? 'Samsung Internet'
    : /chrome|crios/i.test(ua)         ? 'Chrome'
    : /firefox|fxios/i.test(ua)        ? 'Firefox'
    : /safari/i.test(ua)               ? 'Safari'
    : null;

  const os =
    /ipad/i.test(ua)                   ? 'iPadOS'
    : /iphone|ipod/i.test(ua)          ? 'iOS'
    : /android/i.test(ua)              ? 'Android'
    : /windows/i.test(ua)              ? 'Windows'
    : /cros/i.test(ua)                 ? 'ChromeOS'
    : /mac os|macintosh/i.test(ua)     ? 'macOS'
    : /linux/i.test(ua)                ? 'Linux'
    : null;

  const kind: DeviceKind =
    /ipad|tablet/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua)) ? 'tablet'
    : /mobile|iphone|ipod/i.test(ua) ? 'phone'
    : 'desktop';

  const label = browser && os ? `${browser} on ${os}` : browser ?? os ?? 'Unknown device';
  return { label, kind };
}
