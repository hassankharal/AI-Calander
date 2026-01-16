import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage, SchedulerSessionState } from '../types/scheduler';

const SESSION_KEY = 'scheduler_session_v1';

export interface SchedulerSessionData {
  messages: ChatMessage[];
  state: SchedulerSessionState;
}

export const loadSchedulerSession = async (): Promise<SchedulerSessionData | null> => {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SchedulerSessionData;
  } catch (e) {
    console.error('Failed to load scheduler session', e);
    return null;
  }
};

export const saveSchedulerSession = async (
  messages: ChatMessage[],
  state: SchedulerSessionState
): Promise<void> => {
  try {
    const data: SchedulerSessionData = { messages, state };
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save scheduler session', e);
  }
};

export const clearSchedulerSession = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.error('Failed to clear scheduler session', e);
  }
};
