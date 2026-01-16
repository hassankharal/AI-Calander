import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, ActivityIndicator, SafeAreaView, Platform, KeyboardAvoidingView, Animated, ScrollView, Pressable, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTasks } from '../hooks/useTasks';
import { useEvents } from '../hooks/useEvents';
import { useUserMemory } from '../hooks/useUserMemory';
import { Task } from '../types/task';
import { callAiScheduler } from '../lib/aiClient';
import { applyDefaultDuration } from '../lib/taskScheduler';
import { Proposal } from '../types/scheduler';
import { createId } from '../lib/id';
import { findCandidateSlots, CandidateSlot } from '../lib/freeSlotFinder';
import { useToast } from '../components/ToastBanner';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

export default function TasksScreen() {
  const { pendingTasks, completedTasks, isLoading, addTask, completeTask, deleteTask, restoreTask, refresh } = useTasks();
  const { events, addEvent, deleteEvent } = useEvents();
  const { memory } = useUserMemory();
  const { showToast } = useToast();

  // Task Creation State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [isAnchor, setIsAnchor] = useState(false);

  // Scheduling State
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [duration, setDuration] = useState(60);

  const [proposals, setProposals] = useState<Proposal[]>([]);

  // Undo State
  const [lastAction, setLastAction] = useState<{ eventId: string; task: Task } | null>(null);
  const [fadeAnim] = useState(() => new Animated.Value(0));

  // Custom Picker State
  const [customMode, setCustomMode] = useState(false);
  const [customDayOffset, setCustomDayOffset] = useState(0);
  const [customTimeStr, setCustomTimeStr] = useState("09:00");

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // --- Task Operations ---

  const handleAddTask = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }
    await addTask({
      title: newTitle.trim(),
      dueDate: newDueDate.trim() || undefined,
      isAnchor
    });
    setNewTitle('');
    setNewDueDate('');
    setIsAnchor(false);
    setCreateModalVisible(false);
    showToast("Task added");
  };

  // --- Fast Scheduling Logic ---

  // --- Fast Scheduling Logic ---

  const enhanceProposalsWithAi = useCallback(async (title: string, dur: number, candidates: CandidateSlot[]) => {
    // Don't block UI.
    const prompt = `Task: "${title}". Duration: ${dur}m. Candidates: ${JSON.stringify(candidates.map(c => c.startAt))}. 
     Return JSON: { "cleanTitle": string }`;

    const payload = {
      message: prompt,
      nowIso: new Date().toISOString(),
      timezone: memory?.timezone || "America/Winnipeg",
      context: { prefs: memory }
    };

    try {
      const res = await callAiScheduler(payload);
      if (res.ok && res.data) {
        const { cleanTitle } = res.data;
        // Update state silently
        setProposals(prev => prev.map(p => ({
          ...p,
          title: cleanTitle || p.title
        })));
      }
    } catch (e) {
      console.log("AI Enhancement failed/skipped (harmless)", e);
    }
  }, [memory]);

  const generateProposals = useCallback((taskTitle: string, dur: number) => {
    // 1. Local Search Immediately
    const nowIso = new Date().toISOString();
    const candidates = findCandidateSlots({
      events,
      nowIso,
      daysAhead: 7,
      durationMinutes: dur,
      maxResults: 3
    });

    const initialProposals: Proposal[] = candidates.map(c => ({
      id: createId(),
      type: 'event',
      title: taskTitle,
      startAt: c.startAt,
      endAt: c.endAt,
      confidence: 0.9,
      notes: c.label
    }));
    setProposals(initialProposals);

    // 2. AI Enhancement (Optional, Non-blocking)
    if (initialProposals.length > 0) {
      enhanceProposalsWithAi(taskTitle, dur, candidates);
    }
  }, [events, enhanceProposalsWithAi]);

  const openScheduleModal = (task: Task) => {
    setSelectedTask(task);
    const defDuration = applyDefaultDuration(memory, 60);
    setDuration(defDuration);
    setCustomMode(false);
    setCustomDayOffset(0);
    setCustomTimeStr("09:00");
    setScheduleModalVisible(true);

    // Compute immediately
    generateProposals(task.title, defDuration);
  };

  const handleDurationSelect = (newDur: number) => {
    setDuration(newDur);
    if (selectedTask) {
      generateProposals(selectedTask.title, newDur);
    }
  };

  const closeScheduleModal = () => {
    setScheduleModalVisible(false);
    setSelectedTask(null);
  };

  const finalizeSchedule = async (proposal: Proposal) => {
    if (!selectedTask) return;

    if (!proposal.startAt || !proposal.endAt) {
      Alert.alert("Error", "Invalid time slot.");
      return;
    }

    try {
      const finalTitle = proposal.title || selectedTask.title;
      const noteContent = `From Task: ${selectedTask.title}\n${selectedTask.notes || ''}`.trim();

      // 1. Create Event
      const newEvent = await addEvent({
        title: finalTitle,
        startAt: proposal.startAt,
        endAt: proposal.endAt,
        notes: noteContent,
        isAnchor: selectedTask.isAnchor
      });

      if (newEvent) {
        // 2. Remove Task (it's scheduled now)
        // Store for undo
        const taskSnapshot = { ...selectedTask };
        setLastAction({ eventId: newEvent.id, task: taskSnapshot });

        await deleteTask(selectedTask.id);
        closeScheduleModal();
        showUndoBar();
      }

    } catch (e) {
      Alert.alert("Error", "Failed to schedule event.");
      console.error(e);
    }
  };

  // Custom Save
  const handleCustomSave = async () => {
    if (!selectedTask) return;

    // Basic validation
    if (!customTimeStr.match(/^\d{1,2}:\d{2}$/)) {
      Alert.alert("Invalid Time", "Use HH:MM format (e.g., 09:30)");
      return;
    }

    const date = new Date();
    date.setDate(date.getDate() + customDayOffset);
    const [hh, mm] = customTimeStr.split(':').map(Number);
    date.setHours(hh, mm, 0, 0);

    const startIso = date.toISOString();
    const end = new Date(date);
    end.setMinutes(end.getMinutes() + duration);
    const endIso = end.toISOString();

    const proposal: Proposal = {
      id: createId(),
      type: 'event',
      title: selectedTask.title,
      startAt: startIso,
      endAt: endIso,
      confidence: 1
    };

    await finalizeSchedule(proposal);
  };

  // --- Undo Logic ---
  const showUndoBar = () => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    // Auto hide after 5s
    setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setLastAction(null);
      });
    }, 5000);
  };

  const handleUndo = async () => {
    if (lastAction) {
      // Restore task
      await restoreTask(lastAction.task);
      // Delete event
      await deleteEvent(lastAction.eventId);

      setLastAction(null);
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start();
      showToast("Undo successful");
    }
  };

  const handleComplete = async (task: Task) => {
    // If it's already completed (completedAt is set), we are marking incomplete
    const isCompleting = !task.completed;
    await completeTask(task.id);
    showToast(isCompleting ? "Completed ✅" : "Marked incomplete");
  };

  // --- Renderers ---

  const renderItem = ({ item }: { item: Task }) => (
    <View style={styles.taskItem}>
      {/* Complete Action */}
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => handleComplete(item)}
      >
        <Ionicons
          name={item.completed ? "checkmark-circle" : "ellipse-outline"}
          size={24}
          color={item.completed ? "#34C759" : "#ccc"}
        />
      </TouchableOpacity>

      <TouchableOpacity style={styles.taskContent} onPress={() => { /* Detail view? */ }}>
        <Text style={[styles.taskTitle, item.completed && styles.completedText]}>
          {item.title}
        </Text>
        {item.dueDate && (
          <Text style={styles.dueDate}>Due: {item.dueDate}</Text>
        )}
        {item.isAnchor && (
          <View style={styles.anchorTag}>
            <Text style={styles.anchorTagText}>ANCHOR</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Actions (Only for pending) */}
      {!item.completed && (
        <TouchableOpacity
          style={styles.scheduleButton}
          onPress={() => openScheduleModal(item)}
        >
          <Ionicons name="calendar-outline" size={18} color="#007AFF" />
        </TouchableOpacity>
      )}

      {/* Delete */}
      <TouchableOpacity
        onPress={() => Alert.alert('Delete', 'Delete this task?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deleteTask(item.id) }
        ])}
        style={styles.deleteButton}
      >
        <Ionicons name="trash-outline" size={18} color="#FF3B30" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setCreateModalVisible(true)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={styles.scroll}>
          {/* Pending Tasks */}
          {pendingTasks.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>All caught up!</Text>
            </View>
          )}
          <FlatList
            data={pendingTasks}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            scrollEnabled={false} // Nested in ScrollView
          />

          {/* Completed Section */}
          {completedTasks.length > 0 && (
            <View style={styles.completedSection}>
              <Text style={styles.sectionHeader}>Completed</Text>
              <FlatList
                data={completedTasks.slice(0, 10)} // Limit to 10
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                scrollEnabled={false}
              />
            </View>
          )}
        </ScrollView>
      )}

      {/* Undo Bar */}
      <Animated.View style={[styles.undoBar, { opacity: fadeAnim }]}>
        <Text style={styles.undoText}>Task Scheduled</Text>
        <TouchableOpacity onPress={handleUndo}>
          <Text style={styles.undoAction}>Undo</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Create Task Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={createModalVisible}
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalOverlay} onPress={Keyboard.dismiss}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New Task</Text>
              <TextInput
                style={styles.input}
                placeholder="Title (required)"
                value={newTitle}
                onChangeText={setNewTitle}
                autoFocus
              />
              <TextInput
                style={styles.input}
                placeholder="Due Date (YYYY-MM-DD)"
                value={newDueDate}
                onChangeText={setNewDueDate}
              />

              <View style={styles.anchorRow}>
                <Text style={styles.anchorLabel}>Anchor (Non-Negotiable)</Text>
                <TouchableOpacity
                  style={[styles.anchorToggle, isAnchor && styles.anchorToggleActive]}
                  onPress={() => setIsAnchor(!isAnchor)}
                >
                  <View style={[styles.anchorKnob, isAnchor && styles.anchorKnobActive]} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setCreateModalVisible(false)}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleAddTask}>
                  <Text style={[styles.buttonText, { color: '#fff' }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Schedule Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={scheduleModalVisible}
        onRequestClose={closeScheduleModal}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlay} onPress={Keyboard.dismiss}>
            <View style={styles.scheduleModalContent} onStartShouldSetResponder={() => true}>
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={styles.modalTitle}>Schedule &quot;{selectedTask?.title}&quot;</Text>

                {/* Duration Picker */}
                <Text style={styles.label}>Duration</Text>
                <View style={styles.durationRow}>
                  {DURATION_OPTIONS.map(min => (
                    <TouchableOpacity
                      key={min}
                      style={[styles.pill, duration === min && styles.pillActive]}
                      onPress={() => handleDurationSelect(min)}
                    >
                      <Text style={[styles.pillText, duration === min && styles.pillTextActive]}>{min}m</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Proposals List (Immediate) */}

                {proposals.length > 0 && !customMode && (
                  <View style={styles.proposalList}>
                    <Text style={styles.label}>Best Slots (Next 7 days):</Text>
                    {proposals.map((p) => (
                      <TouchableOpacity
                        key={`${p.startAt}-${p.endAt}`}
                        style={styles.proposalBtn}
                        onPress={() => finalizeSchedule(p)}
                      >
                        <View>
                          <Text style={styles.proposalText}>
                            {new Date(p.startAt!).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </Text>
                          {p.notes && <Text style={{ fontSize: 10, color: '#888' }}>{p.notes}</Text>}
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#007AFF" style={{ marginLeft: 'auto' }} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {proposals.length === 0 && !customMode && (
                  <View style={styles.errorBox}>
                    <Text style={{ color: '#666', marginBottom: 10 }}>No free slots found.</Text>
                    <TouchableOpacity onPress={() => setCustomMode(true)} style={styles.actionBtnOutline}>
                      <Text>Pick Manually</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Actions Grid */}
                {!customMode && proposals.length > 0 && (
                  <View style={styles.actionGrid}>
                    <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => finalizeSchedule(proposals[0])}>
                      <Text style={styles.actionBtnTitle}>Quick Schedule</Text>
                      <Text style={[styles.actionBtnSub, { color: '#fff' }]}>Take the first slot</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtnOutline} onPress={() => setCustomMode(true)}>
                      <Text style={styles.actionBtnTitle}>Custom</Text>
                      <Text style={styles.actionBtnSub}>Pick specific time</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Custom Mode */}
                {customMode && (
                  <View style={styles.customContainer}>
                    <Text style={styles.label}>Day</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroll}>
                      {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                        const d = new Date();
                        d.setDate(d.getDate() + offset);
                        const label = offset === 0 ? 'Today' : offset === 1 ? 'Tmrrw' : d.toLocaleDateString(undefined, { weekday: 'short' });
                        return (
                          <TouchableOpacity key={offset} style={[styles.dayChip, customDayOffset === offset && styles.dayChipActive]} onPress={() => setCustomDayOffset(offset)}>
                            <Text style={[styles.dayChipText, customDayOffset === offset && styles.dayChipTextActive]}>{label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <Text style={styles.label}>Start Time (HH:MM)</Text>
                    <TextInput
                      style={styles.timeInput}
                      value={customTimeStr}
                      onChangeText={setCustomTimeStr}
                      placeholder="09:00"
                      keyboardType="numbers-and-punctuation"
                    />

                    <TouchableOpacity style={styles.saveButton} onPress={handleCustomSave}>
                      <Text style={styles.saveBtnText}>Save Event</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setCustomMode(false)} style={styles.cancelLink}>
                      <Text style={styles.cancelLinkText}>Back to suggestions</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
              <TouchableOpacity style={styles.closeModalBtn} onPress={closeScheduleModal}>
                <Text style={styles.closeModalText}>Close</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scroll: {
    flex: 1,
  },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  checkboxContainer: {
    paddingRight: 10
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    color: '#333',
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  dueDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  scheduleButton: {
    padding: 8,
    marginRight: 5
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 16 },

  completedSection: {
    marginTop: 20,
    backgroundColor: '#f9f9f9'
  },
  sectionHeader: {
    padding: 15,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    backgroundColor: '#eee'
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    elevation: 5,
  },
  scheduleModalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    elevation: 5,
    maxHeight: '80%'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  saveButton: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
    marginLeft: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Undo Bar
  undoBar: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10
  },
  undoText: { color: '#fff', fontWeight: 'bold' },
  undoAction: { color: '#64B5F6', fontWeight: 'bold' },

  // Scheduling
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 8 },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f0f0f0' },
  pillActive: { backgroundColor: '#007AFF' },
  pillText: { fontSize: 14, color: '#333' },
  pillTextActive: { color: '#fff' },

  actionGrid: { gap: 10, marginTop: 10 },
  actionBtnPrimary: { backgroundColor: '#34C759', padding: 16, borderRadius: 12, alignItems: 'center' },
  actionBtnOutline: { borderWidth: 1, borderColor: '#ccc', padding: 16, borderRadius: 12, alignItems: 'center' },
  actionBtnTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  actionBtnSub: { fontSize: 12, color: '#666' },

  proposalList: { gap: 8, marginBottom: 10 },
  proposalBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#f9f9f9', borderLeftWidth: 3, borderLeftColor: '#007AFF', borderRadius: 4 },
  proposalText: { fontSize: 16 },

  errorBox: { alignItems: 'center', marginBottom: 15 },

  customContainer: { borderTopWidth: 1, borderColor: '#eee', paddingTop: 10 },
  rowScroll: { flexDirection: 'row', marginBottom: 15 },
  dayChip: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  dayChipActive: { backgroundColor: '#007AFF' },
  dayChipText: { fontSize: 10, color: '#333' },
  dayChipTextActive: { color: '#fff', fontWeight: 'bold' },
  timeInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 18, textAlign: 'center', marginBottom: 12 },
  saveBtnText: { color: '#fff', fontWeight: 'bold' },
  cancelLink: { alignItems: 'center', padding: 10 },
  cancelLinkText: { color: '#666' },

  closeModalBtn: { marginTop: 20, alignItems: 'center', padding: 10 },
  closeModalText: { color: '#666' },

  anchorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  anchorLabel: { fontSize: 16, color: '#333' },
  anchorToggle: { width: 50, height: 30, borderRadius: 15, backgroundColor: '#eee', justifyContent: 'center', padding: 2 },
  anchorToggleActive: { backgroundColor: '#34C759' },
  anchorKnob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  anchorKnobActive: { alignSelf: 'flex-end' },

  anchorTag: { backgroundColor: '#FFD60A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 },
  anchorTagText: { fontSize: 10, fontWeight: 'bold', color: '#000' }
});
