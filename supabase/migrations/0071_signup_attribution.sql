-- 0071_signup_attribution.sql
-- Where a new account came from, recorded once at sign-up.
--
-- The marketing site already tags every link into the app with its analytics
-- session (pr_sid) and, with consent, its visitor id (pr_vid); see
-- decorateAppLinks() in the Landing-Page repo. The app keeps those (or, for
-- someone who arrived at the app directly, the referrer and utm_* tags) until
-- the account exists, then writes them here through /api/attribution.
--
-- Shape (all keys optional):
--   { "sid": uuid, "vid": uuid,            -- landing-site session / visitor
--     "referrer": "https://host/path",     -- direct-to-app arrivals only
--     "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
--     "click_id": "gclid" | "msclkid" | "fbclid" | ...,
--     "landing": "/sign-up",               -- first app path
--     "at": iso timestamp of the first arrival }
--
-- The ERP resolves sid against web_sessions for the source, channel and
-- entry page, and classifies the rest with the same rules the landing site's
-- collector uses.

alter table public.profiles
  add column if not exists signup_attribution jsonb;

comment on column public.profiles.signup_attribution is
  'First-touch acquisition data captured at sign-up (see 0071_signup_attribution.sql).';
