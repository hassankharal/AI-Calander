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

export const addTask = async (input: { title: string; notes?: string; dueDate?: string }): Promise<Task> => {
    const tasks = await getTasks();
    const newTask: Task = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        title: input.title,
        notes: input.notes,
        dueDate: input.dueDate,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    const updatedTasks = [...tasks, newTask];
    // Sort before saving to ensure consistency
    const sortedTasks = sortTasks(updatedTasks);
    await saveTasks(sortedTasks);
    return newTask;
};

export const toggleTaskCompleted = async (id: string): Promise<void> => {
    const tasks = await getTasks();
    const updatedTasks = tasks.map(t =>
        t.id === id ? { ...t, completed: !t.completed, updatedAt: new Date().toISOString() } : t
    );
    await saveTasks(sortTasks(updatedTasks));
};

export const deleteTask = async (id: string): Promise<void> => {
    const tasks = await getTasks();
    const updatedTasks = tasks.filter(t => t.id !== id);
    // No need to resort if we just remove one, but good practice if sort depended on other factors
    await saveTasks(updatedTasks);
};
