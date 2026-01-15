export interface Task {
  id: string;
  title: string;
  notes?: string;
  dueDate?: string; // "YYYY-MM-DD"
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  scheduledEventId?: string | null;
}
