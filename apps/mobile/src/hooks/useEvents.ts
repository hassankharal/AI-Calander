import { useState, useCallback, useEffect } from 'react';
import { Event } from '../types/event';
import * as EventStore from '../data/eventStore';

export const useEvents = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadEvents = useCallback(async () => {
        try {
            const data = await EventStore.getEvents();
            setEvents(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    const addEvent = async (input: {
        id?: string;
        title: string;
        startAt: string;
        endAt: string;
        location?: string;
        notes?: string;
        allDay?: boolean;
        isAnchor?: boolean;
    }) => {
        const newEvent = await EventStore.addEvent(input);
        await loadEvents();
        return newEvent;
    };

    const updateEvent = async (id: string, patch: Partial<Omit<Event, 'id' | 'createdAt'>>) => {
        await EventStore.updateEvent(id, patch);
        await loadEvents();
    };

    const deleteEvent = async (id: string) => {
        await EventStore.deleteEvent(id);
        await loadEvents();
    };

    const findConflicts = async (startAt: string, endAt: string, excludeEventId?: string) => {
        return await EventStore.findConflicts(startAt, endAt, excludeEventId);
    };

    return {
        events,
        isLoading,
        addEvent,
        updateEvent,
        deleteEvent,
        refresh: loadEvents,
        findConflicts,
    };
};
