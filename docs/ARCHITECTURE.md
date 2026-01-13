# Architecture

Mobile (Expo RN TS) ↔ Supabase (Auth/DB) + Edge Function ai-scheduler.

AI flow:
message → edge function → JSON proposal → app validates → user confirms → DB write.
