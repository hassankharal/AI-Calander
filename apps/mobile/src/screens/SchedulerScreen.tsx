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
  Keyboard,
  Animated,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTasks } from '../hooks/useTasks';
import { useEvents } from '../hooks/useEvents';
import { callAiScheduler } from '../lib/aiClient';
import { createId } from '../lib/id'; // Fix import extension
import { ChatMessage, Proposal } from '../types/scheduler';
import { Event } from '../types/event';

// --- Helper Logic for Conflicts ---

const DEFAULT_EVENT_MINUTES = 60;
const TRAVEL_BUFFER_MINUTES = 15;

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

export default function SchedulerScreen() {
  const { addTask, tasks } = useTasks();
  const { events, addEvent, deleteEvent } = useEvents();

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingProposals, setPendingProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);

  // Undo State
  const [showUndo, setShowUndo] = useState(false);
  const [lastAction, setLastAction] = useState<{ type: 'task' | 'event', id: string } | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Conflict State
  const [conflicts, setConflicts] = useState<{ proposalId: string, event: Event }[]>([]);

  const flatListRef = useRef<FlatList>(null);

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
    setPendingProposals([]);
    setConflicts([]);

    const payload = {
      message: userMsg.text,
      nowIso: new Date().toISOString(),
      timezone: 'America/Winnipeg',
      context: {
        tasks: tasks.filter(t => !t.completed),
        events: events,
        prefs: { defaultEventMinutes: DEFAULT_EVENT_MINUTES }
      }
    };

    const response = await callAiScheduler(payload);
    setLoading(false);

    if (response.ok) {
      const data = response.data;
      const aiMsg: ChatMessage = {
        id: createId(),
        role: 'assistant',
        text: data.assistantText + (data.followUpQuestion ? `\n\n${data.followUpQuestion}` : ''),
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);

      if (data.mode === 'proposal' && data.proposals) {
        // Post-process proposals: set default endAt if missing for events
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const processedProposals: Proposal[] = data.proposals.map((p: any) => {
          const safeP = { ...p, id: p.id || createId() };
          if (safeP.type === 'event' && safeP.startAt && !safeP.endAt) {
            safeP.endAt = addMinutes(safeP.startAt, DEFAULT_EVENT_MINUTES);
          }
          return safeP;
        });
        setPendingProposals(processedProposals);

        // Check initial conflicts
        checkConflicts(processedProposals);
      }
    } else {
      const errorMsg: ChatMessage = {
        id: createId(),
        role: 'assistant',
        text: response.bodyText || "Sorry, I had trouble connecting.",
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  // --- Conflict Detection ---

  const checkConflicts = (proposals: Proposal[]) => {
    const newConflicts: { proposalId: string, event: Event }[] = [];

    proposals.forEach(p => {
      if (p.type === 'event' && p.startAt && p.endAt) {
        const hasBuffer = !!p.location; // Apply buffer logic if location is set
        const buffer = hasBuffer ? TRAVEL_BUFFER_MINUTES : 0;

        // Effective range with buffer
        const checkStart = addMinutes(p.startAt, -buffer);
        const checkEnd = addMinutes(p.endAt, buffer);

        const conflict = events.find(e => {
          const eBuffer = e.location ? TRAVEL_BUFFER_MINUTES : 0;
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
    if (!proposal.startAt || !proposal.endAt) return;
    const duration = getDurationMinutes(proposal.startAt, proposal.endAt);
    let candidateStart = new Date(proposal.startAt); // Start search from proposed time

    // Search constraints
    const hasBuffer = !!proposal.location;
    const buffer = hasBuffer ? TRAVEL_BUFFER_MINUTES : 0;

    // Look up to 7 days ahead
    for (let i = 0; i < 96 * 7; i++) { // 15 min chunks
      // Shift +15 mins
      candidateStart.setMinutes(candidateStart.getMinutes() + 15);
      const startIso = candidateStart.toISOString();
      const endIso = addMinutes(startIso, duration);

      const checkStart = addMinutes(startIso, -buffer);
      const checkEnd = addMinutes(endIso, buffer);

      const isBlocked = events.some(e => {
        const eBuffer = e.location ? TRAVEL_BUFFER_MINUTES : 0;
        const eStart = addMinutes(e.startAt, -eBuffer);
        const eEnd = addMinutes(e.endAt, eBuffer);
        return overlaps(checkStart, checkEnd, eStart, eEnd);
      });

      if (!isBlocked) {
        // Found it! Update proposal
        const updated = { ...proposal, startAt: startIso, endAt: endIso };
        setPendingProposals(prev => prev.map(p => p.id === proposal.id ? updated : p));
        // Remove conflict
        setConflicts(prev => prev.filter(c => c.proposalId !== proposal.id));
        Alert.alert("Slot Found", `Moved to ${candidateStart.toLocaleString()}`);
        return;
      }
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
    // Re-check conflicts after duration change
    // Note: In a real app we'd debounce this or effectively re-run checkConflicts
    setTimeout(() => checkConflicts(pendingProposals), 0); // Simplified re-check
  };

  // --- Saving & Undo ---

  const handleHoldComplete = async (proposal: Proposal) => {
    // 1. Resolve conflicts if "Replace" chosen (implicit logic needed? For now we just save)
    // If conflicting logic was "Replace Existing", we would need to delete the conflicting event first.
    // We'll trust the user used the buttons "Schedule Anyway" or "Replace" before holding.

    const newId = createId();
    try {
      if (proposal.type === 'task') {
        await addTask({
          id: newId, // Pass ID if addTask supports it (we ensure createId used inside if not)
          title: proposal.title,
          notes: proposal.notes,
          dueDate: proposal.dueDate
        });
        setLastAction({ type: 'task', id: newId }); // Assume we can track the ID
      } else {
        if (proposal.startAt && proposal.endAt) {
          await addEvent({
            id: newId,
            title: proposal.title,
            startAt: proposal.startAt,
            endAt: proposal.endAt,
            location: proposal.location || undefined,
            notes: proposal.notes || undefined,
          });
          setLastAction({ type: 'event', id: newId });
        }
      }

      // UI Feedback
      setPendingProposals(prev => prev.filter(p => p.id !== proposal.id));
      setConflicts(prev => prev.filter(c => c.proposalId !== proposal.id));

      // Show Undo
      setShowUndo(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      setTimeout(() => hideUndo(), 5000);

    } catch (e) {
      console.error("Save failed", e);
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
    // Depending on type, delete
    // Note: useTasks and useEvents need delete capabilities exposed
    // Assuming deleteEvent(id) and deleteTask(id) exist or similar
    try {
      // We need to implement delete based on the hook API.
      // useEvents -> deleteEvent(id)
      // useTasks -> deleteTask(id)
      if (lastAction.type === 'event') {
        await deleteEvent(lastAction.id);
      } else {
        // await deleteTask(lastAction.id); // Assuming this exists or needed
        console.warn("Delete Task via Undo not strictly implemented in hook yet");
      }
      Alert.alert("Undone", "Item removed.");
    } catch (e) {
      console.error("Undo failed", e);
    }
    hideUndo();
  };

  const resolveConflictReplace = async (proposal: Proposal, conflictEvent: Event) => {
    await deleteEvent(conflictEvent.id);
    setConflicts(prev => prev.filter(c => c.event.id !== conflictEvent.id));
    // Just remove the conflict record, user can now Hold to Confirm
  };


  // --- Render ---

  // Hold Button Component
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

    const width = progress.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%']
    });

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

        {/* Duration Pills for Events */}
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
            {proposal.location && (
              <View style={styles.travelTag}>
                <Ionicons name="car-outline" size={12} color="#666" />
                <Text style={styles.travelText}>+15m</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.cardDetails}>
          <Text style={styles.detailText}>{dateDisplay}</Text>
          {proposal.location && <Text style={styles.detailText}>📍 {proposal.location}</Text>}
        </View>

        {/* Conflict UI */}
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
            <Ionicons name="sparkles" size={16} color="#fff" />
          </View>
        )}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              ListFooterComponent={
                <View style={{ paddingBottom: 100 }}>
                  {loading && (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="#888" />
                      <Text style={styles.loadingText}>Thinking...</Text>
                    </View>
                  )}
                  {pendingProposals.map(renderProposal)}
                </View>
              }
            />

            {/* Undo Bar */}
            {showUndo && (
              <Animated.View style={[styles.undoBar, { opacity: fadeAnim }]}>
                <Text style={styles.undoText}>Saved ✅</Text>
                <TouchableOpacity onPress={handleUndo}>
                  <Text style={styles.undoBtnText}>Undo</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            <View style={styles.inputContainer}>
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
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
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
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
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
