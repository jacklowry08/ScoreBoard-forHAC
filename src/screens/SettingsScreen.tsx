import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { DESTRUCTIVE } from '../constants/colors';
import GradientHeader from '../components/GradientHeader';
import ScalePressable from '../components/ScalePressable';
import { useAuth } from '../context/AuthContext';
import { GradeCacheService } from '../services/GradeCacheService';
import { clearHACSessionCache } from '../services/HACDirectClient';
import { CommonActions } from '@react-navigation/native';

export default function SettingsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { setAuthenticated } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            console.log('🔄 LOGGING OUT');
            await SecureStore.deleteItemAsync('hac_username');
            await SecureStore.deleteItemAsync('hac_password');
            await SecureStore.deleteItemAsync('remember_me');
            await AsyncStorage.removeItem('prefetched_current_period');
            await AsyncStorage.removeItem('student_first_name');
            await GradeCacheService.clearCache();
            clearHACSessionCache();
            setAuthenticated(false);
            navigation.dispatch(
              CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] })
            );
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <GradientHeader style={styles.header}>
        <Text style={[styles.title, { color: theme.headerText }]}>Settings</Text>
      </GradientHeader>
      
      <ScrollView style={styles.content}>
        {/* Settings Options */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: theme.cardBorderWidth }]}>
          <ScalePressable
            style={styles.settingRow}
            onPress={() => navigation.navigate('GradeSharing')}>
            <View style={styles.settingLeft}>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Grade Sharing</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
                  See class averages
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </ScalePressable>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <ScalePressable
            style={styles.settingRow}
            onPress={() => navigation.navigate('Security')}>
            <View style={styles.settingLeft}>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Security</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
                  Biometric lock and privacy
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </ScalePressable>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <ScalePressable
            style={styles.settingRow}
            onPress={() => navigation.navigate('Appearance')}>
            <View style={styles.settingLeft}>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Appearance</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
                  Theme and colors
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </ScalePressable>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <ScalePressable
            style={styles.settingRow}
            onPress={() => Linking.openURL('mailto:scoreboardhac@gmail.com')}>
            <View style={styles.settingLeft}>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Contact Support</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
                  scoreboardhac@gmail.com
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </ScalePressable>
        </View>

        {/* Legal */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: theme.cardBorderWidth }]}>
          <ScalePressable
            style={styles.settingRow}
            onPress={() => navigation.navigate('PrivacyPolicy')}>
            <View style={styles.settingLeft}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </ScalePressable>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <ScalePressable
            style={styles.settingRow}
            onPress={() => navigation.navigate('TermsOfService')}>
            <View style={styles.settingLeft}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </ScalePressable>
        </View>

        {/* About Section */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: theme.cardBorderWidth }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>About</Text>
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>ScoreBoard for HAC™ v1.01</Text>
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            Grade Tracker for Students
          </Text>
          <Text style={[styles.disclaimerText, { color: theme.textSecondary }]}>
            Not affiliated with PowerSchool or St. Johns County Schools
          </Text>
        </View>

        {/* Logout Section */}
        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: theme.cardBackground, borderColor: DESTRUCTIVE }]} 
          onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Developer Credit */}
        <View style={styles.developerSection}>
          <Text style={[styles.developerText, { color: theme.textSecondary }]}>
            ScoreBoard for HAC™
          </Text>
          <Text style={[styles.developerText, { color: theme.textSecondary }]}>
            Developed by Jack Lowry
          </Text>
          <Text style={[styles.copyrightText, { color: theme.textSecondary }]}>
            © 2026 Jack Lowry. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold', fontFamily: 'Inter_700Bold' },
  content: { flex: 1, padding: 20 },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  settingTitle: { fontSize: 16, fontWeight: '600' },
  settingSubtitle: { fontSize: 13, marginTop: 2 },
  divider: { height: 1, marginVertical: 8 },
  infoText: { fontSize: 14, marginBottom: 8 },
  disclaimerText: { fontSize: 11, marginTop: 8, fontStyle: 'italic' },
  logoutButton: { padding: 15, borderRadius: 16, alignItems: 'center', borderWidth: 2, marginBottom: 20 },
  logoutText: { color: DESTRUCTIVE, fontSize: 16, fontWeight: 'bold' },
  developerSection: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 4,
  },
  developerText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  copyrightText: {
    fontSize: 10,
    marginTop: 4,
  },
});
