export interface EnergyProfile {
  peakStart: string; // HH:MM
  peakEnd: string;
  slumpStart: string;
  slumpEnd: string;
}

const DEFAULT_PROFILE: EnergyProfile = {
  peakStart: "09:00",
  peakEnd: "12:00",
  slumpStart: "13:00",
  slumpEnd: "16:00"
};

const DEEP_KEYWORDS = ["study", "build", "code", "write", "project", "design", "assignment", "report"];
const SHALLOW_KEYWORDS = ["email", "emails", "admin", "call", "calls", "slack", "message", "messages", "errand", "errands", "groceries"];

export function getDefaultEnergyProfile(): EnergyProfile {
  return DEFAULT_PROFILE;
}

export function classifyEnergy(title: string): "deep" | "shallow" {
  const lower = title.toLowerCase();
  
  if (DEEP_KEYWORDS.some(k => lower.includes(k))) {
    return "deep";
  }
  
  if (SHALLOW_KEYWORDS.some(k => lower.includes(k))) {
    return "shallow";
  }

  // Default to shallow if ambiguous, but maybe user wants deep default? 
  // Requirement says: "If 'deep', start peak. If 'shallow', start slump."
  // It doesn't specify 'neutral', so let's default to shallow for safety to avoid taking prime time.
  return "shallow";
}

export function getWindowStartIso(baseDate: Date, timeStr: string): string {
  // timeStr is HH:MM
  const [hh, mm] = timeStr.split(':').map(Number);
  const d = new Date(baseDate);
  d.setHours(hh, mm, 0, 0);
  
  // If baseDate is already past this time today, maybe we strictly stick to "today" or move to tomorrow?
  // The requirement says "start searching from today at peakStart". 
  // We will return ISO for today at that time.
  return d.toISOString();
}

export function isWithinWindow(iso: string, startHHMM: string, endHHMM: string): boolean {
  const date = new Date(iso);
  const minutes = date.getHours() * 60 + date.getMinutes();
  
  const [sH, sM] = startHHMM.split(':').map(Number);
  const startMins = sH * 60 + sM;
  
  const [eH, eM] = endHHMM.split(':').map(Number);
  const endMins = eH * 60 + eM;
  
  return minutes >= startMins && minutes < endMins;
}
