# AI Scheduler Contract (Strict JSON)

Return one of:
- follow_up (questions[])
- propose_event (proposal + conflicts[])
- conflict (conflict + alternatives + override_allowed)
- propose_task (proposal + suggested_slots)
- error (code + message)

App validates JSON (zod). User must confirm before saving.
