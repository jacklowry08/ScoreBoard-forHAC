import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';

export default function TermsOfServiceScreen({ navigation }: any) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <GradientHeader style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={theme.headerText} />
          <Text style={[styles.backButtonText, { color: theme.headerText }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.headerText }]}>Terms of Service</Text>
      </GradientHeader>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.date, { color: theme.textSecondary }]}>Last Updated: March 4, 2026</Text>

        <Text style={[styles.heading, { color: theme.text }]}>Acceptance of Terms</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          By downloading, installing, or using ScoreBoard ("the app"), you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use the app.
        </Text>

        <Text style={[styles.heading, { color: theme.text }]}>Description of Service</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          ScoreBoard is a third-party mobile application that helps students view their grades from Home Access Center (HAC) by:{'\n'}
          • Securely storing HAC credentials on your device{'\n'}
          • Automatically logging into HAC on your behalf{'\n'}
          • Displaying grade information in a mobile-friendly format{'\n'}
          • Optionally contributing anonymized grade data to compute class averages (Grade Sharing)
        </Text>

        <Text style={[styles.heading, { color: theme.text }]}>Eligibility</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          You must:{'\n'}
          • Be at least 13 years old to use this app{'\n'}
          • Be a student with valid HAC credentials{'\n'}
          • Have permission from a parent or guardian if under 18{'\n'}
          • Comply with your school's technology use policies
        </Text>

        <Text style={[styles.heading, { color: theme.text }]}>User Responsibilities</Text>

        <Text style={[styles.subheading, { color: theme.text }]}>You Agree To:</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          • Provide your own accurate HAC credentials — not another person's{'\n'}
          • Keep your device secure (use a device lock or biometrics){'\n'}
          • Not share your device or credentials with untrusted individuals{'\n'}
          • Not use the app for any unlawful purpose{'\n'}
          • Not attempt to reverse engineer, modify, or exploit the app
        </Text>

        <Text style={[styles.subheading, { color: theme.text }]}>You Understand That:</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          • Your HAC credentials are stored on YOUR device only{'\n'}
          • You are responsible for the security of your device{'\n'}
          • We have NO access to your credentials or grade data{'\n'}
          • Grade Sharing is entirely opt-in; you may disable it at any time{'\n'}
          • This is an UNOFFICIAL app, not endorsed by your school
        </Text>

        <Text style={[styles.heading, { color: theme.text }]}>Grade Sharing Feature</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          If you enable Grade Sharing:{'\n'}
          • Your grade percentages, course codes, and class names are submitted anonymously to our database{'\n'}
          • This data is used solely to calculate and display class averages{'\n'}
          • Class averages are only shown when at least 10 students have contributed{'\n'}
          • You can opt out and have your data deleted at any time in Settings{'\n'}
          • You consent to this anonymous data being used in aggregate calculations
        </Text>

        <Text style={[styles.heading, { color: theme.text }]}>Prohibited Uses</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          You may NOT:{'\n'}
          • Access HAC accounts that you do not own{'\n'}
          • Attempt to breach or circumvent HAC or app security{'\n'}
          • Submit false grade data to manipulate class averages{'\n'}
          • Use the app in violation of school or district policies{'\n'}
          • Distribute or sell the app without permission
        </Text>

        <Text style={[styles.heading, { color: theme.text }]}>Disclaimer of Warranties</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          THE APP IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND.{'\n\n'}
          We do NOT guarantee:{'\n'}
          • Accuracy of displayed grades (always verify on the official HAC website){'\n'}
          • Uninterrupted availability of the service{'\n'}
          • Compatibility with future HAC updates{'\n'}
          • Accuracy of class averages contributed by other users
        </Text>

        <Text style={[styles.heading, { color: theme.text }]}>Limitation of Liability</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, we are NOT liable for:{'\n'}
          • Incorrect grade information displayed{'\n'}
          • Unauthorized access to your device{'\n'}
          • Academic or disciplinary consequences{'\n'}
          • Data loss or security breaches on your device{'\n'}
          • Service interruptions due to HAC changes{'\n\n'}
          USE AT YOUR OWN RISK.
        </Text>

        <Text style={[styles.heading, { color: theme.text }]}>No Affiliation</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          This app is NOT:{'\n'}
          • Created by PowerSchool{'\n'}
          • Endorsed by St. Johns County Schools or any school district{'\n'}
          • An official school application{'\n'}
          • Supported by your school's IT department
        </Text>

        <Text style={[styles.heading, { color: theme.text }]}>Changes to These Terms</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          We may update these Terms from time to time. Continued use of the app after changes constitutes acceptance of the updated Terms. The "Last Updated" date at the top reflects the most recent revision.
        </Text>

        <Text style={[styles.acknowledgment, { color: theme.textSecondary }]}>
          BY USING THIS APP, YOU ACKNOWLEDGE:{'\n'}
          • You are at least 13 years old{'\n'}
          • You have read and understood these Terms{'\n'}
          • Grade Sharing is opt-in and uses only anonymous data{'\n'}
          • This is an unofficial third-party application{'\n'}
          • The developer is not responsible for HAC downtime or changes
        </Text>
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
  content: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  date: { fontSize: 13, fontStyle: 'italic', marginBottom: 20 },
  heading: { fontSize: 20, fontWeight: 'bold', marginTop: 24, marginBottom: 12 },
  subheading: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  paragraph: { fontSize: 14, lineHeight: 22, marginBottom: 12 },
  acknowledgment: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 24,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#E53935',
    fontWeight: '600',
  },
});
