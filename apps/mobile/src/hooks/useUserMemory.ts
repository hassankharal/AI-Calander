import { useState, useEffect, useCallback } from 'react';
import { UserMemory } from '../types/userMemory';
import { loadUserMemory, saveUserMemory, clearUserMemory } from '../data/userMemoryStore';

export function useUserMemory() {
  const [memory, setMemory] = useState<UserMemory | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const m = await loadUserMemory();
    setMemory(m || null); // Keep null if not found, let App handle onboarding trigger
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line
    refresh();
  }, [refresh]);

  const saveMemory = async (newMemory: UserMemory) => {
    setMemory(newMemory);
    await saveUserMemory(newMemory);
  };

  const resetMemory = async () => {
    await clearUserMemory();
    setMemory(null);
  };

  return {
    memory,
    loading,
    saveMemory,
    resetMemory,
    refresh
  };
}
