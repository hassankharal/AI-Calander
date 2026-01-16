import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Keyboard,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEvents } from '../hooks/useEvents';
import { Event } from '../types/event';
import {
  getMonthGrid,
  addMonths,
  isoDateKey,
  formatTimeRange,
  isSameMonth,
  isSameDay,
  isToday
} from '../lib/dateUtils';
import { useFocusEffect } from '@react-navigation/native';
import { useToast } from '../components/ToastBanner';
import { colors } from '../theme';
import { themeStyles } from '../theme/styles';
import { applyLayoutSpring } from '../lib/layoutSpring';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarScreen() {
  const { events, refresh, addEvent, updateEvent, deleteEvent } = useEvents();
  const { showToast } = useToast();

  // Ref pattern to stabilize focus effect
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // CRUD State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null); // null = creating
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState('09:00'); // HH:MM
  const [duration, setDuration] = useState('60'); // Minutes string

  // Refresh events when screen focuses (stable callback)
  useFocusEffect(
    useCallback(() => {
      refreshRef.current();
    }, [])
  );

  useEffect(() => {
    // Log cleanup
  }, [events.length]);

  // Generate the 42-day grid
  const daysGrid = useMemo(() => getMonthGrid(currentMonth), [currentMonth]);

  // Map events to date keys -> count/existence
  const eventMap = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach(e => {
      const d = new Date(e.startAt);
      const key = isoDateKey(d);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [events]);

  // Filter events for the selected day list
  const selectedEvents = useMemo(() => {
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const sStr = startOfDay.toISOString();
    const eStr = endOfDay.toISOString();

    return events.filter(e => {
      return e.startAt < eStr && e.endAt > sStr;
    }).sort((a, b) => a.startAt.localeCompare(b.startAt));

  }, [events, selectedDate]);


  // Navigation
  const prevMonth = () => {
    applyLayoutSpring();
    setCurrentMonth(addMonths(currentMonth, -1));
  };
  const nextMonth = () => {
    applyLayoutSpring();
    setCurrentMonth(addMonths(currentMonth, 1));
  };
  const jumpToday = () => {
    const now = new Date();
    setCurrentMonth(now);
    setSelectedDate(now);
  };

  // CRUD Helpers
  const openCreateModal = () => {
    setEditingEvent(null);
    setTitle('');
    setLocation('');
    setNotes('');
    // Default to next hour?
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    setStartTime(`${String(nextHour.getHours()).padStart(2, '0')}:${String(nextHour.getMinutes()).padStart(2, '0')}`);
    setDuration('60');
    setModalVisible(true);
  };

  const openEditModal = (event: Event) => {
    setEditingEvent(event);
    setTitle(event.title);
    setLocation(event.location || '');
    setNotes(event.notes || '');

    const start = new Date(event.startAt);
    setStartTime(`${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`);

    const end = new Date(event.endAt);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.round(diffMs / 60000);
    setDuration(String(diffMins));

    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Required", "Please enter a title.");
      return;
    }

    // Parse time
    const [hh, mm] = startTime.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      Alert.alert("Invalid Time", "Use format HH:MM (24h)");
      return;
    }

    const dur = parseInt(duration);
    if (isNaN(dur) || dur <= 0) {
      Alert.alert("Invalid Duration", "Duration must be positive minutes");
      return;
    }

    // Construct dates
    let baseDate = new Date(selectedDate);
    if (editingEvent) {
      // If editing, use the original date of the event, but update start time?
      // Or if user selected a DIFFERENT date on calendar, maybe they want to move it?
      // Standard UX: If I open an event from Agenda, I expect to edit THAT event.
      // If I want to move it, I usually change the date field.
      // Since we lack a Date Picker in modal, let's keep the event's original date (Year/Month/Day).
      baseDate = new Date(editingEvent.startAt);
    }

    baseDate.setHours(hh, mm, 0, 0);
    const startIso = baseDate.toISOString();

    const end = new Date(baseDate);
    end.setMinutes(baseDate.getMinutes() + dur);
    const endIso = end.toISOString();

    try {
      if (editingEvent) {
        await updateEvent(editingEvent.id, {
          title,
          location,
          notes,
          startAt: startIso,
          endAt: endIso
        });
        showToast("Event updated");
      } else {
        await addEvent({
          title,
          location,
          notes,
          startAt: startIso,
          endAt: endIso
        });
        showToast("Event created");
      }
      setModalVisible(false);
    } catch (e: any) { // eslint-disable-line
      Alert.alert("Error", e.message || "Failed to save");
    }
  };

  const handleDelete = () => {
    if (!editingEvent) return;
    Alert.alert("Delete Event", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          await deleteEvent(editingEvent.id);
          setModalVisible(false);
          showToast("Event deleted");
        }
      }
    ]);
  };

  // Renderers

  const renderDayCell = (date: Date) => {
    const dateKey = isoDateKey(date);
    const isCurrentMonth = isSameMonth(date, currentMonth);
    const isSelected = isSameDay(date, selectedDate);
    const isTodayDate = isToday(date);
    const hasEvents = (eventMap.get(dateKey) || 0) > 0;

    return (
      <TouchableOpacity
        key={dateKey}
        style={[
          styles.cell,
          isSelected && styles.selectedCell,
          !isCurrentMonth && styles.otherMonthCell
        ]}
        onPress={() => {
          applyLayoutSpring();
          setSelectedDate(date);
          if (!isSameMonth(date, currentMonth)) {
            setCurrentMonth(date);
          }
        }}
      >
        <Text style={[
          styles.cellText,
          isSelected && styles.selectedText,
          !isCurrentMonth && styles.otherMonthText,
          isTodayDate && !isSelected && styles.todayText
        ]}>
          {date.getDate()}
        </Text>
        {/* Event Dot */}
        {hasEvents && (
          <View style={[styles.dot, isSelected ? styles.dotSelected : styles.dotNormal]} />
        )}
      </TouchableOpacity>
    );
  };

  const renderAgendaItem = ({ item }: { item: Event }) => (
    <TouchableOpacity
      style={[themeStyles.glassCard, styles.agendaItem]}
      onPress={() => openEditModal(item)}
    >
      <View style={styles.agendaTimeBox}>
        <Text style={themeStyles.muted}>{formatTimeRange(item.startAt, item.endAt)}</Text>
      </View>
      <View style={styles.agendaContent}>
        <Text style={themeStyles.body}>{item.title}</Text>
        {item.location && <Text style={themeStyles.muted}>📍 {item.location}</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={themeStyles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={24} color="#007AFF" />
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={jumpToday} style={styles.todayBtn}>
            <Text style={styles.todayBtnText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openCreateModal} style={styles.addEventBtn}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Weekday Headers */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map(day => (
          <Text key={day} style={styles.weekHeader}>{day}</Text>
        ))}
      </View>

      {/* Month Grid */}
      <View style={styles.grid}>
        <View style={styles.gridRowWrap}>
          {daysGrid.map((d) => renderDayCell(d))}
        </View>
      </View>

      {/* Agenda Header */}
      <View style={styles.agendaHeader}>
        <Text style={styles.agendaDate}>
          {selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </Text>
      </View>

      {/* Agenda List */}
      <FlatList
        data={selectedEvents}
        keyExtractor={item => item.id}
        renderItem={renderAgendaItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No events</Text>
          </View>
        }
      />

      {/* Edit/Create Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalOverlay} onPress={Keyboard.dismiss}>
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <ScrollView>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{editingEvent ? "Edit Event" : "New Event"}</Text>
                  <TouchableOpacity onPress={handleSave}>
                    <Text style={styles.saveBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.titleInput}
                  placeholder="Event Title"
                  value={title}
                  onChangeText={setTitle}
                  autoFocus={!editingEvent}
                />

                <View style={styles.row}>
                  <View style={styles.halfInput}>
                    <Text style={styles.label}>Start (HH:MM)</Text>
                    <TextInput
                      style={styles.input}
                      value={startTime}
                      onChangeText={setStartTime}
                      placeholder="09:00"
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <View style={styles.halfInput}>
                    <Text style={styles.label}>Duration (min)</Text>
                    <TextInput
                      style={styles.input}
                      value={duration}
                      onChangeText={setDuration}
                      placeholder="60"
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Location (Optional)"
                  value={location}
                  onChangeText={setLocation}
                />

                <TextInput
                  style={[styles.input, styles.notesInput]}
                  placeholder="Notes (Optional)"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />

                <View style={styles.modalFooter}>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>

                  {editingEvent && (
                    <TouchableOpacity onPress={handleDelete}>
                      <Text style={styles.deleteText}>Delete Event</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // container handled by themeStyles.screen
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 10,
    marginHorizontal: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderBottomColor: colors.borderGlass
  },
  monthTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  navBtn: { padding: 8 },
  todayBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: 12,
    marginRight: 8
  },
  todayBtnText: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  addEventBtn: {
    backgroundColor: colors.cyan,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },

  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGlass,
    paddingVertical: 8
  },
  weekHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600'
  },

  grid: { paddingVertical: 10 },
  gridRowWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.28%', // 100% / 7
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCell: { backgroundColor: colors.cyan, borderRadius: 20 },
  otherMonthCell: { opacity: 0.3 },

  cellText: { fontSize: 16, color: colors.textPrimary },
  selectedText: { color: '#000', fontWeight: 'bold' }, // Black text on cyan
  otherMonthText: { color: colors.textSecondary },
  todayText: { color: colors.cyan, fontWeight: 'bold' },

  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 4 },
  dotNormal: { backgroundColor: colors.cyan },
  dotSelected: { backgroundColor: '#000' }, // visible on cyan

  agendaHeader: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderColor: colors.borderGlass,
    borderRadius: 18,
    marginHorizontal: 16, // Inset to match floating look
    marginBottom: 8,
  },
  agendaDate: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },

  listContent: { paddingBottom: 20, paddingHorizontal: 16, paddingTop: 10 },
  agendaItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
    alignItems: 'center'
  },
  agendaTimeBox: { width: 80 },
  // agendaTime handled by themeStyles
  agendaContent: { flex: 1, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.cyan },
  // agendaTitle, agendaLocation handled by themeStyles

  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.obsidian,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderColor: colors.borderGlass,
    borderWidth: 1,
    padding: 20,
    maxHeight: '90%'
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
  saveBtnText: { color: colors.cyan, fontSize: 18, fontWeight: 'bold' },

  titleInput: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGlass,
    paddingVertical: 5,
    color: colors.textPrimary,
  },
  row: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  halfInput: { flex: 1 },
  label: { fontSize: 12, color: colors.textSecondary, marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.glass,
    marginBottom: 15,
    color: colors.textPrimary
  },
  notesInput: { height: 80, textAlignVertical: 'top' },

  modalFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, alignItems: 'center' },
  cancelText: { fontSize: 16, color: colors.textSecondary },
  deleteText: { fontSize: 16, color: '#FF3B30' }
});
