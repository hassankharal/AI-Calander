import AsyncStorage from '@react-native-async-storage/async-storage';
import { Event } from '../types/event';

const STORAGE_KEY = 'AI_CALANDER_EVENTS_V1';

const sortEvents = (events: Event[]): Event[] => {
    return events.sort((a, b) => a.startAt.localeCompare(b.startAt));
};

export const getEvents = async (): Promise<Event[]> => {
    try {
        const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
        const events: Event[] = jsonValue != null ? JSON.parse(jsonValue) : [];
        return sortEvents(events);
    } catch (e) {
        console.error('Failed to load events', e);
        return [];
    }
};

export const saveEvents = async (events: Event[]): Promise<void> => {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch (e) {
        console.error('Failed to save events', e);
    }
};

export const findConflicts = async (startAt: string, endAt: string, excludeEventId?: string): Promise<Event[]> => {
    const events = await getEvents();
    const start = new Date(startAt).getTime();
    const end = new Date(endAt).getTime();

    return events.filter(e => {
        if (excludeEventId && e.id === excludeEventId) return false;

        const otherStart = new Date(e.startAt).getTime();
        const otherEnd = new Date(e.endAt).getTime();

        // Overlap: start < otherEnd AND end > otherStart
        return start < otherEnd && end > otherStart;
    });
};

import { createId } from '../lib/id';

// ...

export const addEvent = async (input: {
    id?: string;
    title: string;
    startAt: string;
    endAt: string;
    location?: string;
    notes?: string;
    allDay?: boolean;
}): Promise<Event> => {
    const events = await getEvents();
    const newEvent: Event = {
        id: input.id || createId(),
        title: input.title,
        startAt: input.startAt,
        endAt: input.endAt,
        location: input.location,
        notes: input.notes,
        allDay: input.allDay,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    const updatedEvents = [...events, newEvent];
    await saveEvents(sortEvents(updatedEvents));
    return newEvent;
};

export const updateEvent = async (id: string, patch: Partial<Omit<Event, 'id' | 'createdAt'>>): Promise<void> => {
    const events = await getEvents();
    const updatedEvents = events.map(e =>
        e.id === id
            ? { ...e, ...patch, updatedAt: new Date().toISOString() }
            : e
    );
    await saveEvents(sortEvents(updatedEvents));
};

export const deleteEvent = async (id: string): Promise<void> => {
    const events = await getEvents();
    const updatedEvents = events.filter(e => e.id !== id);
    await saveEvents(updatedEvents);
};
