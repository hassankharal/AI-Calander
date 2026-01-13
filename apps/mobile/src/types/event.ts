export interface Event {
    id: string;
    title: string;
    location?: string;
    notes?: string;
    startAt: string; // ISO datetime
    endAt: string;   // ISO datetime
    allDay?: boolean;
    createdAt: string;
    updatedAt: string;
}
