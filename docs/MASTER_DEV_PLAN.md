# Master development plan (source of truth)
_Last updated: 2026-01-12_

Each step = one Issue + one PR.

## Phase 1 — Repo/CI
- P1-S1: GitHub repo + branch protection
- P1-S2: Expo scaffold + navigation skeleton
- P1-S3: ESLint/Prettier/TS scripts
- P1-S4: CI workflow

## Phase 2 — Supabase
- P2-S1: Supabase staging/prod + env handling
- P2-S2: Supabase CLI init + migrations workflow
- P2-S3: Auth + profiles + baseline RLS

## Phase 3 — App skeleton
- P3-S1: Nav (Auth stack + tabs)
- P3-S2: Supabase client + session persistence
- P3-S3: Auth UI

## Phase 4 — Schema
- P4-S1: preferences/events/tasks/reminders tables
- P4-S2: RLS policies per table
- P4-S3: seed (optional)

## Phase 5 — Calendar
- P5-S1: Calendar views
- P5-S2: Event CRUD
- P5-S3: Conflict warnings

## Phase 6 — Tasks + Home
- P6-S1: Task CRUD
- P6-S2: Home aggregation
- P6-S3: Today-mode polish

## Phase 7 — Onboarding (scripted chat)
- P7-S1: onboarding gate
- P7-S2: chat UI component
- P7-S3: scripted questions
- P7-S4: save preferences

## Phase 8 — AI Scheduler
- P8-S1: JSON contract + zod validation
- P8-S2: Edge Function ai-scheduler
- P8-S3: wire Scheduler chat
- P8-S4: follow-up loop
- P8-S5: conflict negotiation + alternatives
- P8-S6: vague tasks auto-slot suggestions

## Phase 9 — Reminders
- P9-S1: reminder rules
- P9-S2: expo notifications
- P9-S3: settings

## Phase 10 — Release readiness
- P10-S1: logging (optional)
- P10-S2: tests + QA scripts
- P10-S3: EAS profiles
- P10-S4: store prep
