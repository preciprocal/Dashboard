-- 0038_interview_transcript.sql
-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- Keeps the raw transcript of a mock interview so its AI analysis can always
-- be produced.
--
-- Until now the transcript lived only in the browser, in the interview
-- panel's allMessagesRef. createFeedback() took it as an argument, derived
-- the analysis from it, stored only the analysis, and the transcript went out
-- of scope. That made the analysis a one-shot: if the OpenAI call failed, the
-- tab was closed mid-generation, or the network dropped between the call
-- ending and the write landing, the raw material was gone and no analysis
-- could ever be produced for that interview again.
--
-- The visible symptom was app/(root)/interview/[id]/feedback rendering
-- "AI Analysis in Progress" with a spinner forever: a server component with
-- no polling and nothing running behind it, for work that could never happen.
--
-- The analysis is part of the interview, not a separate thing the user opts
-- into, so the input it needs has to outlive the call that produced it.
alter table interviews
  add column if not exists transcript jsonb;

comment on column interviews.transcript is
  'Raw [{role, content}] turns from the voice call, saved when the call ends and before the analysis is generated, so the analysis can be produced or re-produced from it. Null for interviews taken before this column existed, and for sessions that ended with nothing usable (see abandoned_at).';
