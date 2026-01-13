import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, SafeAreaView, Platform, KeyboardAvoidingView } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useEvents } from '../hooks/useEvents';
import { Event } from '../types/event';

export default function CalendarScreen() {
  const { events, refresh, addEvent, deleteEvent, findConflicts } = useEvents();
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Date Picker visibility (for main screen)
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());

  // Modal Time Picker States
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Conflicts
  const [conflicts, setConflicts] = useState<Event[]>([]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Filter events for selected date
  const dayEvents = useMemo(() => {
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const sStr = startOfDay.toISOString();
    const eStr = endOfDay.toISOString();

    return events.filter(e => {
      // Simple overlap check with the day
      return e.startAt < eStr && e.endAt > sStr;
    });
  }, [events, selectedDate]);

  // Check conflicts when times change
  useEffect(() => {
    if (!modalVisible) return;

    const check = async () => {
      const confs = await findConflicts(startTime.toISOString(), endTime.toISOString());
      setConflicts(confs);
    };
    check();
  }, [startTime, endTime, modalVisible, findConflicts]);

  const onDateChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
      if (Platform.OS === 'android') setShowDatePicker(false);
    } else {
      if (Platform.OS === 'android') setShowDatePicker(false);
    }
  };

  const onStartTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowStartPicker(false);
    if (date) {
      const newStart = new Date(startTime);
      newStart.setHours(date.getHours());
      newStart.setMinutes(date.getMinutes());
      setStartTime(newStart);

      // Auto adjust end time if it becomes before start time (keep duration or just bump)
      if (newStart >= endTime) {
        const newEnd = new Date(newStart);
        newEnd.setHours(newStart.getHours() + 1);
        setEndTime(newEnd);
      }
    }
  };

  const onEndTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowEndPicker(false);
    if (date) {
      const newEnd = new Date(endTime);
      newEnd.setHours(date.getHours());
      newEnd.setMinutes(date.getMinutes());

      if (newEnd < startTime) {
        Alert.alert('Invalid Time', 'End time cannot be before start time');
      } else {
        setEndTime(newEnd);
      }
    }
  };

  const handleCreateEvent = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }

    await addEvent({
      title: title.trim(),
      location: location.trim(),
      startAt: startTime.toISOString(),
      endAt: endTime.toISOString(),
    });

    setModalVisible(false);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setLocation('');
    setConflicts([]);
  };

  const openModal = () => {
    // Initialize times based on selectedDate
    const start = new Date(selectedDate);
    const now = new Date(); // Use current time hours if on today?

    // If selected date is today, use next hour. If future/past, just use 9am? 
    // Let's just use current clock time but on selected date
    start.setHours(now.getHours() + 1, 0, 0, 0);

    const end = new Date(start);
    end.setHours(start.getHours() + 1);

    setStartTime(start);
    setEndTime(end);
    setModalVisible(true);
  };

  const renderEventItem = ({ item }: { item: Event }) => {
    const s = new Date(item.startAt);
    const e = new Date(item.endAt);
    const timeStr = `${s.getHours()}:${s.getMinutes().toString().padStart(2, '0')} - ${e.getHours()}:${e.getMinutes().toString().padStart(2, '0')}`;

    return (
      <View style={styles.eventItem}>
        <View style={styles.eventContent}>
          <Text style={styles.eventTitle}>{item.title}</Text>
          <Text style={styles.eventTime}>{timeStr}</Text>
          {item.location ? <Text style={styles.eventLocation}>📍 {item.location}</Text> : null}
        </View>
        <TouchableOpacity onPress={() => Alert.alert('Delete', 'Delete this event?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deleteEvent(item.id) }
        ])}>
          <Text style={styles.deleteText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateSelector}>
          <Text style={styles.dateText}>{selectedDate.toDateString()} ▼</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addButton} onPress={openModal}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          testID="dateTimePicker"
          value={selectedDate}
          mode="date"
          is24Hour={true}
          display="default"
          onChange={onDateChange}
        />
      )}

      <FlatList
        data={dayEvents}
        keyExtractor={item => item.id}
        renderItem={renderEventItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No events for this day</Text>}
      />

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
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Event</Text>

            <TextInput
              style={styles.input}
              placeholder="Title (required)"
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              style={styles.input}
              placeholder="Location"
              value={location}
              onChangeText={setLocation}
            />

            <Text style={styles.label}>Start Time</Text>
            <TouchableOpacity style={styles.timeButton} onPress={() => setShowStartPicker(true)}>
              <Text>{startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </TouchableOpacity>
            {showStartPicker && (
              <DateTimePicker
                value={startTime}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={onStartTimeChange}
              />
            )}

            <Text style={styles.label}>End Time</Text>
            <TouchableOpacity style={styles.timeButton} onPress={() => setShowEndPicker(true)}>
              <Text>{endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </TouchableOpacity>
            {showEndPicker && (
              <DateTimePicker
                value={endTime}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={onEndTimeChange}
              />
            )}

            {conflicts.length > 0 && (
              <View style={styles.conflictBox}>
                <Text style={styles.conflictTitle}>⚠ Conflicts detected:</Text>
                {conflicts.map(c => (
                  <Text key={c.id} style={styles.conflictText}>• {c.title}</Text>
                ))}
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleCreateEvent}>
                <Text style={[styles.buttonText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Platform.OS === 'android' ? 25 : 0,
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
  dateSelector: {
    padding: 10,
  },
  dateText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: -2,
  },
  listContent: {
    padding: 20,
  },
  eventItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  eventTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  eventLocation: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  deleteText: {
    fontSize: 20,
    color: '#999',
    padding: 10,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#999',
  },
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
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    marginTop: 5,
  },
  timeButton: {
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
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
  conflictBox: {
    backgroundColor: '#FFF4E5',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FFCC80',
  },
  conflictTitle: {
    color: '#D84315',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 5,
  },
  conflictText: {
    color: '#E65100',
    fontSize: 12,
  },
});
