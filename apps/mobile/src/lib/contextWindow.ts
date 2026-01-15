import { Event } from '../types/event';

export function getWindowRangeDays(nowIso: string, days: number): { startIso: string, endIso: string } {
    const start = new Date(nowIso);
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    return {
        startIso: start.toISOString(),
        endIso: end.toISOString()
    };
}

export function sliceEventsToWindow(events: Event[], startIso: string, endIso: string): Event[] {
    return events.filter(e => {
        // Event overlaps window if: eventStart < windowEnd && eventEnd > windowStart
        return e.startAt < endIso && e.endAt > startIso;
    });
}
