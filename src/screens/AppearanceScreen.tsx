import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import ThemeSlider from '../components/ThemeSlider';
import ColorPicker from '../components/ColorPicker';
import GradientHeader from '../components/GradientHeader';

export default function AppearanceScreen({ navigation }: any) {
  const { theme, isDark, oledMode, setOledMode } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <GradientHeader style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={theme.headerText} />
          <Text style={[styles.backButtonText, { color: theme.headerText }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.headerText }]}>Appearance</Text>
      </GradientHeader>

      <ScrollView style={styles.content}>
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Theme Mode</Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
            Choose between light and dark mode, or sync with your system settings
          </Text>
          <ThemeSlider />

          {isDark && (
            <View style={[styles.oledRow, { borderTopColor: theme.border }]}>
              <View style={styles.oledLeft}>
                <Text style={[styles.oledLabel, { color: theme.text }]}>OLED True Black</Text>
                <Text style={[styles.oledSub, { color: theme.textSecondary }]}>
                  Pure black background for OLED displays
                </Text>
              </View>
              <Switch
                value={oledMode}
                onValueChange={setOledMode}
                trackColor={{ false: '#767577', true: theme.primary }}
                thumbColor="#fff"
              />
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Accent Color</Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
            Personalize your experience with your favorite color
          </Text>
          <ColorPicker />
        </View>

        <View style={[styles.infoBox, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            Your theme preferences are saved and will be remembered next time you open the app
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  oledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  oledLeft: {
    flex: 1,
    marginRight: 12,
  },
  oledLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  oledSub: {
    fontSize: 12,
  },
  infoBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 40,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
