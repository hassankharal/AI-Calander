export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    createdAt: string;
}

export interface Proposal {
    id: string;
    type: 'task' | 'event';
    title: string;
    notes?: string;
    dueDate?: string; // YYYY-MM-DD (for tasks)
    startAt?: string; // ISO datetime (for events)
    endAt?: string;   // ISO datetime (for events)
    location?: string;
    confidence?: number;
    isAnchor?: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface SchedulerSessionState {
    pendingIntent: any | null;
    awaitingFields: string[];
    lastQuestion: string | null;
    lastProposals: any[] | null;
    lastUserMessageId: string | null;
}
