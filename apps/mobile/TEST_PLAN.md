# Mobile Test Plan (Detailed) — AI-Calander (Agent)

This plan verifies the intended product behavior end-to-end. Follow in order.

---

## 0) Environment + Build

### 0.1 Prereqs
- Node + npm available
- Expo CLI via `npx expo`
- Device: Expo Go (iOS/Android) or simulator

### 0.2 Install
From repo root:
1) `npm ci`

From `apps/mobile`:
2) `npm ci`

### 0.3 Environment variables
1) Ensure `apps/mobile/.env.example` exists.
2) Create `apps/mobile/.env` with:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3) Confirm `.env` is ignored by git.

### 0.4 Static checks
From `apps/mobile`:
- `npm run typecheck`
- `npm run lint`

### 0.5 Start app
From `apps/mobile`:
- `npx expo start -c`
Confirm:
- App opens without red screen
- Metro logs do not spam continuously
- SafeAreaView deprecation warning is acceptable (not a blocker)

---

## 1) Onboarding

### 1.1 First-run flow
1) Fresh install / clear app storage
2) Launch app
3) Complete onboarding: set any required prefs (timezone, default durations, buffers, etc.)

Expected:
- Onboarding completes successfully
- Preferences persist (no immediate reset)

### 1.2 Persistence
1) Fully close app
2) Relaunch

Expected:
- Onboarding does NOT appear again
- User lands on Home

---

## 2) Home

### 2.1 Core rendering
Expected on Home:
- Today’s tasks section exists
- Upcoming events section exists
- No UI crash when lists are empty

### 2.2 Morning Calibration (one sentence)
Expected:
- Exactly one sentence (no emojis, no greeting)
- Uses today’s events count and “before noon” logic
- Does NOT log repeatedly every render

Validation cases (create events to force each):
A) 0 events today -> "Open runway this morning. Prioritize one meaningful output."
B) >=4 events today -> "High context switching. Recovery buffers recommended."
C) >=2 events starting before 12:00 -> "Execution day. Deep work protected until noon."
D) Otherwise -> "Balanced day. Maintain momentum."

### 2.3 Schedule settling presence
Expected:
- Subtle animation/pulse on Home that ends automatically
- Does not block touches/scrolling
- No "Optimizing..." text or spinners required

---

## 3) Calendar

### 3.1 Month view renders
Expected:
- Month title displays correctly
- 7-column grid renders
- Tapping a day selects it

### 3.2 Event dots
1) Create an event for today
2) Return to month grid

Expected:
- Dot appears on the date that has an event

### 3.3 Event CRUD
A) Create:
1) Tap Add (+)
2) Enter title, set time and duration
3) Save

Expected:
- Event appears in agenda list for selected day
- Home shows updated event count

B) Edit:
1) Tap event in agenda list
2) Change title/time/duration
3) Save

Expected:
- Changes persist after navigating away and back

C) Delete:
1) Open event
2) Delete

Expected:
- Event removed from Calendar and Home

### 3.4 No refresh loop
Expected:
- Calendar should not spam logs indefinitely
- Switching tabs should not cause infinite re-renders

---

## 4) Scheduler

### 4.1 Session persistence
1) Open Scheduler
2) Send message: "Bank appointment tomorrow"
3) Navigate away to another tab
4) Return to Scheduler

Expected:
- Conversation history remains
- Pending proposals remain if they existed

### 4.2 New chat
1) Tap New Chat
2) Confirm clear

Expected:
- Conversation cleared
- Proposals cleared
- Clean initial prompt appears

### 4.3 Multi-turn follow-up behavior
Test message:
- "I have a bank appointment"

Expected:
- Assistant asks only for missing required fields (time/day/location if needed)
- Tone stays concise (no bubbly greetings)

### 4.4 Proposal rendering + commit
1) Request: "Schedule team meeting tomorrow at 10am"
2) Wait for proposal card
3) Hold to Save

Expected:
- Proposal is committed
- Event appears in Calendar + Home

### 4.5 Conflict detection
Setup:
1) Create event tomorrow 10:00–11:00 in Calendar
2) In Scheduler, request another event tomorrow at 10:30

Expected:
- Conflict UI appears
- Confirmation required behavior triggers

### 4.6 Energy-first placement bias
Test deep work:
- "Study COMP 2150 for 2 hours"
Expected:
- Slot finder prefers peak window (09:00–12:00) when choosing times or moving

Test shallow:
- "Emails/admin"
Expected:
- Slot finder prefers slump window (13:00–16:00)

---

## 5) Tasks

### 5.1 Create/Edit
1) Create task "Write report"
2) Edit title/notes/due date (if exists)

Expected:
- Changes persist

### 5.2 Anchor toggle
1) Mark a task as Anchor (Non-Negotiable)
2) Close app, reopen

Expected:
- Anchor flag persists
- Task shows an Anchor indicator/tag

### 5.3 Scheduling from Tasks (speed)
1) From Tasks tab, schedule a task
Expected:
- Scheduling is quick (local slot finder first; no long waits)
- Scheduled task disappears from pending tasks list

### 5.4 Undo behavior
1) Schedule a task that creates an event and removes a task
2) Tap Undo

Expected:
- Event is removed
- Task returns to pending list

### 5.5 Anchor protection
1) Create an Anchor task occupying a window (if tasks have scheduled times) OR ensure anchor exists
2) Create a conflicting scheduling action in Scheduler

Expected:
- Anchor tasks are never deleted or moved automatically
- If conflict involves anchor, require confirmation / show conflict

---

## 6) Regression + Stability

### 6.1 Navigation stability
- Switch between Home / Calendar / Scheduler / Tasks repeatedly

Expected:
- No crashes
- No exponential log spam
- No state resets

### 6.2 Data consistency
Expected:
- One canonical events store
- Scheduler-created events appear in Calendar/Home
- Calendar CRUD updates also visible in Home and Scheduler events window

---

## Exit Criteria
Pass if:
- No crashes
- Typecheck + lint clean
- All flows above behave as expected
- No runaway console logs
