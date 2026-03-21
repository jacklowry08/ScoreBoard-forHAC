import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GradeSharingService } from '../services/GradeSharingService';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';

const SHOW_AVERAGES_KEY = 'show_class_averages';

export default function GradeSharingScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [showAverages, setShowAverages] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const isEnabled = await GradeSharingService.isEnabled();
    const shouldShowAverages = await AsyncStorage.getItem(SHOW_AVERAGES_KEY);
    
    setEnabled(isEnabled);
    setShowAverages(shouldShowAverages === 'true');
    setLoading(false);
  };

  const handleToggleSharing = async (value: boolean) => {
    if (toggling) return;
    setToggling(true);
    setEnabled(value);
    if (!value) {
      setShowAverages(false);
      await AsyncStorage.setItem(SHOW_AVERAGES_KEY, 'false');
    }
    const success = await GradeSharingService.setEnabled(value);
    if (!success) {
      setEnabled(!value);
      if (!value) setShowAverages(true);
    }
    setToggling(false);
  };

  const handleToggleShowAverages = async (value: boolean) => {
    setShowAverages(value);
    await AsyncStorage.setItem(SHOW_AVERAGES_KEY, value.toString());
    console.log('📊 Show class averages:', value);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header with Back Button */}
      <GradientHeader style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: 'rgba(0,0,0,0.2)' }]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.headerText }]}>Grade Sharing</Text>
        </View>
      </GradientHeader>

      <ScrollView style={styles.content}>
        {/* Share Grades Toggle */}
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={[styles.switchTitle, { color: theme.text }]}>
                Share My Grades
              </Text>
              <Text style={[styles.switchSubtitle, { color: theme.textSecondary }]}>
                Contribute to class averages
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggleSharing}
              disabled={loading || toggling}
              trackColor={{ false: theme.border, true: theme.primary + '80' }}
              thumbColor={enabled ? theme.primary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Show Averages Toggle */}
        {enabled && (
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={[styles.switchTitle, { color: theme.text }]}>
                  Show Class Averages
                </Text>
                <Text style={[styles.switchSubtitle, { color: theme.textSecondary }]}>
                  Display averages on grade cards
                </Text>
              </View>
              <Switch
                value={showAverages}
                onValueChange={handleToggleShowAverages}
                trackColor={{ false: theme.border, true: theme.primary + '80' }}
                thumbColor={showAverages ? theme.primary : '#f4f3f4'}
              />
            </View>
          </View>
        )}

        {/* How It Works */}
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>How It Works</Text>
          <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
            When enabled, your grades are anonymously uploaded once per day to calculate class averages. 
            You can choose whether or not to see how your performance compares to your classmates.
          </Text>
        </View>

        {/* What We Collect */}
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>What We Collect</Text>
          <View style={styles.bulletList}>
            <Text style={[styles.bulletPoint, { color: theme.textSecondary }]}>
              • Course code (e.g., "0708400")
            </Text>
            <Text style={[styles.bulletPoint, { color: theme.textSecondary }]}>
              • Class name (e.g., "AP Spanish Lang")
            </Text>
            <Text style={[styles.bulletPoint, { color: theme.textSecondary }]}>
              • Your grade percentage
            </Text>
            <Text style={[styles.bulletPoint, { color: theme.textSecondary }]}>
              • Anonymous device ID
            </Text>
          </View>
        </View>

        {/* What We DON'T Collect */}
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>What We DON'T Collect</Text>
          <View style={styles.bulletList}>
            <Text style={[styles.bulletPoint, { color: theme.textSecondary }]}>
              ✗ Your name
            </Text>
            <Text style={[styles.bulletPoint, { color: theme.textSecondary }]}>
              ✗ Student ID number
            </Text>
            <Text style={[styles.bulletPoint, { color: theme.textSecondary }]}>
              ✗ HAC username or password
            </Text>
            <Text style={[styles.bulletPoint, { color: theme.textSecondary }]}>
              ✗ Individual assignments
            </Text>
            <Text style={[styles.bulletPoint, { color: theme.textSecondary }]}>
              ✗ Any personally identifiable information
            </Text>
          </View>
        </View>

        {/* Privacy Guarantee */}
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Privacy Guarantee</Text>
          <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
            • Class averages only shown when 10+ students participate
          </Text>
          <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
            • All data is 100% anonymous
          </Text>
          <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
            • You can opt out anytime by toggling this setting off
          </Text>
          <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
            • Your data is deleted immediately when you disable sharing
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    paddingTop: 60,
    paddingBottom: 10,
  },
  headerContent: {
    paddingHorizontal: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold',
  },
  content: { flex: 1, padding: 20 },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    flex: 1,
    marginRight: 16,
  },
  switchTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  switchSubtitle: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  bulletList: {
    gap: 8,
  },
  bulletPoint: {
    fontSize: 15,
    lineHeight: 22,
  },
});
