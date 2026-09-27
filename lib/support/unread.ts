// lib/support/unread.ts
//
// One definition of "this support thread needs the user's attention".
//
// Three callers need the same answer and must not be allowed to drift:
//
//   app/(root)/help/page.tsx   the Tickets tab badge and the per-row dot
//   components/LayoutClient.tsx the dot on the Support nav item
//   scripts/verify-support-tickets.ts  asserts the rule against real rows
//
// Derived from columns the 0036 trigger already maintains rather than stored
// as a flag. A `has_unread` boolean would be a third writer on a fact two
// existing columns already express, and would drift the first time a reply
// arrived through a path that forgot to set it - which is the bug 0036 was
// written to fix for reply_count.

export interface UnreadInput {
  /** 'user' | 'support', maintained by sync_ticket_on_reply (migration 0036). */
  lastReplyBy?: string | null;
  lastReplyAt?: string | null;
  /** Set when the owner opens the thread (migration 0041). */
  userLastReadAt?: string | null;
  /** Fallback read-marker for a thread the owner has never opened. */
  createdAt?: string | null;
}

/**
 * True when support has replied since the user last opened the thread.
 *
 * Deliberately NOT `status !== 'closed'`, which is what the Tickets tab badge
 * counted before. That number could not move when the user replied - replying
 * does not close a ticket - and the 0036 trigger reopens a resolved one, so
 * answering support could push the badge UP. It measured open workload, not
 * anything there was to read.
 *
 * A user's own reply can never make a thread unread: last_reply_by is 'user'
 * at that point, so the first condition fails.
 */
export function hasUnreadSupportReply(t: UnreadInput): boolean {
  if (t.lastReplyBy !== 'support' || !t.lastReplyAt) return false;

  // No read marker means never opened, so the thread's own creation time is
  // the earliest anything could have been seen.
  const seen = t.userLastReadAt ?? t.createdAt;
  if (!seen) return true;

  const replied = new Date(t.lastReplyAt).getTime();
  const read    = new Date(seen).getTime();
  if (isNaN(replied) || isNaN(read)) return false;

  return replied > read;
}
