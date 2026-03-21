import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const AGE_CONFIRMED_KEY = 'age_confirmed';

export default function AgeGateScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(AGE_CONFIRMED_KEY).then(value => {
      if (value === 'true') {
        navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] })
        );
      } else {
        setChecking(false);
      }
    });
  }, []);

  const handleConfirm = async () => {
    if (!checked) return;
    await AsyncStorage.setItem(AGE_CONFIRMED_KEY, 'true');
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] })
    );
  };

  if (checking) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.inner}>
        <Text style={[styles.appName, { color: theme.primary }]}>ScoreBoard</Text>
        <Text style={[styles.title, { color: theme.text }]}>Before you continue</Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          This app is intended for users aged 13 and older. By continuing, you confirm that you meet this requirement.
        </Text>

        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setChecked(c => !c)}
          activeOpacity={0.7}>
          <View style={[
            styles.checkbox,
            { borderColor: checked ? theme.primary : theme.border },
            checked && { backgroundColor: theme.primary },
          ]}>
            {checked && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.checkLabel, { color: theme.text }]}>
            I confirm that I am at least 13 years old
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: checked ? theme.primary : theme.border },
          ]}
          onPress={handleConfirm}
          disabled={!checked}
          activeOpacity={0.8}>
          <Text style={[styles.buttonText, { color: checked ? '#fff' : theme.textSecondary }]}>
            Continue
          </Text>
        </TouchableOpacity>

        <Text style={[styles.legal, { color: theme.textSecondary }]}>
          If you are under 13, please do not use this app.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  inner: {
    paddingHorizontal: 32,
  },
  appName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 32,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  checkLabel: {
    fontSize: 15,
    flex: 1,
    lineHeight: 20,
  },
  button: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  legal: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
