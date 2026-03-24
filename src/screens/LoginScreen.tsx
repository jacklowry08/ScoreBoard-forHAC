import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { DISTRICTS, DEFAULT_DISTRICT, DISTRICT_KEY, District } from '../config/districts';
import { configureDistrict } from '../services/HACDirectClient';

export default function LoginScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needsAgeConfirm, setNeedsAgeConfirm] = useState(false);
  const [ageChecked, setAgeChecked] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<District>(DEFAULT_DISTRICT);
  const [districtModalVisible, setDistrictModalVisible] = useState(false);

  useEffect(() => {
    checkSavedCredentials();
  }, []);

  const checkSavedCredentials = async () => {
    try {
      const savedUsername = await SecureStore.getItemAsync('hac_username');
      const savedPassword = await SecureStore.getItemAsync('hac_password');
      const remembered = await SecureStore.getItemAsync('remember_me');
      const ageConfirmed = await AsyncStorage.getItem('age_confirmed');
      const districtId = await AsyncStorage.getItem(DISTRICT_KEY);
      const district = DISTRICTS.find(d => d.id === districtId) ?? DEFAULT_DISTRICT;
      setSelectedDistrict(district);

      if (ageConfirmed !== 'true') {
        setNeedsAgeConfirm(true);
      }

      if (savedUsername && savedPassword && remembered === 'true') {
        setUsername(savedUsername);
        setPassword(savedPassword);
        setRememberMe(true);
        if (ageConfirmed === 'true') {
          navigation.replace('Authenticating');  // auto-login, fast path allowed
        }
      }
    } catch (error) {
      console.error('Error checking saved credentials:', error);
    }
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }

    setLoading(true);

    try {
      await AsyncStorage.setItem(DISTRICT_KEY, selectedDistrict.id);
      configureDistrict(selectedDistrict.baseUrl);

      if (rememberMe) {
        await SecureStore.setItemAsync('hac_username', username.trim());
        await SecureStore.setItemAsync('hac_password', password.trim());
        await SecureStore.setItemAsync('remember_me', 'true');
        console.log('✅ Credentials saved (Remember Me enabled)');
      } else {
        await SecureStore.setItemAsync('hac_username', username.trim());
        await SecureStore.setItemAsync('hac_password', password.trim());
        await SecureStore.deleteItemAsync('remember_me');
        console.log('✅ Credentials saved for session only');
      }

      if (needsAgeConfirm && ageChecked) {
        await AsyncStorage.setItem('age_confirmed', 'true');
      }

      navigation.replace('Authenticating', { freshLogin: true });
    } catch (error) {
      console.error('Error saving credentials:', error);
      Alert.alert('Error', 'Failed to save credentials');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>ScoreBoard for HAC™</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Grade Tracker for Students
          </Text>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsSection}>
          <Text style={[styles.instructions, { color: theme.textSecondary }]}>
            Sign in with your HAC credentials
          </Text>
        </View>

        {/* Input Fields */}
        <View style={styles.inputSection}>
          {/* District Selector */}
          <View style={styles.districtContainer}>
            <Text style={[styles.districtLabel, { color: theme.textSecondary }]}>District</Text>
            <TouchableOpacity
              style={[
                styles.districtSelector,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => setDistrictModalVisible(true)}
              disabled={loading}>
              <Text style={[styles.districtName, { color: theme.text }]}>
                {selectedDistrict.name}
              </Text>
              <Text style={[styles.districtChevron, { color: theme.textSecondary }]}>›</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.cardBackground,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="Username"
            placeholderTextColor={theme.textSecondary}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.cardBackground,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          {/* Remember Me Checkbox */}
          <TouchableOpacity
            style={styles.rememberMeRow}
            onPress={() => setRememberMe(!rememberMe)}
            disabled={loading}>
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: theme.border,
                  backgroundColor: rememberMe ? theme.primary : 'transparent',
                },
              ]}>
              {rememberMe && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.rememberMeText, { color: theme.text }]}>
              Remember me
            </Text>
          </TouchableOpacity>

          {/* Age Confirmation (shown only until first login) */}
          {needsAgeConfirm && (
            <TouchableOpacity
              style={styles.rememberMeRow}
              onPress={() => setAgeChecked(!ageChecked)}
              disabled={loading}>
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: theme.border,
                    backgroundColor: ageChecked ? theme.primary : 'transparent',
                  },
                ]}>
                {ageChecked && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.rememberMeText, { color: theme.text }]}>
                I am at least 13 years old
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Login Button */}
        <TouchableOpacity
          style={[
            styles.loginButton,
            { backgroundColor: theme.primary },
            (loading || (needsAgeConfirm && !ageChecked)) && styles.loginButtonDisabled,
          ]}
          onPress={handleLogin}
          disabled={loading || (needsAgeConfirm && !ageChecked)}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <Text style={[styles.privacyText, { color: theme.textSecondary }]}>
            Your credentials are stored securely on your device and never shared.
          </Text>
        </View>

        {/* Disclaimer + Legal Links */}
        <View style={styles.disclaimer}>
          <Text style={[styles.disclaimerText, { color: theme.textSecondary }]}>
            Not affiliated with PowerSchool or St. Johns County Schools
          </Text>
          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
              <Text style={[styles.legalLink, { color: theme.primary }]}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={[styles.legalSeparator, { color: theme.textSecondary }]}>·</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TermsOfService')}>
              <Text style={[styles.legalLink, { color: theme.primary }]}>Terms of Service</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* District Selection Modal */}
      <Modal
        visible={districtModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDistrictModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDistrictModalVisible(false)}>
          <View
            style={[styles.modalCard, { backgroundColor: theme.cardBackground }]}
            onStartShouldSetResponder={() => true}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Select District</Text>
            {DISTRICTS.map(d => (
              <TouchableOpacity
                key={d.id}
                style={[styles.districtRow, { borderBottomColor: theme.border }]}
                onPress={() => {
                  setSelectedDistrict(d);
                  setDistrictModalVisible(false);
                }}>
                <Text style={[styles.districtRowName, { color: theme.text }]}>{d.name}</Text>
                {selectedDistrict.id === d.id && (
                  <Text style={[styles.districtCheck, { color: theme.primary }]}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.modalCancel, { borderColor: theme.border }]}
              onPress={() => setDistrictModalVisible(false)}>
              <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  instructionsSection: {
    marginBottom: 30,
  },
  instructions: {
    fontSize: 15,
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: 20,
  },
  districtContainer: {
    marginBottom: 15,
  },
  districtLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  districtSelector: {
    height: 50,
    borderRadius: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  districtName: {
    fontSize: 16,
    flex: 1,
  },
  districtChevron: {
    fontSize: 22,
    fontWeight: '300',
    marginLeft: 8,
  },
  input: {
    height: 50,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    marginBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  rememberMeText: {
    fontSize: 15,
    fontWeight: '500',
  },
  loginButton: {
    height: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  privacyNotice: {
    marginBottom: 30,
  },
  privacyText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  disclaimer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  disclaimerText: {
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  legalLink: {
    fontSize: 12,
    fontWeight: '500',
  },
  legalSeparator: {
    fontSize: 12,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  districtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  districtRowName: {
    fontSize: 16,
    flex: 1,
  },
  districtCheck: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalCancel: {
    marginTop: 16,
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
