import React, { useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTasks } from '../hooks/useTasks';
import { useEvents } from '../hooks/useEvents';
import { Task } from '../types/task';
import { Event } from '../types/event';

export default function HomeScreen() {
  const { tasks, refresh: refreshTasks } = useTasks();
  const { events, refresh: refreshEvents } = useEvents();

  useFocusEffect(
    useCallback(() => {
      refreshTasks();
      refreshEvents();
    }, [refreshTasks, refreshEvents])
  );

  useEffect(() => {
    if (__DEV__) {
      console.log("[HOME] events received:", events.length);
      console.log("[HOME] tasks received:", tasks.length);
    }
  }, [events.length, tasks.length]);

  const { todayMetric, next7DaysMetric, todayTasks, next7DaysTasks } = useMemo(() => {
    const today = new Date();
    const todayStr = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0')
    ].join('-');

    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const nextWeekStr = [
      nextWeek.getFullYear(),
      String(nextWeek.getMonth() + 1).padStart(2, '0'),
      String(nextWeek.getDate()).padStart(2, '0')
    ].join('-');

    const todayList = tasks.filter(t => t.dueDate === todayStr && !t.completed);
    const next7List = tasks.filter(t =>
      t.dueDate && t.dueDate > todayStr && t.dueDate <= nextWeekStr && !t.completed
    );

    return {
      todayMetric: todayList.length,
      next7DaysMetric: next7List.length,
      todayTasks: todayList,
      next7DaysTasks: next7List
    };
  }, [tasks]);

  const { nextEvent, upcomingEvents } = useMemo(() => {
    const now = new Date();
    const nowISO = now.toISOString();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    const nextWeekISO = nextWeek.toISOString();

    const futureEvents = events.filter(e => e.endAt > nowISO).sort((a, b) => a.startAt.localeCompare(b.startAt));

    const next = futureEvents.find(e => e.startAt > nowISO);

    const upcoming = events.filter(e =>
      e.startAt > nowISO && e.startAt <= nextWeekISO
    ).sort((a, b) => a.startAt.localeCompare(b.startAt));

    return {
      nextEvent: next,
      upcomingEvents: upcoming
    };
  }, [events]);

  // Force re-calc at least once per day
  const todayKey = new Date().toDateString();

  const dailyCalibration = useMemo(() => {
    const now = new Date();

    const isSameLocalDay = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    const todayEvents = events.filter(e => isSameLocalDay(new Date(e.startAt), now));

    if (todayEvents.length === 0) {
      return "Open runway this morning. Prioritize one meaningful output.";
    }

    const morningEvents = todayEvents.filter(e => new Date(e.startAt).getHours() < 12);
    if (morningEvents.length >= 2) {
      return "Execution day. Deep work protected until noon.";
    }

    if (todayEvents.length >= 4) {
      return "High context switching. Recovery buffers recommended.";
    }

    return "Balanced day. Maintain momentum.";
  }, [events, todayKey]);

  useEffect(() => {
    if (__DEV__) console.log("[HOME] daily calibration:", dailyCalibration);
  }, [dailyCalibration]);

  const renderTaskSnippet = (task: Task) => (
    <View key={task.id} style={styles.snippet}>
      <Text style={styles.snippetTitle}>{task.title}</Text>
      <Text style={styles.snippetDate}>Due: {task.dueDate}</Text>
    </View>
  );

  const renderEventSnippet = (event: Event) => {
    const s = new Date(event.startAt);
    const dateStr = s.toLocaleDateString();
    const timeStr = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      <View key={event.id} style={styles.snippet}>
        <Text style={styles.snippetTitle}>📅 {event.title}</Text>
        <Text style={styles.snippetDate}>{dateStr} at {timeStr}</Text>
        {event.location ? <Text style={styles.snippetLocation}>{event.location}</Text> : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Dashboard</Text>

        {/* Morning Calibration */}
        <View style={styles.calibrationSection}>
          <Text style={styles.calibrationText}>{dailyCalibration}</Text>
        </View>

        {/* Next Event Section */}
        <View style={[styles.section, styles.highlightSection]}>
          <Text style={styles.sectionTitleWhite}>Next Event</Text>
          {nextEvent ? (
            <View style={styles.nextEventContent}>
              <Text style={styles.nextEventTitle}>{nextEvent.title}</Text>
              <Text style={styles.nextEventTime}>
                {new Date(nextEvent.startAt).toLocaleString()}
              </Text>
              {nextEvent.location && <Text style={styles.nextEventLoc}>📍 {nextEvent.location}</Text>}
            </View>
          ) : (
            <Text style={styles.emptyTextWhite}>No upcoming events</Text>
          )}
        </View>

        {/* Tasks Due Today */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tasks Due Today</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{todayMetric}</Text>
            </View>
          </View>
          {todayTasks.length === 0 ? (
            <Text style={styles.emptyText}>No tasks due today</Text>
          ) : (
            todayTasks.map(renderTaskSnippet)
          )}
        </View>

        {/* Upcoming Events (7 Days) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Events (Next 7 Days)</Text>
          </View>
          {upcomingEvents.length === 0 ? (
            <Text style={styles.emptyText}>No upcoming events</Text>
          ) : (
            upcomingEvents.map(renderEventSnippet)
          )}
        </View>

        {/* Tasks Next 7 Days */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tasks (Next 7 Days)</Text>
            <View style={[styles.badge, { backgroundColor: '#FF9500' }]}>
              <Text style={styles.badgeText}>{next7DaysMetric}</Text>
            </View>
          </View>
          {next7DaysTasks.length === 0 ? (
            <Text style={styles.emptyText}>No upcoming tasks</Text>
          ) : (
            next7DaysTasks.map(renderTaskSnippet)
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  scrollContent: {
    padding: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  highlightSection: {
    backgroundColor: '#007AFF', // Blue for next event
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionTitleWhite: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
  },
  emptyTextWhite: {
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
  },
  snippet: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  snippetTitle: {
    fontSize: 16,
    color: '#444',
    fontWeight: '500',
  },
  snippetDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  snippetLocation: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  nextEventContent: {
    marginTop: 5,
  },
  nextEventTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  nextEventTime: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 5,
  },
  nextEventLoc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 5,
  },
  calibrationSection: {
    marginBottom: 20,
    marginTop: -5,
  },
  calibrationText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  }
});
