"use client";
// Notes where the visitor came from on their first page load, on every route
// (including sign-up and sign-in, which LayoutClient renders bare). Renders
// nothing. See lib/attribution.ts.
import { useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";

export default function AttributionCapture() {
  useEffect(() => { captureAttribution(); }, []);
  return null;
}
