-- 0059_transcript_review_journal_link.sql
-- Two additive columns for the interview results page.
--
-- 1. interview_feedback.transcript_review
--    The annotated transcript (per-answer critique and "better answer"
--    rewrites) is one Claude call per interview. Storing the result on the
--    feedback row it belongs to means it is generated once, not on every
--    visit. The review carries a hash of the transcript it was written for, so
--    a retake (which overwrites this row) regenerates instead of showing the
--    old critique against new answers.
--
-- 2. interview_debriefs.source_interview_id
--    "Save to Interview Journal" copies a mock interview into the journal.
--    This column records which interview an entry came from, so the button
--    can say "Open in Interview Journal" instead of creating a duplicate, and
--    the unique index makes a double click unable to create two.
--
-- Both are nullable. Until this is applied the code still works: the review is
-- cached in Redis instead (lib/interview/transcript-review.ts), and synced
-- entries are found by the results link written into their notes
-- (lib/interview/journal-sync.ts).
--
-- NOT run automatically. Review, then apply via the Supabase SQL editor.

alter table interview_feedback
  add column if not exists transcript_review jsonb;

comment on column interview_feedback.transcript_review is
  'Cached annotated-transcript review (lib/interview/transcript-analysis.ts TranscriptReview). Regenerated when its transcriptHash no longer matches interviews.transcript.';

alter table interview_debriefs
  add column if not exists source_interview_id uuid references interviews(id) on delete set null;

create unique index if not exists interview_debriefs_user_source_interview_idx
  on interview_debriefs (user_id, source_interview_id)
  where source_interview_id is not null;
