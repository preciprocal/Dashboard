-- Phase 3c: the live feature-rating writer (app/api/user/feedback/route.ts
-- POST, backing components/ServiceFeedback.tsx) submits nps and tags
-- alongside rating/comment - add the missing columns to the placeholder
-- schema from 0001.
alter table feature_ratings
  add column nps integer,
  add column tags text[] not null default '{}';
