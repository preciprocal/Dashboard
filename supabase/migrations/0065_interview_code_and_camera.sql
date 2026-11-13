-- 0065_interview_code_and_camera.sql
-- Additive columns for the code editor in technical mock interviews, and for
-- on-camera (body-language) feedback.
--
-- 1. interviews.code_submission
--    The code the candidate wrote in the on-screen editor, as
--    { "language": "...", "code": "..." }. Saved beside interviews.transcript
--    before the feedback model runs, for the same reason the transcript is:
--    if the analysis fails, the results page can regenerate it from stored
--    state (ensureInterviewFeedback), code included.
--
-- 2. interview_feedback.code_review
--    The submitted code plus the feedback model's notes on it (correctness,
--    complexity, readability, how well they discussed it, a score). Shown as
--    "Your code" on the results page. Null for interviews without code, and
--    reset to null when an interview is retaken without code.
--
-- 3. interview_feedback.camera_metrics
--    Aggregate on-camera numbers (eye contact %, framing %, steadiness %,
--    average face brightness, smile %, sample count, duration) for
--    interviews taken with on-camera feedback switched on. Computed in the
--    browser by lib/interview/camera-metrics.ts; no image or video is ever
--    uploaded or stored, only these numbers. Null when the camera feedback
--    was off.
--
-- All nullable. Until this is applied the code still works: the report is
-- saved without these columns (lib/actions/general.action.ts retries the
-- upsert without them when Postgres reports them missing), and the code
-- review and camera numbers reach the results page from the 7-day Redis
-- copy of the feedback.
--
-- NOT run automatically. Review, then apply via the Supabase SQL editor.

alter table interviews
  add column if not exists code_submission jsonb;

comment on column interviews.code_submission is
  'Code from the interview editor: { language, code } (lib/interview/code-submission.ts). Never executed.';

alter table interview_feedback
  add column if not exists code_review jsonb;

comment on column interview_feedback.code_review is
  'Submitted code plus the feedback model''s notes (lib/interview/code-submission.ts CodeReview).';

alter table interview_feedback
  add column if not exists camera_metrics jsonb;

comment on column interview_feedback.camera_metrics is
  'Aggregate on-camera numbers computed in the browser (lib/interview/camera-metrics.ts CameraMetrics). Never images or video.';
