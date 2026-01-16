import { Proposal } from '../types/scheduler';

export interface CommitPayload {
  title: string;
  notes?: string;
  location?: string;
  startAt?: string;
  endAt?: string;
  dueDate?: string;
}

export function buildEventFromIntent(
  intent: Proposal // "Proposal" is the shape used in SchedulerScreen list
): CommitPayload {
  const title = (intent.title || 'Untitled Event').trim();
  
  // Validation Helpers
  const isValidDate = (d: Date) => !isNaN(d.getTime());
  
  if (intent.type === 'task') {
    // For tasks, we just need title and optional dueDate/notes
    return {
      title,
      notes: intent.notes,
      dueDate: intent.dueDate, // Already cleaned by Edge Function ideally
    };
  }

  // EVENT LOGIC
  
  // 1. Validate Start Time
  if (!intent.startAt) {
    throw new Error("Cannot schedule event: Missing start time.");
  }
  const start = new Date(intent.startAt);
  if (!isValidDate(start)) {
    throw new Error(`Invalid start time: ${intent.startAt}`);
  }

  // 2. Validate/Calc End Time
  let end: Date;
  if (intent.endAt) {
    end = new Date(intent.endAt);
  } else {
    // Default 60 mins if missing
    end = new Date(start);
    end.setMinutes(end.getMinutes() + 60);
  }

  if (!isValidDate(end)) {
    throw new Error(`Invalid end time: ${intent.endAt}`);
  }

  if (end <= start) {
      // Force end to be after start (min 15 mins)
      end = new Date(start);
      end.setMinutes(end.getMinutes() + 15);
  }

  return {
    title,
    location: intent.location,
    notes: intent.notes,
    startAt: start.toISOString(),
    endAt: end.toISOString()
  };
}
