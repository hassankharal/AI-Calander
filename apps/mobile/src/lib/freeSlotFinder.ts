export type CandidateSlot = {
    startAt: string;
    endAt: string;
    label?: string; // e.g. "Tomorrow Morning"
};

type TimeWindow = {
    start: Date;
    end: Date;
};

// Helper to check if a candidate slot overlaps with any existing event
function hasOverlap(candidate: TimeWindow, events: TimeWindow[]): boolean {
    return events.some(e => {
        return candidate.start < e.end && candidate.end > e.start;
    });
}

function getLabel(date: Date, now: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const n = new Date(now);
    n.setHours(0, 0, 0, 0);

    const diffDays = (d.getTime() - n.getTime()) / (1000 * 60 * 60 * 24);
    
    let dayName = "";
    if (diffDays === 0) dayName = "Today";
    else if (diffDays === 1) dayName = "Tomorrow";
    else dayName = d.toLocaleDateString(undefined, { weekday: 'short' });

    const hours = date.getHours();
    let timeOfDay = "Morning";
    if (hours >= 12) timeOfDay = "Afternoon";
    if (hours >= 17) timeOfDay = "Evening";

    return `${dayName} ${timeOfDay}`;
}

export function findCandidateSlots({
    events,
    nowIso,
    daysAhead = 7,
    durationMinutes,
    dayStartHour = 9, // Start at 9am by default
    dayEndHour = 20, // End by 8pm
    stepMinutes = 30, // 30 min increments
    maxResults = 6
}: {
    events: { startAt: string; endAt: string }[];
    nowIso: string;
    daysAhead?: number;
    durationMinutes: number;
    dayStartHour?: number;
    dayEndHour?: number;
    stepMinutes?: number;
    maxResults?: number;
}): CandidateSlot[] {
    const now = new Date(nowIso);
    // Round now up to next 15/30 min slot if it's today
    
    const candidates: CandidateSlot[] = [];
    
    // Parse existing events into Date objects for easier comparison
    const busyWindows: TimeWindow[] = events.map(e => ({
        start: new Date(e.startAt),
        end: new Date(e.endAt)
    }));

    // Iterate days
    for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset++) {
        if (candidates.length >= maxResults) break;

        const currentDay = new Date(now);
        currentDay.setDate(now.getDate() + dayOffset);
        currentDay.setSeconds(0, 0);

        // Determine start time for this day
        let startTime = new Date(currentDay);
        startTime.setHours(dayStartHour, 0, 0, 0);

        // If 'today', ensure we don't suggest past times
        if (dayOffset === 0) {
            if (now > startTime) {
                // Round up to next slot
                const remainder = now.getMinutes() % stepMinutes;
                const add = stepMinutes - remainder;
                const nextSlot = new Date(now);
                nextSlot.setMinutes(now.getMinutes() + add, 0, 0);
                
                if (nextSlot > startTime) startTime = nextSlot;
            }
        }

        const dayEndTime = new Date(currentDay);
        dayEndTime.setHours(dayEndHour, 0, 0, 0);

        // Loop through slots in the day
        while (startTime < dayEndTime) {
            if (candidates.length >= maxResults) break;

            const slotEnd = new Date(startTime);
            slotEnd.setMinutes(startTime.getMinutes() + durationMinutes);

            if (slotEnd > dayEndTime) break; // Slot goes past end of day

            const slotWindow = { start: startTime, end: slotEnd };

            if (!hasOverlap(slotWindow, busyWindows)) {
                candidates.push({
                    startAt: startTime.toISOString(),
                    endAt: slotEnd.toISOString(),
                    label: getLabel(startTime, now),
                });
                
                // Jump a bit more to give variety? 
                // Currently just stepping by stepMinutes (e.g. 9:00, 9:30).
                // If we want variety, we might want to skip if we just found one?
                // For now, simple list is fine.
            }

            // Next step
            startTime = new Date(startTime);
            startTime.setMinutes(startTime.getMinutes() + stepMinutes);
        }
    }

    return candidates;
}
