import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, SafeAreaView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import RootTabs from './src/navigation/RootTabs';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import AuthScreen from './src/screens/AuthScreen';
import PersonalSetupScreen from './src/screens/PersonalSetupScreen';
import { useUserMemory } from './src/hooks/useUserMemory';
import { SetupContext } from './src/navigation/SetupContext';
import { ToastProvider } from './src/components/ToastBanner';

function AppContent() {
  const { session, loading: authLoading } = useAuth();
  const { memory, loading: memLoading } = useUserMemory();
  const [setupActive, setSetupActive] = useState(false);

  // Auto-show setup if user is logged in but memory is null
  useEffect(() => {
    if (!setupActive && !memLoading && session && !memory) {
      // eslint-disable-next-line
      setSetupActive(true);
    }
  }, [memLoading, session, memory, setupActive]);

  if (authLoading || memLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!session) {
    return (
      <NavigationContainer>
        <AuthScreen />
      </NavigationContainer>
    );
  }

  if (setupActive) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <PersonalSetupScreen onExit={() => setSetupActive(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SetupContext.Provider value={{ showSetup: () => setSetupActive(true) }}>
      <NavigationContainer>
        <RootTabs />
      </NavigationContainer>
    </SetupContext.Provider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
