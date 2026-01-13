# Product spec (MVP)

## In scope
- Auth (email/password)
- Settings: work hours, sleep schedule + desired sleep, meal times, timezone, notifications
- Onboarding: chat-style capture (scripted first)
- Calendar: day/month/year + event CRUD + conflict warning
- Tasks: CRUD + due date + estimate + optional scheduled time + status
- Home: today timeline + tasks due today + upcoming dates + reminders preview
- Scheduler AI: chat → follow-ups → proposal JSON → user confirms → save
- Notifications: reminders + quiet hours

## Key rule
AI returns strict JSON proposals only (no silent writes).
