# DB Schema + RLS

Tables: profiles, user_preferences, events, tasks, reminders.

RLS: user can only access rows where `auth.uid() = user_id` (profiles uses `id`).
