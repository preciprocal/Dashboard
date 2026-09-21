// lib/interview/media-controls.ts
// Makes the mic, camera and speaker buttons in the interview panel do
// something.
//
// Before this, all three were cosmetic: each click flipped a piece of React
// state that changed an icon and a background colour and touched no device at
// all. A candidate who pressed "mute" was still being recorded, and one who
// pressed it because they needed a private moment was misled by their own UI.
// The speaker button was the same, and the camera button toggled a camera that
// was never acquired in the first place.
//
// Kept out of the component because each control talks to a different system -
// the mic to the Vapi SDK, the camera to a MediaStream we own, the speaker to
// whatever audio elements the transport happens to have created - and none of
// that is React state.

import type Vapi from "@vapi-ai/web";

/**
 * Mute or unmute the candidate's microphone.
 *
 * Goes through the SDK rather than the local MediaStream. Vapi owns the track
 * it publishes; disabling a track we separately acquired would mute a different
 * stream and leave the published one live, which is the worst possible outcome
 * for a control labelled "mute".
 */
export function setMicMuted(vapi: Vapi, muted: boolean): void {
  try {
    vapi.setMuted(muted);
  } catch {
    // Called before a call is live, or after it ended. Not worth surfacing:
    // the button reflects intent and the state is reapplied on call-start.
  }
}

/** What the SDK thinks, which is the only opinion that matters. */
export function isMicMuted(vapi: Vapi): boolean {
  try {
    return vapi.isMuted();
  } catch {
    return false;
  }
}

/**
 * Silence the interviewer's voice locally.
 *
 * There is no master output volume in the SDK, and setOutputDeviceAsync picks a
 * device rather than muting one. The transport renders remote audio into plain
 * <audio> elements, so muting those is what actually stops the sound.
 *
 * A MutationObserver is needed because the elements are not all present when
 * the button is pressed: a new one can be attached mid-call, and it would start
 * unmuted and audible, exactly reversing what the user asked for. The observer
 * is returned so the caller can disconnect it.
 */
export function muteRemoteAudio(muted: boolean): MutationObserver | null {
  const apply = (root: ParentNode) => {
    root.querySelectorAll?.("audio").forEach((el) => {
      (el as HTMLAudioElement).muted = muted;
    });
  };

  apply(document);

  if (!muted) return null;

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node instanceof HTMLAudioElement) node.muted = true;
        else if (node instanceof HTMLElement) apply(node);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

export interface CameraHandle {
  stream: MediaStream;
  stop: () => void;
}

/**
 * The candidate's own camera, for the self-view tile.
 *
 * Audio is deliberately NOT requested. Vapi already holds the microphone, and
 * opening a second audio track can make the browser echo or, on some devices,
 * fail to grant the second request entirely and take the interview down with
 * it. This stream is for pixels only.
 */
export async function startCamera(): Promise<CameraHandle | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: false,
    });
    return {
      stream,
      stop: () => stream.getTracks().forEach((t) => t.stop()),
    };
  } catch {
    // Denied, already in use, or no camera. The interview is audio-only, so
    // this must never be fatal - the tile just shows the fallback.
    return null;
  }
}

/**
 * Turn the camera picture on or off without releasing the device.
 *
 * `track.enabled = false` blanks the video instantly and keeps the permission,
 * so turning it back on is immediate. Stopping the track instead would drop the
 * device and force a fresh getUserMedia, which in some browsers re-prompts and
 * in others takes a visible second to come back.
 */
export function setCameraEnabled(handle: CameraHandle | null, enabled: boolean): void {
  handle?.stream.getVideoTracks().forEach((t) => { t.enabled = enabled; });
}
