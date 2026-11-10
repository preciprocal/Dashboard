"use client";
// lib/extension.ts
// Everything the web app knows about the Preciprocal Chrome extension: its
// id, the store link, and whether it is installed in this browser.
//
// The extension has no externally_connectable, so the page cannot message it
// directly. Two signals work instead, and either one is enough:
//  1. Its icons are web_accessible_resources for <all_urls>, so loading
//     chrome-extension://<id>/icons/icon16.png succeeds only when it is
//     installed (and enabled). Works on every origin, localhost included.
//  2. On app.preciprocal.com its bridge content script answers
//     GET_LINKEDIN_JOB_DATA with LINKEDIN_JOB_DATA_RESPONSE, sends
//     PRECIPROCAL_REQUEST_AUTH on load, and (from extension 1.5.3) answers
//     PRECIPROCAL_PING with PRECIPROCAL_PONG and its version.
import { useCallback, useEffect, useState } from "react";

export const EXTENSION_ID = "iiomkjnpkaefapdajnabiljngkjddmoi";
export const EXTENSION_STORE_URL = `https://chromewebstore.google.com/detail/${EXTENSION_ID}`;
export const extensionStoreUrl = (utmSource: string) => `${EXTENSION_STORE_URL}?utm_source=${encodeURIComponent(utmSource)}`;

export type ExtensionStatus = "checking" | "installed" | "not-installed";

// The icon probe answers at once either way. The bridge answers within a
// frame when present; a content script that loads late still announces
// itself (PRECIPROCAL_REQUEST_AUTH) and useExtensionStatus flips to
// installed then, so there is no need to wait long here.
const PROBE_TIMEOUT_MS = 1200;

function probeIcon(): Promise<boolean> {
  return new Promise(resolve => {
    const img = new Image();
    const timer = setTimeout(() => resolve(false), PROBE_TIMEOUT_MS);
    img.onload = () => { clearTimeout(timer); resolve(true); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = `chrome-extension://${EXTENSION_ID}/icons/icon16.png?ts=${Date.now()}`;
  });
}

function probeBridge(): Promise<{ ok: boolean; version?: string }> {
  return new Promise(resolve => {
    const done = (r: { ok: boolean; version?: string }) => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(r);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const t = (e.data as { type?: string } | null)?.type;
      if (t === "PRECIPROCAL_PONG") done({ ok: true, version: (e.data as { version?: string }).version });
      else if (t === "LINKEDIN_JOB_DATA_RESPONSE" || t === "PRECIPROCAL_REQUEST_AUTH") done({ ok: true });
    };
    const timer = setTimeout(() => done({ ok: false }), PROBE_TIMEOUT_MS);
    window.addEventListener("message", onMessage);
    window.postMessage({ type: "PRECIPROCAL_PING" }, window.location.origin);
    window.postMessage({ type: "GET_LINKEDIN_JOB_DATA" }, window.location.origin);
  });
}

// One answer per page load, shared by every component that asks.
type Detected = { status: Exclude<ExtensionStatus, "checking">; version?: string };
let cached: Detected | null = null;
let inflight: Promise<Detected> | null = null;

export function detectExtension(force = false): Promise<Detected> {
  if (cached && !force) return Promise.resolve(cached);
  if (inflight && !force) return inflight;
  inflight = Promise.all([probeIcon(), probeBridge()]).then(([icon, bridge]): Detected => {
    const result: Detected = icon || bridge.ok
      ? { status: "installed", version: bridge.version }
      : { status: "not-installed" };
    cached = result;
    inflight = null;
    return result;
  });
  return inflight;
}

/**
 * Whether the extension is installed in this browser. Starts "checking"
 * (also during server render, so hydration matches), then settles. A late
 * PRECIPROCAL_REQUEST_AUTH from the bridge flips it to installed, and
 * `recheck` is for the "I've installed it" button.
 */
export function useExtensionStatus() {
  const [state, setState] = useState<{ status: ExtensionStatus; version?: string }>({ status: "checking" });

  useEffect(() => {
    let alive = true;
    detectExtension().then(r => { if (alive) setState(r); });
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const t = (e.data as { type?: string } | null)?.type;
      if (t === "PRECIPROCAL_REQUEST_AUTH" || t === "PRECIPROCAL_PONG") {
        cached = { status: "installed", version: (e.data as { version?: string }).version ?? cached?.version };
        if (alive) setState(cached);
      }
    };
    window.addEventListener("message", onMessage);
    return () => { alive = false; window.removeEventListener("message", onMessage); };
  }, []);

  const recheck = useCallback(async () => {
    setState({ status: "checking" });
    setState(await detectExtension(true));
  }, []);

  return { ...state, recheck };
}
