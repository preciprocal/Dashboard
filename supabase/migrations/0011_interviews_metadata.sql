-- Phase 3b: `interviews` as originally created (app/api/vapi/generate/route.ts,
-- app/api/templates/interview/route.ts) carries several fields with no typed
-- column - technicalQuestions/behavioralQuestions/questionCounts/
-- interviewMetadata (AI-generation bookkeeping) and coverImage/templateId/
-- templateName/category/difficulty/rating/completions/tags/fromTemplate
-- (template-sourced interviews). None of these are filtered/indexed on, so a
-- single jsonb column holds them rather than one column each.
alter table interviews add column metadata jsonb;
