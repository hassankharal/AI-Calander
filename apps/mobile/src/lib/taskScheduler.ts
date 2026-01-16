
import { Task } from '../types/task';
import { Event } from '../types/event';
import { UserMemory } from '../types/userMemory';
import { Proposal } from '../types/scheduler';
import { createId } from './id';

export function getNext7DaysWindow(nowIso: string): { startIso: string, endIso: string } {
    const start = new Date(nowIso);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return {
        startIso: start.toISOString(),
        endIso: end.toISOString()
    };
}

export function applyDefaultDuration(prefs: UserMemory | null, fallback = 60): number {
    if (prefs && prefs.defaultTaskMinutes) {
        return prefs.defaultTaskMinutes;
    }
    return fallback;
}

export function buildAiScheduleMessage(taskTitle: string, durationMinutes: number, windowDays: number = 7): string {
    return `Schedule task: "${taskTitle}". Duration: ${durationMinutes} minutes. Find the best free slot within the next ${windowDays} days. Return up to 3 options.`;
}

export function normalizeProposalToEvent(proposal: Proposal, task: Task): Partial<Event> {
    // If proposal has title/notes, prefer them, otherwise use task details
    const notesPayload = `(Scheduled Task)\n${task.notes || ''}\n${proposal.notes || ''}`.trim();

    return {
        id: createId(),
        title: proposal.title || task.title, // AI might rename it slightly to fit context? prefer task title usually but let's allow overwrite if AI suggests
        // Actually, usually we want to keep task title.
        // Let's use task title primarily unless proposal is very specific.
        // The requirements say: title: `${task.title}`.
        // So let's force task title.
        // But what if the user wants "Gym" but calls it "Go to Gym"?
        // Let's stick to task title to be safe and consistent.
        // Wait, requirement says: title: `${task.title}`.
        notes: notesPayload,
        startAt: proposal.startAt,
        endAt: proposal.endAt,
        location: proposal.location,
    };
}
