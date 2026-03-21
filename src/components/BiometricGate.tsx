import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { BiometricService } from '../services/BiometricService';
import { useTheme } from '../context/ThemeContext';

export default function BiometricGate({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);

  const appState = useRef(AppState.currentState);
  const wasBackgroundedRef = useRef(false);

  useEffect(() => {
    checkBiometric();
  }, []);

  // Re-lock when app returns from background
  useEffect(() => {
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [needsAuth]);

  const handleAppStateChange = async (nextState: AppStateStatus) => {
    if (!needsAuth) return;
    if (appState.current === 'active' && nextState.match(/inactive|background/)) {
      wasBackgroundedRef.current = true;
    }
    if (nextState === 'active' && wasBackgroundedRef.current) {
      wasBackgroundedRef.current = false;
      setIsAuthenticated(false);
      // Auto-prompt when returning from background
      const success = await BiometricService.authenticate();
      if (success) setIsAuthenticated(true);
    }
    appState.current = nextState;
  };

  const checkBiometric = async () => {
    const enabled = await BiometricService.isEnabled();
    if (enabled) {
      setNeedsAuth(true);
      setIsChecking(false);
      // Auto-prompt on launch
      const success = await BiometricService.authenticate();
      if (success) setIsAuthenticated(true);
    } else {
      setIsAuthenticated(true);
      setIsChecking(false);
    }
  };

  const handleAuthenticate = async () => {
    const success = await BiometricService.authenticate();
    if (success) setIsAuthenticated(true);
  };

  if (isChecking) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (needsAuth && !isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={[styles.title, { color: theme.text }]}>ScoreBoard is Locked</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Authenticate to continue
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleAuthenticate}>
          <Text style={styles.buttonText}>Unlock</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  lockIcon: { fontSize: 64, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 40, textAlign: 'center' },
  button: { paddingHorizontal: 40, paddingVertical: 15, borderRadius: 10 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
