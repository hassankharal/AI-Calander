import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task } from '../types/task';

const STORAGE_KEY = 'AI_CALANDER_TASKS_V1';

const sortTasks = (tasks: Task[]): Task[] => {
    return tasks.sort((a, b) => {
        // 1. Incomplete first
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }

        // 2. Tasks with due dates come before tasks without due dates
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;

        // 3. Due Date Ascending (earliest first)
        if (a.dueDate && b.dueDate) {
            const dateComparison = a.dueDate.localeCompare(b.dueDate);
            if (dateComparison !== 0) return dateComparison;
        }

        // 4. Fallback to creation date (newest first)
        return b.createdAt.localeCompare(a.createdAt);
    });
};

export const getTasks = async (): Promise<Task[]> => {
    try {
        const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
        const tasks: Task[] = jsonValue != null ? JSON.parse(jsonValue) : [];
        return sortTasks(tasks);
    } catch (e) {
        console.error('Failed to load tasks', e);
        return [];
    }
};

export const saveTasks = async (tasks: Task[]): Promise<void> => {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
        console.error('Failed to save tasks', e);
    }
};

import { createId } from '../lib/id';

// ... (imports)

export const addTask = async (input: { id?: string; title: string; notes?: string; dueDate?: string }): Promise<Task> => {
    const tasks = await getTasks();
    const newTask: Task = {
        id: input.id || createId(),
        title: input.title,
        notes: input.notes,
        dueDate: input.dueDate,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        scheduledEventId: null
    };

    const updatedTasks = [...tasks, newTask];
    const sortedTasks = sortTasks(updatedTasks);
    await saveTasks(sortedTasks);
    return newTask;
};

// Use this for Undo functionality
export const restoreTask = async (task: Task): Promise<void> => {
    const tasks = await getTasks();
    // Avoid duplicates
    if (tasks.find(t => t.id === task.id)) return;
    
    // Ensure it's active if we are restoring? Or keep original state?
    // Usually undoing a schedule means it goes back to 'pending'.
    // If we restore a 'completed' task, it should stay completed?
    // The requirement says "Undo should restore both the event and the task".
    // Usually this is about "Undo Schedule". So task should be incomplete.
    
    const updatedTasks = [...tasks, task];
    await saveTasks(sortTasks(updatedTasks));
};

export const completeTask = async (id: string): Promise<void> => {
    const tasks = await getTasks();
    const now = new Date().toISOString();
    const updatedTasks = tasks.map(t => {
        if (t.id === id) {
             const isComplete = !t.completed; // Toggle
             return {
                 ...t,
                 completed: isComplete,
                 completedAt: isComplete ? now : null,
                 updatedAt: now
             };
        }
        return t;
    });
    await saveTasks(sortTasks(updatedTasks));
};

export const attachScheduledEvent = async (taskId: string, eventId: string): Promise<void> => {
     const tasks = await getTasks();
     const updatedTasks = tasks.map(t => 
         t.id === taskId ? { ...t, scheduledEventId: eventId, updatedAt: new Date().toISOString() } : t
     );
     await saveTasks(sortTasks(updatedTasks));
};

export const deleteTask = async (id: string): Promise<void> => {
    const tasks = await getTasks();
    const updatedTasks = tasks.filter(t => t.id !== id);
    await saveTasks(updatedTasks);
};
