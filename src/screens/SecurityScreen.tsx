import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';
import { BiometricService } from '../services/BiometricService';

export default function SecurityScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricTypes, setBiometricTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBiometricStatus();
  }, []);

  const loadBiometricStatus = async () => {
    const available = await BiometricService.isAvailable();
    const enabled = await BiometricService.isEnabled();
    const types = await BiometricService.getSupportedTypes();
    
    setBiometricAvailable(available);
    setBiometricEnabled(enabled);
    setBiometricTypes(types);
    setLoading(false);
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      // Enabling - require authentication first
      const authenticated = await BiometricService.authenticate(
        'Authenticate to enable biometric lock'
      );
      
      if (authenticated) {
        await BiometricService.setEnabled(true);
        setBiometricEnabled(true);
        Alert.alert(
          'Biometric Lock Enabled',
          'You will need to authenticate when opening the app.'
        );
      }
    } else {
      // Disabling
      await BiometricService.setEnabled(false);
      setBiometricEnabled(false);
      Alert.alert(
        'Biometric Lock Disabled',
        'The app will no longer require authentication.'
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <GradientHeader style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={theme.headerText} />
          <Text style={[styles.backButtonText, { color: theme.headerText }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.headerText }]}>Security</Text>
      </GradientHeader>

      <ScrollView style={styles.content}>
        {/* Biometric Authentication */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: theme.cardBorderWidth }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Biometric Authentication</Text>
          
          {!biometricAvailable ? (
            <View style={styles.unavailableContainer}>
              <Text style={[styles.unavailableText, { color: theme.textSecondary }]}>
                Biometric authentication is not available on this device.
              </Text>
              <Text style={[styles.unavailableSubtext, { color: theme.textSecondary }]}>
                Make sure Face ID or Touch ID is set up in your device settings.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>
                    Require {biometricTypes.join(' / ')}
                  </Text>
                  <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                    Lock the app with biometric authentication
                  </Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: '#767577', true: theme.primary }}
                  thumbColor="#fff"
                  disabled={loading}
                />
              </View>

              {biometricEnabled && (
                <View style={[styles.infoBox, { backgroundColor: theme.background }]}>
                  <Ionicons name="lock-closed" size={14} color={theme.textSecondary} style={styles.infoIcon} />
                  <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                    App is locked. You'll need to authenticate each time you open it.
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Security Information */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: theme.cardBorderWidth }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Data Security</Text>
          
          <View style={styles.securityItem}>
            <Ionicons name="key-outline" size={22} color={theme.primary} style={styles.securityIcon} />
            <View style={styles.securityInfo}>
              <Text style={[styles.securityTitle, { color: theme.text }]}>
                Encrypted Storage
              </Text>
              <Text style={[styles.securityDescription, { color: theme.textSecondary }]}>
                Your credentials are encrypted using iOS Keychain / Android Keystore
              </Text>
            </View>
          </View>

          <View style={styles.securityItem}>
            <Ionicons name="phone-portrait-outline" size={22} color={theme.primary} style={styles.securityIcon} />
            <View style={styles.securityInfo}>
              <Text style={[styles.securityTitle, { color: theme.text }]}>
                Local Only
              </Text>
              <Text style={[styles.securityDescription, { color: theme.textSecondary }]}>
                All data stays on your device. We have no servers.
              </Text>
            </View>
          </View>

          <View style={styles.securityItem}>
            <Ionicons name="eye-off-outline" size={22} color={theme.primary} style={styles.securityIcon} />
            <View style={styles.securityInfo}>
              <Text style={[styles.securityTitle, { color: theme.text }]}>
                No Tracking
              </Text>
              <Text style={[styles.securityDescription, { color: theme.textSecondary }]}>
                We don't collect analytics or track your usage
              </Text>
            </View>
          </View>
        </View>

        {/* Best Practices */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: theme.cardBorderWidth }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Best Practices</Text>
          <Text style={[styles.practiceText, { color: theme.textSecondary }]}>
            • Enable biometric lock for extra security
          </Text>
          <Text style={[styles.practiceText, { color: theme.textSecondary }]}>
            • Keep your device lock enabled
          </Text>
          <Text style={[styles.practiceText, { color: theme.textSecondary }]}>
            • Don't share your device with others
          </Text>
          <Text style={[styles.practiceText, { color: theme.textSecondary }]}>
            • Logout when using shared devices
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backButtonText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: 'bold' },
  content: { flex: 1, padding: 20 },
  section: { borderRadius: 12, padding: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  settingDescription: { fontSize: 13, lineHeight: 18 },
  unavailableContainer: { paddingVertical: 8 },
  unavailableText: { fontSize: 14, marginBottom: 8 },
  unavailableSubtext: { fontSize: 12, fontStyle: 'italic' },
  infoBox: { marginTop: 16, padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
  infoIcon: { marginRight: 6 },
  infoText: { fontSize: 13, flex: 1 },
  securityItem: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-start' },
  securityIcon: { marginRight: 12, marginTop: 1 },
  securityInfo: { flex: 1 },
  securityTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  securityDescription: { fontSize: 13, lineHeight: 18 },
  practiceText: { fontSize: 14, marginBottom: 8, lineHeight: 20 },
});
