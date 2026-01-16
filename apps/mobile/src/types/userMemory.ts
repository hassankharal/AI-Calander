export type EnergyPeak = {
  label: "morning" | "afternoon" | "evening";
  start: string;
  end: string;
};

export type LowEnergyBlock = {
  start: string;
  end: string;
};

export type WeeklyBlock = {
  start: string;
  end: string;
  label?: string;
  kind?: "work" | "class" | "clinical" | "training" | "other";
};

export type WeeklyAvailability = {
  days: string[]; // ["Mon", "Tue", ...]
  blocks: WeeklyBlock[];
};

export type FixedRoutine = {
  title: string;
  days: string[];
  start: string;
  end: string;
  location?: string | null;
  notes?: string | null;
};

export type MealTime = {
  label: "breakfast" | "lunch" | "dinner" | "snack";
  time: string;
};

export type FocusBlockPrefs = {
  preferredDurations: number[];
  maxPerDay?: number;
};

export type RemindersPref = {
  defaultReminderMinutesBefore?: number;
  allowMultipleReminders?: boolean;
};

export type DoNotScheduleRule = {
  start: string;
  end: string;
  days?: string[];
  label?: string;
};

export type CommonLocation = {
  label: string;
  addressText: string;
};

export type UserMemory = {
  // Identity
  preferredName?: string;
  pronouns?: string;

  // Timezone
  timezone: string;

  // Sleep & Energy
  sleepWindow: { start: string; end: string };
  idealSleepHours?: number;
  energyPeaks?: EnergyPeak[];
  lowEnergyTimes?: LowEnergyBlock[];

  // Work / Routines
  weeklyAvailability: WeeklyAvailability[];
  fixedRoutines: FixedRoutine[];

  // Meals
  mealTimes: MealTime[];

  // Task Planning
  defaultEventMinutes: number;
  defaultTaskMinutes: number;
  focusBlockPreferences?: FocusBlockPrefs;
  remindersPreference?: RemindersPref;

  // Rules
  doNotSchedule: DoNotScheduleRule[];
  bufferBetweenEventsMinutes?: number;
  schedulingStyle?: "packed" | "balanced" | "spaced";

  // Locations
  commonLocations?: CommonLocation[];
  defaultLocationLabel?: string;

  // Categories
  taskCategories?: string[];
  eventCategories?: string[];
};
