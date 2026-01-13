export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    createdAt: string;
}

export interface Proposal {
    id: string;
    type: 'task';
    title: string;
    notes?: string;
    dueDate?: string; // YYYY-MM-DD
}
