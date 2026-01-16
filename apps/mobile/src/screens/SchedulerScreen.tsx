import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Animated,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTasks } from '../hooks/useTasks';
import { useEvents } from '../hooks/useEvents';
import { useUserMemory } from '../hooks/useUserMemory';
import { callAiScheduler } from '../lib/aiClient';
import { createId } from '../lib/id';
import { ChatMessage, Proposal, SchedulerSessionState } from '../types/scheduler';
import { Event } from '../types/event';
import {
  loadSchedulerSession,
  saveSchedulerSession,
  clearSchedulerSession
} from '../state/schedulerSessionStore';
import { buildEventFromIntent } from '../lib/commitIntent';
import { classifyEnergy, getDefaultEnergyProfile, getWindowStartIso } from '../lib/energyProfile';

// --- Helper Logic for Conflicts ---

const DEFAULT_EVENT_MINUTES = 60;

function addMinutes(isoString: string, minutes: number): string {
  const d = new Date(isoString);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function getDurationMinutes(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 60000;
}

// Check if two intervals overlap
function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && endA > startB;
}

function stripGreetingAndEmojiStyle(text: string): string {
  let clean = text.trim();
  // Remove leading emojis (simple range for common ones) and space
  clean = clean.replace(/^[\u{1F300}-\u{1FAD6}]\s*/u, '');
  // Remove greetings
  clean = clean.replace(/^(Hey|Hi|Hello|Greetings)\s*,?\s*/i, '');
  // Ensure capital start
  if (clean.length > 0) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  return clean;
}

const INITIAL_SESSION_STATE: SchedulerSessionState = {
  pendingIntent: null,
  awaitingFields: [],
  lastQuestion: null,
  lastProposals: null,
  lastUserMessageId: null,
};

export default function SchedulerScreen() {
  const { addTask, deleteTask } = useTasks();
  const { events, addEvent, deleteEvent } = useEvents();
  const { memory } = useUserMemory();

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingProposals, setPendingProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);

  // Session State
  const [sessionState, setSessionState] = useState<SchedulerSessionState>(INITIAL_SESSION_STATE);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  // Undo State
  const [showUndo, setShowUndo] = useState(false);
  const [lastAction, setLastAction] = useState<{ type: 'task' | 'event', id: string } | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Conflict State
  const [conflicts, setConflicts] = useState<{ proposalId: string, event: Event }[]>([]);

  const flatListRef = useRef<FlatList>(null);

  // --- Persistence ---

  // Load on mount
  useEffect(() => {
    const initSession = async () => {
      const data = await loadSchedulerSession();
      if (data) {
        setMessages(data.messages);
        setSessionState(data.state);
        if (data.state.lastProposals) {
          setPendingProposals(data.state.lastProposals);
        }
      } else {
        // Seed initial greeting
        setMessages([{
          id: createId(),
          role: 'assistant',
          text: "What would you like to schedule?",
          createdAt: new Date().toISOString(),
        }]);
      }
      setIsSessionLoaded(true);
    };
    initSession();
  }, []);

  // Save on change
  useEffect(() => {
    if (!isSessionLoaded) return;
    const timeout = setTimeout(() => {
      saveSchedulerSession(messages, {
        ...sessionState,
        lastProposals: pendingProposals.length > 0 ? pendingProposals : null
      });
    }, 500); // Debounce
    return () => clearTimeout(timeout);
  }, [messages, sessionState, isSessionLoaded, pendingProposals]);


  // --- AI Interaction ---

  const handleSend = async () => {
    if (!inputText.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: createId(),
      role: 'user',
      text: inputText,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    // Optimistic update
    setSessionState(prev => ({
      ...prev,
      lastUserMessageId: userMsg.id
    }));

    // Prepare Thread (last 10 messages)
    const thread = [...messages, userMsg].slice(-10).map(m => ({
      role: m.role,
      text: m.text
    }));

    // Events Window (next 7 days, minimal fields)
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);
    const minimalEvents = events
      .filter(e => e.startAt >= now.toISOString() && e.startAt <= nextWeek.toISOString())
      .map(e => ({
        id: e.id,
        title: e.title,
        startAt: e.startAt,
        endAt: e.endAt
      }));

    const payload = {
      message: userMsg.text,
      nowIso: new Date().toISOString(),
      timezone: memory?.timezone || "America/Winnipeg",
      prefs: memory || {},
      thread,
      sessionState,
      eventsWindow: minimalEvents
    };

    try {
      const response = await callAiScheduler(payload);

      if (response.ok) {
        const data = response.data;

        // Assistant Message
        let cleanAiText = stripGreetingAndEmojiStyle(data.assistantText);
        if (data.followUpQuestion) {
          const cleanFollowUp = stripGreetingAndEmojiStyle(data.followUpQuestion);
          cleanAiText = `${cleanAiText}\n${cleanFollowUp}`;
        }

        const aiMsg: ChatMessage = {
          id: createId(),
          role: 'assistant',
          text: cleanAiText,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aiMsg]);

        // Handle Mode
        if (data.mode === 'followup') {
          setSessionState(prev => ({
            ...prev,
            pendingIntent: data.updatedIntent || prev.pendingIntent,
            awaitingFields: data.missingFields || [],
            lastQuestion: data.followUpQuestion,
            lastProposals: null
          }));
        } else if (data.mode === 'intent' || data.mode === 'proposal') {
          // Clear pending state as we are presenting a proposal
          setSessionState({
            ...INITIAL_SESSION_STATE,
            lastUserMessageId: userMsg.id
          });

          if (data.proposals) {
            processProposals(data.proposals);
          }
        }
      } else {
        // Error handling
        const errorMsg: ChatMessage = {
          id: createId(),
          role: 'assistant',
          text: response.bodyText || "Sorry, I had trouble connecting.",
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, {
        id: createId(),
        role: 'assistant',
        text: "Network error. Please try again.",
        createdAt: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processProposals = async (rawProposals: any[]) => {
    // Post-process proposals: set default endAt if missing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processedProposals: Proposal[] = rawProposals.map((p: any) => {
      const safeP = { ...p, id: p.id || createId() };
      if (safeP.type === 'event' && safeP.startAt && !safeP.endAt) {
        safeP.endAt = addMinutes(safeP.startAt, memory?.defaultEventMinutes || DEFAULT_EVENT_MINUTES);
      }
      return safeP;
    });

    const auto: Proposal[] = [];
    const manual: Proposal[] = [];

    // Helper to check conflict (local version of checkConflicts logic)
    const hasConflict = (p: Proposal) => {
      if (p.type !== 'event' || !p.startAt || !p.endAt) return false;
      const buffer = memory?.bufferBetweenEventsMinutes || 0;
      const checkStart = addMinutes(p.startAt, -buffer);
      const checkEnd = addMinutes(p.endAt, buffer);
      return events.some(e => {
        const eBuffer = memory?.bufferBetweenEventsMinutes || 0;
        const eStart = addMinutes(e.startAt, -eBuffer);
        const eEnd = addMinutes(e.endAt, eBuffer);
        return overlaps(checkStart, checkEnd, eStart, eEnd);
      });
    };

    processedProposals.forEach(p => {
      // Low Risk Criteria: Task + No Anchor + <= 60m + No Conflict
      // Note: 'anchor' property is not yet in type, assuming false if missing.
      // Tasks usually have no duration/conflict, so strict check mainly applies if it was an event.
      // But rule says: proposal.type === 'task'.
      const isTask = p.type === 'task';
      const isAnchor = p.isAnchor === true;
      const duration = (p.startAt && p.endAt) ? getDurationMinutes(p.startAt, p.endAt) : 0;

      if (isTask && !isAnchor && !hasConflict(p) && duration <= 60) {
        auto.push(p);
      } else {
        manual.push(p);
      }
    });

    // Commit Auto
    for (const p of auto) {
      await handleHoldComplete(p, true);
    }

    // Set Manual
    if (manual.length > 0) {
      setPendingProposals(manual);
      checkConflicts(manual);
      if (__DEV__) console.log("[SCHEDULER] confirmation required", manual.map(m => m.id));
    }
  };

  // --- Conflict Detection (Existing Logic) ---

  const checkConflicts = (proposals: Proposal[]) => {
    const newConflicts: { proposalId: string, event: Event }[] = [];

    proposals.forEach(p => {
      if (p.type === 'event' && p.startAt && p.endAt) {
        const buffer = memory?.bufferBetweenEventsMinutes || 0;
        const checkStart = addMinutes(p.startAt, -buffer);
        const checkEnd = addMinutes(p.endAt, buffer);

        const conflict = events.find(e => {
          const eBuffer = memory?.bufferBetweenEventsMinutes || 0;
          const eStart = addMinutes(e.startAt, -eBuffer);
          const eEnd = addMinutes(e.endAt, eBuffer);
          return overlaps(checkStart, checkEnd, eStart, eEnd);
        });

        if (conflict) {
          newConflicts.push({ proposalId: p.id, event: conflict });
        }
      }
    });
    setConflicts(newConflicts);
  };

  const getNextFreeSlot = (proposal: Proposal) => {
    // If we have a specific start time, preserve it (don't bias)
    if (proposal.startAt && proposal.endAt) {
      // Just check validity around existing proposal start? 
      // Actually user clicked "Find Next Slot", presumably current one is blocked.
      // So we should search *forward* from the proposal time.
    }

    // Determine bias
    const energyType = classifyEnergy(proposal.title);
    const profile = getDefaultEnergyProfile();

    let candidateStart: Date;

    // If proposal has a start time, start searching from there (user explicit intent overrides bias start, 
    // unless they are explicitly asking for a reschedule which "Find Next Slot" implies).
    // The requirement says: "If classifyEnergy... start searching from today at peakStart/slumpStart".
    // "Find Next Slot" implies finding *another* slot.
    // If the proposal ALREADY has a start time (conflict case), we usually want to search *after* that time.
    // BUT the requirement is specific: "bias the search start". 
    // Let's interpret "Find Next Slot" as "Auto-schedule this for me".

    const now = new Date();

    if (proposal.startAt) {
      // If it already has a time, use that as base?
      candidateStart = new Date(proposal.startAt);
    } else {
      // No time set (task or vague), use now or bias
      candidateStart = new Date();
    }

    if (energyType === 'deep') {
      const peakIso = getWindowStartIso(now, profile.peakStart);
      const peakDate = new Date(peakIso);

      // If peak start is in the past, maybe use now? Or just start search at peak (which is past) and loop forward?
      // Loop forward handles passing time.
      // If we want to bias for *tomorrow's* peak if today's is gone? 
      // Simplest interpretation: Start checking at Today's Peak Start.
      // If that is blocked or passed, the loop will find next available.
      // However, if we start at 9am, and it's 5pm, 9am is gone.
      // Better: Max(now, peakStart) for today?
      // Actually, if I reset to 9am today, and it is 5pm, `candidateStart < now` check (if any) might fail?
      // The loop is `candidateStart.setMinutes...`.
      // Let's just set the candidateStart.

      // Wait, if it's 5pm and I set candidate to 9am today, the loop will check 9am, 9:15... 
      // If those are "free" (historical time isn't blocked by events usually unless we check `end < now`?), we might schedule in the past.
      // We need to ensure we don't schedule in the past.

      if (peakDate < now) {
        // Peak for today passed? Try finding ANY slot, or maybe bias to tomorrow?
        // "If 'deep', start searching from today at peakStart."
        // Let's stick to literal instructions but add "don't schedule in past" check implicitly if loop handles it?
        // My `getNextFreeSlot` loop doesn't check for "past" explicitly, it just checks event overlap.
        // I should ensure candidateStart >= now.

        // If strict bias requested:
        candidateStart = peakDate;
      } else {
        candidateStart = peakDate;
      }

      if (__DEV__) console.log(`[ENERGY] classified "${proposal.title}" as deep`);
      if (__DEV__) console.log(`[ENERGY] search start set to ${candidateStart.toISOString()} for peak`);
    } else {
      // Shallow/Slump
      const slumpIso = getWindowStartIso(now, profile.slumpStart);
      const slumpDate = new Date(slumpIso);
      candidateStart = slumpDate;

      if (__DEV__) console.log(`[ENERGY] classified "${proposal.title}" as shallow`);
      if (__DEV__) console.log(`[ENERGY] search start set to ${candidateStart.toISOString()} for slump`);
    }

    // Ensure we don't start in the past if possible, or assume the user wants that? 
    // The previous implementation was: `const candidateStart = new Date(proposal.startAt);`
    // If I override this, I must be careful.

    const duration = (proposal.startAt && proposal.endAt)
      ? getDurationMinutes(proposal.startAt, proposal.endAt)
      : (proposal.type === 'event' ? (memory?.defaultEventMinutes || 60) : 30); // Default duration if text doesn't specify

    // Look up to 7 days ahead
    // We need to ensure we don't return a time in the past
    // If candidateStart < now, fast forward to now?
    if (candidateStart < new Date()) {
      candidateStart = new Date();
      // Round up to next 15 min
      const rem = candidateStart.getMinutes() % 15;
      if (rem > 0) candidateStart.setMinutes(candidateStart.getMinutes() + (15 - rem));
      candidateStart.setSeconds(0, 0);
    }

    const buffer = memory?.bufferBetweenEventsMinutes || 0;

    for (let i = 0; i < 96 * 7; i++) { // 15 min chunks
      // Check if current candidate is valid
      const startIso = candidateStart.toISOString();
      const endIso = addMinutes(startIso, duration);
      const checkStart = addMinutes(startIso, -buffer);
      const checkEnd = addMinutes(endIso, buffer);

      const isBlocked = events.some(e => {
        const eBuffer = memory?.bufferBetweenEventsMinutes || 0;
        const eStart = addMinutes(e.startAt, -eBuffer);
        const eEnd = addMinutes(e.endAt, eBuffer);
        return overlaps(checkStart, checkEnd, eStart, eEnd);
      });

      if (!isBlocked) {
        const updated = { ...proposal, startAt: startIso, endAt: endIso };
        setPendingProposals(prev => prev.map(p => p.id === proposal.id ? updated : p));
        setConflicts(prev => prev.filter(c => c.proposalId !== proposal.id));
        Alert.alert("Slot Found", `Moved to ${candidateStart.toLocaleString()}`);
        return;
      }

      // Advance
      candidateStart.setMinutes(candidateStart.getMinutes() + 15);
    }
    Alert.alert("No Slot Found", "Could not find a free slot in the next 7 days.");
  };

  // --- Proposal Mutation ---

  const updateProposalTitle = (id: string, newTitle: string) => {
    setPendingProposals(prev => prev.map(p => p.id === id ? { ...p, title: newTitle } : p));
  };

  const updateDuration = (id: string, minutes: number) => {
    setPendingProposals(prev => prev.map(p => {
      if (p.id === id && p.startAt) {
        const newEnd = addMinutes(p.startAt, minutes);
        return { ...p, endAt: newEnd };
      }
      return p;
    }));
    setTimeout(() => checkConflicts(pendingProposals), 0);
  };

  // --- Saving & Undo ---



  const handleHoldComplete = async (proposal: Proposal, silent = false) => {
    try {
      console.log("Starting commit for proposal:", proposal);

      const payload = buildEventFromIntent(proposal);
      console.log("Built payload:", payload);

      const newId = createId();

      if (proposal.type === 'task') {
        const isAnchor = proposal.isAnchor === true;
        if (__DEV__ && isAnchor) console.log(`[ANCHOR] set task ${newId} anchor=true`);

        await addTask({
          id: newId,
          title: payload.title,
          notes: payload.notes,
          dueDate: payload.dueDate,
          isAnchor
        });
        setLastAction({ type: 'task', id: newId });
        console.log("Task committed:", newId);
        if (__DEV__) console.log("[SCHEDULER] auto-committed proposal", newId);
      } else {
        // Event
        if (!payload.startAt || !payload.endAt) {
          throw new Error("Event missing start/end");
        }

        // Check if proposal has anchor prop (from logic or prompt)
        const isAnchor = proposal.isAnchor === true;

        if (__DEV__) console.log("[SCHEDULER] create payload:", { id: newId, ...payload });
        await addEvent({
          id: newId,
          title: payload.title,
          startAt: payload.startAt,
          endAt: payload.endAt,
          location: payload.location,
          notes: payload.notes,
          isAnchor
        });
        setLastAction({ type: 'event', id: newId });
        if (__DEV__) console.log("[SCHEDULER] committed event:", newId);
      }

      setPendingProposals(prev => prev.filter(p => p.id !== proposal.id));
      setConflicts(prev => prev.filter(c => c.proposalId !== proposal.id));
      setSessionState(prev => ({ ...prev, lastProposals: null }));

      setShowUndo(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      setTimeout(() => hideUndo(), 5000);

      let confirmText = "";
      if (silent) {
        confirmText = proposal.type === 'task'
          ? `Task "${payload.title}" added to your list.`
          : `Scheduled "${payload.title}".`;
      } else {
        confirmText = proposal.type === 'task'
          ? `Added task "${payload.title}".`
          : `Scheduled "${payload.title}" for ${new Date(payload.startAt!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
      }

      setMessages(prev => [...prev, {
        id: createId(),
        role: 'assistant',
        text: silent ? confirmText : `${confirmText} Anything else?`,
        createdAt: new Date().toISOString()
      }]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      console.error("Save failed", e);
      Alert.alert("Save Error", e.message || "Could not save item.");
    }
  };

  const hideUndo = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setShowUndo(false);
      setLastAction(null);
    });
  };

  const handleUndo = async () => {
    if (!lastAction) return;
    try {
      if (lastAction.type === 'event') {
        await deleteEvent(lastAction.id);
      } else if (lastAction.type === 'task') {
        await deleteTask(lastAction.id);
      }
      setLastAction(null);
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setShowUndo(false);
      });
      Alert.alert("Undone", "Item removed.");
    } catch (e) {
      console.error("Undo failed", e);
      Alert.alert("Error", "Failed to undo.");
    }
  };

  const resolveConflictReplace = async (proposal: Proposal, conflictEvent: Event) => {
    if (conflictEvent.isAnchor) {
      if (__DEV__) console.log("[ANCHOR] conflict with anchor task -> confirmation required");
      Alert.alert("Cannot Replace", "This event is marked as an Anchor (Non-Negotiable).");
      return;
    }
    await deleteEvent(conflictEvent.id);
    setConflicts(prev => prev.filter(c => c.event.id !== conflictEvent.id));
  };


  // --- Reset & New Chat ---

  const resetChat = async () => {
    await clearSchedulerSession();
    setMessages([{
      id: createId(),
      role: 'assistant',
      text: "What would you like to schedule?",
      createdAt: new Date().toISOString(),
    }]);
    setPendingProposals([]);
    setConflicts([]);
    setSessionState(INITIAL_SESSION_STATE);
    setLastAction(null);
    setShowUndo(false);
  };

  const handleNewChat = () => {
    if (messages.length > 1) { // >1 because of greeting
      Alert.alert("New Chat", "Clear current conversation?", [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: resetChat }
      ]);
    } else {
      resetChat();
    }
  };


  // --- Render ---

  const HoldButton = ({ onComplete }: { onComplete: () => void }) => {
    const [pressing, setPressing] = useState(false);
    const progress = useRef(new Animated.Value(0)).current;

    const startPress = () => {
      setPressing(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 700,
        useNativeDriver: false
      }).start(({ finished }) => {
        if (__DEV__) console.log("[HoldButton] animation finished:", finished);
        if (finished) {
          onComplete();
          setPressing(false);
          progress.setValue(0);
        }
      });
    };

    const endPress = () => {
      setPressing(false);
      Animated.timing(progress, { toValue: 0, duration: 100, useNativeDriver: false }).start();
    };

    const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

    return (
      <TouchableWithoutFeedback onPressIn={startPress} onPressOut={endPress}>
        <View style={styles.confirmButton}>
          <Animated.View style={[styles.progressFill, { width }]} />
          <Text style={styles.confirmButtonText}>{pressing ? "Hold to Save..." : "Hold to Save"}</Text>
        </View>
      </TouchableWithoutFeedback>
    );
  };

  const renderProposal = (proposal: Proposal) => {
    const isEvent = proposal.type === 'event';
    const iconName = isEvent ? 'calendar' : 'checkbox';
    const dateDisplay = isEvent && proposal.startAt
      ? new Date(proposal.startAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
      : proposal.dueDate;
    const myConflict = conflicts.find(c => c.proposalId === proposal.id);

    return (
      <View key={proposal.id} style={styles.proposalCard}>
        <View style={styles.cardHeader}>
          <View style={styles.typeTag}>
            <Ionicons name={iconName} size={14} color="#555" />
            <Text style={styles.typeText}>{proposal.type.toUpperCase()}</Text>
          </View>
          {proposal.confidence && proposal.confidence < 0.8 && (
            <Text style={styles.confidenceText}>Low Confidence</Text>
          )}
        </View>

        <TextInput
          style={styles.cardTitleInput}
          value={proposal.title}
          onChangeText={(text) => updateProposalTitle(proposal.id, text)}
          selectTextOnFocus
        />

        {isEvent && proposal.startAt && proposal.endAt && (
          <View style={styles.durationRow}>
            {[30, 45, 60, 90].map(mins => (
              <TouchableOpacity
                key={mins}
                onPress={() => updateDuration(proposal.id, mins)}
                style={[
                  styles.durationPill,
                  getDurationMinutes(proposal.startAt!, proposal.endAt!) === mins && styles.durationPillActive
                ]}
              >
                <Text style={[
                  styles.durationText,
                  getDurationMinutes(proposal.startAt!, proposal.endAt!) === mins && styles.durationTextActive
                ]}>{mins}m</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.cardDetails}>
          <Text style={styles.detailText}>{dateDisplay}</Text>
          {proposal.location && <Text style={styles.detailText}>📍 {proposal.location}</Text>}
        </View>

        {myConflict && (
          <View style={styles.conflictBox}>
            <Text style={styles.conflictTitle}>⚠️ Conflict: &quot;{myConflict.event.title}&quot;</Text>
            <View style={styles.conflictActions}>
              <TouchableOpacity style={styles.conflictBtn} onPress={() => getNextFreeSlot(proposal)}>
                <Text style={styles.conflictBtnText}>Find Next Slot</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.conflictBtn, { backgroundColor: '#FF3B30' }]}
                onPress={() => resolveConflictReplace(proposal, myConflict.event)}
              >
                <Text style={[styles.conflictBtnText, { color: '#fff' }]}>Replace</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.conflictHint}>Or hold below to schedule anyway.</Text>
          </View>
        )}

        <HoldButton onComplete={() => handleHoldComplete(proposal)} />
      </View>
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.assistantRow]}>
        {!isUser && (
          <View style={styles.avatar}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
          </View>
        )}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, pendingProposals]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scheduler</Text>
        <TouchableOpacity onPress={handleNewChat} style={styles.newChatBtn}>
          <Ionicons name="create-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={{ flex: 1 }}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListFooterComponent={
              <View style={{ paddingBottom: 100 }}>
                {loading && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#888" />
                    <Text style={styles.loadingText}>Processing...</Text>
                  </View>
                )}
                {pendingProposals.map(renderProposal)}
              </View>
            }
          />

          {showUndo && (
            <Animated.View style={[styles.undoBar, { opacity: fadeAnim }]}>
              <Text style={styles.undoText}>Saved ✅</Text>
              <TouchableOpacity onPress={handleUndo}>
                <Text style={styles.undoBtnText}>Undo</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          <View style={styles.inputContainer}>
            {sessionState.awaitingFields.length > 0 && (
              <View style={styles.chipRow}>
                <Text style={styles.chipLabel}>Needs:</Text>
                {sessionState.awaitingFields.map(f => (
                  <View key={f} style={styles.chip}>
                    <Text style={styles.chipText}>{f}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Type a request..."
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                editable={!loading}
              />
              <TouchableOpacity
                onPress={handleSend}
                style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
                disabled={!inputText.trim() || loading}
              >
                <Ionicons name="arrow-up" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  newChatBtn: {
    padding: 4,
  },
  listContent: {
    padding: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: '#000',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 40,
    marginBottom: 20,
  },
  loadingText: {
    marginLeft: 8,
    color: '#888',
    fontSize: 14,
  },
  proposalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  confidenceText: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500',
  },
  cardTitleInput: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  confirmButton: {
    backgroundColor: '#e5e5ea',
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#34C759',
  },
  confirmButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    zIndex: 1,
  },
  inputContainer: {
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6
  },
  chipLabel: {
    fontSize: 12,
    color: '#888',
    marginRight: 4,
    fontWeight: '600'
  },
  chip: {
    backgroundColor: '#FFE0B2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12
  },
  chipText: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '500'
  },
  input: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#B4D5FF',
  },

  // Duration & Detail styles
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  durationPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  durationPillActive: {
    backgroundColor: '#007AFF',
  },
  durationText: {
    fontSize: 12,
    color: '#555',
  },
  durationTextActive: {
    color: '#fff',
  },
  travelTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFEBEE',
  },
  travelText: {
    fontSize: 10,
    color: '#D32F2F',
    fontWeight: '600',
  },
  cardDetails: {
    marginBottom: 12,
  },
  detailText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 4,
  },

  // Undo Bar
  undoBar: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  undoText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  undoBtnText: {
    color: '#4DAFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },

  // Conflict Box
  conflictBox: {
    backgroundColor: '#FFF4E5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFCC80',
  },
  conflictTitle: {
    color: '#E65100',
    fontWeight: '600',
    marginBottom: 8,
  },
  conflictActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  conflictBtn: {
    backgroundColor: '#FFA726',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  conflictBtnText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  conflictHint: {
    fontSize: 10,
    color: '#777',
    fontStyle: 'italic',
  }
});
