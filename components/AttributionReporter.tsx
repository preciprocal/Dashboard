"use client";
// Once someone is signed in, hands the stored arrival (lib/attribution.ts) to
// /api/attribution, which saves it only on an account created in the last two
// days and only if nothing is saved yet. Existing users who sign in again are
// therefore left alone. The stored copy is removed once the server has
// answered either way, so this runs at most once per browser.
import { useEffect } from "react";
import { takeAttribution, clearAttribution } from "@/lib/attribution";

export default function AttributionReporter() {
  useEffect(() => {
    const a = takeAttribution();
    if (!a) return;
    fetch("/api/attribution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(a),
    })
      .then(res => { if (res.ok || res.status === 400) clearAttribution(); })
      .catch(() => { /* try again on the next page load */ });
  }, []);
  return null;
}
