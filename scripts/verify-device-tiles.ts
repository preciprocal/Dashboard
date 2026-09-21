// scripts/verify-device-tiles.ts
//
//   npm run verify:device-tiles
//
// The waiting-room device tiles told users their microphone was "Ready" while
// it was muted. That is the worst possible lie for this product to tell: a
// muted mic produces an empty transcript, an interview with no feedback, and a
// spent credit.
//
// The bug was not complicated - the tiles read the permission state and
// ignored the toggle - which is exactly why it survived. There is no crash, no
// log line, and the panel looks healthy. Only a user who mutes and then looks
// at the tile ever finds out.
//
// So the rules get asserted rather than eyeballed. This runs against the real
// deviceTileState, not a copy: the previous two checks of this logic were done
// by pasting it into a scratch page, which verifies the paste.

import {
  deviceTileState, DEVICE_TONE_CLASSES,
  type DeviceKey, type DevicePermission,
} from "@/lib/interview/device-status";

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) { pass++; console.log("  PASS  " + name); }
  else    { fail++; console.log("  FAIL  " + name + (detail ? "  -> " + detail : "")); }
};

const KEYS: DeviceKey[] = ["camera", "microphone", "speaker"];
const PERMS: DevicePermission[] = ["checking", "ready", "denied", "error"];

// ── 1. A device switched off never reads as Ready ──────────────────────────
console.log("[1] an off device is never reported as Ready");
for (const key of KEYS) {
  const t = deviceTileState(key, "ready", false);
  check(`${key} off is not "Ready"`, t.text !== "Ready", t.text);
  check(`${key} off does not use the check icon`, t.icon !== "check", t.icon);
  check(`${key} off is warn-toned`, t.tone === "warn", t.tone);
}

// ── 2. Each device says something true about its own failure ───────────────
console.log("\n[2] wording matches the device");
check("camera off says Off",        deviceTileState("camera", "ready", false).text === "Off");
check("mic off says Muted",         deviceTileState("microphone", "ready", false).text === "Muted");
check("speaker off says Silenced",  deviceTileState("speaker", "ready", false).text === "Silenced");
check("camera uses the camera icon",  deviceTileState("camera", "ready", false).icon === "camera-off");
check("mic uses the mic icon",        deviceTileState("microphone", "ready", false).icon === "mic-off");
check("speaker uses the speaker icon", deviceTileState("speaker", "ready", false).icon === "speaker-off");

// ── 3. Permission outranks the toggle ──────────────────────────────────────
// A blocked device is the thing you must fix before joining. Reporting it as
// merely "off" would hide a real fault behind a reassuring one.
console.log("\n[3] a permission fault is never masked by the toggle");
for (const key of KEYS) {
  for (const perm of ["denied", "error"] as const) {
    const off = deviceTileState(key, perm, false);
    const on  = deviceTileState(key, perm, true);
    check(`${key} ${perm} reads the same whether on or off`, off.text === on.text, `${off.text} vs ${on.text}`);
    check(`${key} ${perm} stays bad-toned when switched off`, off.tone === "bad", off.tone);
  }
}

// ── 4. Only a working, enabled device is green ─────────────────────────────
console.log("\n[4] Ready means ready");
for (const key of KEYS) {
  for (const perm of PERMS) {
    for (const enabled of [true, false]) {
      const t = deviceTileState(key, perm, enabled);
      const shouldBeReady = perm === "ready" && enabled;
      check(
        `${key}/${perm}/${enabled ? "on" : "off"} -> ${shouldBeReady ? "Ready" : "not Ready"}`,
        (t.text === "Ready") === shouldBeReady,
        t.text,
      );
    }
  }
}

// ── 5. Every tone maps to classes ──────────────────────────────────────────
// A missing entry renders an undefined class string, which silently drops the
// colour rather than throwing.
console.log("\n[5] tones resolve to classes");
for (const key of KEYS) {
  for (const perm of PERMS) {
    for (const enabled of [true, false]) {
      const t = deviceTileState(key, perm, enabled);
      const cls = DEVICE_TONE_CLASSES[t.tone];
      if (!cls?.text || !cls?.border) {
        check(`${key}/${perm}/${enabled} has classes`, false, `tone "${t.tone}" unmapped`);
      }
    }
  }
}
check("all tone/class lookups resolved", true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
