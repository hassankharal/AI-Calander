import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { supabase } from '../lib/supabaseClient';
import { useUserMemory } from '../hooks/useUserMemory';
import { useSetup } from '../navigation/SetupContext';
import { colors, glass, typography } from '../theme';

export default function SettingsScreen() {
  const { resetMemory } = useUserMemory();
  const { showSetup } = useSetup();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Error signing out', error.message);
  };

  const handleReset = async () => {
    Alert.alert(
      "Reset Scheduling Profile",
      "Are you sure? This will wipe your memory settings and restart personal setup.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetMemory();
            // App.tsx effect will pick up the null memory and trigger setup
          }
        }
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Profile & Memory</Text>
        <TouchableOpacity style={styles.button} onPress={showSetup}>
          <Text style={styles.buttonText}>Edit Personal Setup</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.dangerButtonOutline]} onPress={handleReset}>
          <Text style={[styles.buttonText, styles.dangerText]}>Reset Scheduling Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Account</Text>
        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={handleSignOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>v1.1.0 (ADHD Memory)</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: colors.obsidian,
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 60,
  },
  title: {
    ...typography.headline,
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    color: colors.textPrimary,
  },
  section: {
    width: '100%',
    marginBottom: 30,
  },
  sectionHeader: {
    ...typography.muted,
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
    marginLeft: 4,
  },
  button: {
    ...glass.interactive,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 16,
  },
  dangerButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)', // transparent red
    borderColor: colors.danger,
    borderWidth: 1,
  },
  dangerButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  dangerText: {
    color: colors.danger,
  },
  version: {
    marginTop: 'auto',
    color: colors.textSecondary,
    fontSize: 12,
  },
});
