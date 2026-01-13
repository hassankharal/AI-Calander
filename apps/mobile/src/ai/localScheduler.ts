import { Proposal } from '../types/scheduler';

export function parseUserRequest(text: string, now: Date): { assistantText: string; proposals: Proposal[] } {
    let title = text.trim();

    // Remove common prefixes
    const prefixes = ["i need to", "i have to", "remind me to"];
    const lowerText = title.toLowerCase();

    for (const prefix of prefixes) {
        if (lowerText.startsWith(prefix)) {
            title = title.substring(prefix.length).trim();
            break;
        }
    }

    // Capitalize first letter of title for niceness
    if (title.length > 0) {
        title = title.charAt(0).toUpperCase() + title.slice(1);
    }

    let dueDate: string | undefined;
    const lowerTitle = title.toLowerCase();

    // Simple date parsing
    if (lowerTitle.includes('today')) {
        dueDate = now.toISOString().split('T')[0];
    } else if (lowerTitle.includes('tomorrow')) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        dueDate = tomorrow.toISOString().split('T')[0];
    } else if (lowerTitle.includes('this week')) {
        const threeDaysLater = new Date(now);
        threeDaysLater.setDate(threeDaysLater.getDate() + 3);
        dueDate = threeDaysLater.toISOString().split('T')[0];
    }

    // Create a proposal
    // We only support 'task' type for now as per requirements
    const proposal: Proposal = {
        id: Date.now().toString(),
        type: 'task',
        title: title,
        dueDate: dueDate,
        notes: undefined, // Could extract notes if we wanted to be fancy, but keeping it simple
    };

    return {
        assistantText: "I can add this as a task. Want me to save it?",
        proposals: [proposal]
    };
}
