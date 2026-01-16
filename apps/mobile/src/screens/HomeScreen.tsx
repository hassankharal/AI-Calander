import React, { useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Platform, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, NavigationProp } from '@react-navigation/native';
import { useTasks } from '../hooks/useTasks';
import { useEvents } from '../hooks/useEvents';
import { Task } from '../types/task';
import { Event } from '../types/event';
import {
  colors,
  typography,
  glass,
  motion,
  spacing,
  radii
} from '../theme';
import { RootTabParamList } from '../navigation/RootTabs';


export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp<RootTabParamList>>();
  const { tasks, refresh: refreshTasks } = useTasks();
  const { events, refresh: refreshEvents } = useEvents();

  useFocusEffect(
    useCallback(() => {
      refreshTasks();
      refreshEvents();
    }, [refreshTasks, refreshEvents])
  );

  useEffect(() => {
    // Log cleanup
  }, [events.length, tasks.length]);

  // Calibration Fade Logic moved down


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
  }, [events]);

  // Calibration Formatting: One sentence, no emojis, no greeting.
  const formattedCalibration = useMemo(() => {
    let text = dailyCalibration;
    // Strip emojis
    text = text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
    // Ensure single sentence (simple heuristic: take first sentence)
    const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 0);
    return sentences[0] ? sentences[0].trim() + "." : text;
  }, [dailyCalibration]);

  useEffect(() => {
    if (__DEV__) console.log("[HOME] daily calibration:", dailyCalibration);
  }, [dailyCalibration]);

  // Calibration Fade Logic
  const calibrationOpacity = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    calibrationOpacity.setValue(0);
    Animated.timing(calibrationOpacity, {
      toValue: 1,
      duration: motion.slow.duration,
      useNativeDriver: true,
    }).start();
  }, [dailyCalibration, calibrationOpacity]);

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

  // --- Settling Animation ---
  const [isSettled, setIsSettled] = React.useState(false);
  // Use state to hold the Animated.Value to avoid "ref.current during render" checks
  const [opacityAnim] = React.useState(() => new Animated.Value(0.95));

  useEffect(() => {
    // Pulse animation: 0.95 -> 1.0 -> 0.95
    const pulse = Animated.sequence([
      Animated.timing(opacityAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0.95, duration: 2000, useNativeDriver: true })
    ]);

    const loop = Animated.loop(pulse);
    loop.start();

    // Stop after 9 seconds (settling duration)
    const timer = setTimeout(() => {
      loop.stop();
      Animated.spring(opacityAnim, {
        toValue: 1,
        ...motion.spring,
        useNativeDriver: true
      }).start(() => {
        setIsSettled(true);
        if (__DEV__) console.log("[HOME] schedule settled");
      });
    }, 9000);

    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [opacityAnim]);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        style={!isSettled ? { opacity: opacityAnim } : undefined}
      >
        {/* Premium Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerDate}>
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
            </Text>
            <Text style={styles.headerTitle}>Dashboard</Text>
          </View>
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => { /* TODO: Quick Add */ }}>
            <Ionicons name="add" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Quick Controls */}
        <View style={styles.quickControlsRow}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Tasks')}>
            <Ionicons name="checkbox-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.quickBtnText}>Add Task</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Calendar')}>
            <Ionicons name="calendar-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.quickBtnText}>Add Event</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Scheduler')}>
            <Ionicons name="flash-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.quickBtnText}>Schedule</Text>
          </TouchableOpacity>
        </View>

        {/* Morning Calibration */}
        <Animated.View style={[
          styles.calibrationCard,
          { opacity: calibrationOpacity }
        ]}>
          <Text style={styles.calibrationText}>
            {formattedCalibration}
          </Text>
        </Animated.View>

        {/* Next Event Section */}
        <View style={styles.section}>
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
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{next7DaysMetric}</Text>
            </View>
          </View>
          {next7DaysTasks.length === 0 ? (
            <Text style={styles.emptyText}>No upcoming tasks</Text>
          ) : (
            next7DaysTasks.map(renderTaskSnippet)
          )}
        </View>

      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 25 : 0,
    backgroundColor: colors.obsidian,
  },
  scrollContent: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerDate: {
    ...typography.muted,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    letterSpacing: 1,
    fontWeight: '600'
  },
  headerTitle: {
    ...typography.headline,
    fontSize: 32,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  headerActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickControlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: 24, // Pill shape
    paddingVertical: 12,
    gap: 8,
  },
  quickBtnText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  calibrationCard: {
    ...glass.card,
    padding: 16,
    marginVertical: 16,
    borderRadius: 12,
  },
  calibrationText: {
    ...typography.body,
    fontSize: 15,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  section: {
    ...glass.card,
    borderRadius: radii.card,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  // highlightSection removed - using standard section style only for consistency
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    ...typography.muted,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitleWhite: {
    ...typography.headline,
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  badge: {
    backgroundColor: colors.borderGlass,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    ...typography.muted,
    color: colors.textPrimary,
    fontSize: 12,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  emptyTextWhite: {
    ...typography.body,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  snippet: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGlass,
  },
  snippetTitle: {
    ...typography.body,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
    marginBottom: 2
  },
  snippetDate: {
    ...typography.muted,
    fontSize: 13,
    color: colors.textSecondary,
  },
  snippetLocation: {
    ...typography.muted,
    fontSize: 13,
    color: colors.textSecondary,
  },
  nextEventContent: {
    marginTop: 5,
  },
  nextEventTitle: {
    ...typography.headline,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  nextEventTime: {
    ...typography.body,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  nextEventLoc: {
    ...typography.muted,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
