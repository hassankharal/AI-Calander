
// Helper to strip time and get YYYY-MM-DD
export function isoDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function startOfMonth(date: Date): Date {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function endOfMonth(date: Date): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0); // Last day of previous month
    d.setHours(23, 59, 59, 999);
    return d;
}

export function addMonths(date: Date, months: number): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}

export function getMonthGrid(currentDate: Date): Date[] {
    const start = startOfMonth(currentDate);
    // 0 = Sunday, 1 = Monday. Let's start week on Sunday.
    const startDay = start.getDay(); 
    
    // Go back to the 'Sunday' before the 1st of the month
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - startDay);

    // We usually want 6 rows (42 days) to cover all month possibilities
    const dates: Date[] = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        dates.push(d);
    }
    return dates;
}

export function formatTimeRange(startIso: string, endIso: string): string {
    const s = new Date(startIso);
    const e = new Date(endIso);
    const sStr = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const eStr = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${sStr} - ${eStr}`;
}

export function isSameMonth(d1: Date, d2: Date): boolean {
    return d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
}

export function isSameDay(d1: Date, d2: Date): boolean {
    return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
    );
}

export function isToday(d: Date): boolean {
    return isSameDay(d, new Date());
}
