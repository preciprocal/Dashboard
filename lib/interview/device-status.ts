// lib/interview/device-status.ts
// What a waiting-room device tile should say.
//
// Two facts decide it, and conflating them was the bug this file exists to
// prevent:
//
//   permission  - is the device present and allowed? (from getUserMedia)
//   enabled     - has the user switched it off? (from the toggle buttons)
//
// The tiles originally read permission alone, so muting the microphone left a
// green tick reading "Ready". The one panel whose entire job is telling you
// your devices are fine was confidently wrong about the case that matters
// most: a muted mic produces an empty transcript and a wasted session.
//
// Extracted from the component so it can be rendered and checked on its own.
// While it lived inline, verifying it meant copying it into a scratch page,
// which tests the copy rather than the thing that ships.

export type DeviceKey = "camera" | "microphone" | "speaker";

/** Permission/hardware state, as produced by the waiting room's device probe. */
export type DevicePermission = "checking" | "ready" | "denied" | "error" | string;

export type DeviceTone = "neutral" | "ok" | "warn" | "bad";

export interface DeviceTileState {
  /** Short status word shown under the device name. */
  text: string;
  /** Which icon to draw. The component owns the actual SVG. */
  icon: "spinner" | "alert" | "check" | "camera-off" | "mic-off" | "speaker-off";
  tone: DeviceTone;
}

/**
 * Resolve a tile.
 *
 * Permission outranks the toggle deliberately. A blocked camera is blocked
 * whether or not you also switched it off, and that is the thing you have to
 * fix before you can join - reporting "Off" there would hide the real problem
 * behind a reassuring one.
 */
export function deviceTileState(
  key: DeviceKey,
  permission: DevicePermission,
  enabled: boolean,
): DeviceTileState {
  if (permission === "checking") return { text: "Checking",    icon: "spinner", tone: "neutral" };
  if (permission === "denied")   return { text: "Blocked",     icon: "alert",   tone: "bad" };
  if (permission === "error")    return { text: "Unavailable", icon: "alert",   tone: "bad" };

  if (!enabled) {
    // Warn, not bad: a choice the user made and can undo in one click, rather
    // than a fault requiring a trip into browser settings.
    //
    // The wording differs per device because the consequences differ. A muted
    // mic means nobody can hear you, which ends the interview's usefulness. A
    // silenced speaker means you cannot hear them, which is recoverable and
    // sometimes deliberate.
    if (key === "camera")  return { text: "Off",      icon: "camera-off",  tone: "warn" };
    if (key === "speaker") return { text: "Silenced", icon: "speaker-off", tone: "warn" };
    return                        { text: "Muted",    icon: "mic-off",     tone: "warn" };
  }

  return { text: "Ready", icon: "check", tone: "ok" };
}

/** Tailwind classes per tone, kept beside the logic so they cannot drift apart. */
export const DEVICE_TONE_CLASSES: Record<DeviceTone, { text: string; border: string }> = {
  neutral: { text: "text-slate-400",   border: "border-slate-700" },
  ok:      { text: "text-emerald-400", border: "border-slate-700" },
  warn:    { text: "text-amber-400",   border: "border-amber-500/30" },
  bad:     { text: "text-red-400",     border: "border-red-500/30" },
};
