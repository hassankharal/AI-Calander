import { useState, useCallback, useEffect } from 'react';
import { Task } from '../types/task';
import * as TaskStore from '../data/taskStore';

export const useTasks = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadTasks = useCallback(async () => {
        try {
            // Don't set loading to true every time to avoid flicker on refresh, 
            // but initial load should show loading.
            const data = await TaskStore.getTasks();
            setTasks(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    const addTask = async (input: { title: string; notes?: string; dueDate?: string }) => {
        await TaskStore.addTask(input);
        await loadTasks();
    };

    const toggleCompleted = async (id: string) => {
        await TaskStore.toggleTaskCompleted(id);
        await loadTasks();
    };

    const deleteTask = async (id: string) => {
        await TaskStore.deleteTask(id);
        await loadTasks();
    };

    return {
        tasks,
        isLoading,
        addTask,
        toggleCompleted,
        deleteTask,
        refresh: loadTasks,
    };
};
