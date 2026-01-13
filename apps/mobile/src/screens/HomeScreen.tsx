import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native'; // Ensure this is installed/available, standard in Expo routing
import { useTasks } from '../hooks/useTasks';
import { Task } from '../types/task';

export default function HomeScreen() {
  const { tasks, refresh } = useTasks();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const { todayMetric, next7DaysMetric, todayTasks, next7DaysTasks } = useMemo(() => {
    const today = new Date();
    // Use local time construction to match user expectation
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

  const renderTaskSnippet = (task: Task) => (
    <View key={task.id} style={styles.taskSnippet}>
      <Text style={styles.taskSnippetTitle}>{task.title}</Text>
      <Text style={styles.taskSnippetDate}>{task.dueDate}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Dashboard</Text>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Due Today</Text>
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

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Next 7 Days</Text>
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
  taskSnippet: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  taskSnippetTitle: {
    fontSize: 16,
    color: '#444',
  },
  taskSnippetDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
});
