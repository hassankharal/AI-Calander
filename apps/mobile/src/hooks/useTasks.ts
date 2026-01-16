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

    const addTask = async (input: { id?: string; title: string; notes?: string; dueDate?: string; isAnchor?: boolean }) => {
        await TaskStore.addTask(input);
        await loadTasks();
    };

    const completeTask = async (id: string) => {
        await TaskStore.completeTask(id);
        await loadTasks();
    };

    const restoreTask = async (task: Task) => {
        await TaskStore.restoreTask(task);
        await loadTasks();
    };

    const deleteTask = async (id: string) => {
        await TaskStore.deleteTask(id);
        await loadTasks();
    };

    const pendingTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    return {
        tasks, // All tasks
        pendingTasks,
        completedTasks,
        isLoading,
        addTask,
        completeTask,
        toggleCompleted: completeTask, // Alias for backward compat if needed
        restoreTask,
        deleteTask,
        refresh: loadTasks,
    };
};
