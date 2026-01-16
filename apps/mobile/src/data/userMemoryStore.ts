import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserMemory } from '../types/userMemory';

const USER_MEMORY_KEY = 'AI_CALANDER_USER_MEMORY_V1';

export const defaultUserMemory = (): UserMemory => ({
  timezone: "America/Winnipeg",
  sleepWindow: { start: "23:00", end: "07:00" },
  idealSleepHours: 8,
  energyPeaks: [],
  lowEnergyTimes: [],
  weeklyAvailability: [],
  fixedRoutines: [],
  mealTimes: [
    { label: "breakfast", time: "08:00" },
    { label: "lunch", time: "12:30" },
    { label: "dinner", time: "18:30" }
  ],
  defaultEventMinutes: 60,
  defaultTaskMinutes: 30,
  doNotSchedule: [],
  schedulingStyle: "balanced",
  taskCategories: ["Health", "School", "Work", "Admin", "Fitness"]
});

export const loadUserMemory = async (): Promise<UserMemory | null> => {
  try {
    const json = await AsyncStorage.getItem(USER_MEMORY_KEY);
    if (!json) return null;
    return JSON.parse(json);
  } catch (e) {
    console.error('Failed to load user memory', e);
    return null;
  }
};

export const saveUserMemory = async (mem: UserMemory): Promise<void> => {
  try {
    await AsyncStorage.setItem(USER_MEMORY_KEY, JSON.stringify(mem));
  } catch (e) {
    console.error('Failed to save user memory', e);
  }
};

export const clearUserMemory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(USER_MEMORY_KEY);
  } catch (e) {
    console.error('Failed to clear user memory', e);
  }
};
