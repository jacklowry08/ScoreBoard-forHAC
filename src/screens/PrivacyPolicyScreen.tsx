import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';

export default function PrivacyPolicyScreen({ navigation }: any) {
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
        <Text style={[styles.title, { color: theme.headerText }]}>Privacy Policy</Text>
      </GradientHeader>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.date, { color: theme.textSecondary }]}>Last Updated: March 4, 2026</Text>

        <Text style={[styles.heading, { color: theme.text }]}>Introduction</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          ScoreBoard ("we", "our", or "the app") is a grade tracking application for students. This Privacy Policy explains what information we collect, how we use it, and your choices.
        </Text>

        <Text style={[styles.heading, { color: theme.text }]}>Information We Collect</Text>

        <Text style={[styles.subheading, { color: theme.text }]}>Stored Locally on Your Device</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          • HAC credentials (username and password) — encrypted using iOS Keychain / Android Keystore{'\n'}
          • Biometric authentication preference — never leaves your device{'\n'}
          • Age confirmation — stored locally to avoid re-prompting{'\n'}
          • Cached grade data — temporarily stored for offline viewing
        </Text>

        <Text style={[styles.subheading, { color: theme.text }]}>Collected When Grade Sharing Is Enabled (Opt-In Only)</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          If you choose to enable Grade Sharing, the following is submitted to our database:{'\n\n'}
          • Course codes and class names{'\n'}
          • Your grade percentage per class{'\n'}
          • An anonymous device fingerprint (see below){'\n'}
          • A school identifier (e.g. "pvhs_sjc"){'\n\n'}
          Grade Sharing is disabled by default. No grade data is uploaded unless you explicitly enable it.
        </Text>

        <Text style={[styles.subheading, { color: theme.text }]}>Anonymous Device Fingerprint</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          To prevent duplicate submissions, we generate an anonymous device fingerprint from non-personal device attributes (platform, device model, OS version, app version). This fingerprint:{'\n'}
          • Does NOT include your name, username, email, or any identifying information{'\n'}
          • Cannot be used to identify you as an individual{'\n'}
          • Is used solely to associate your submissions so old data can be replaced on refresh
        </Text>

        <Text style={[styles.heading, { color: theme.text }]}>Information We Do NOT Collect</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          • Your HAC username or password are never transmitted to our servers{'\n'}
          • We do not collect your name, email, or contact information{'\n'}
          • We do not track your location{'\n'}
          • We do not run analytics or ad tracking{'\n'}
          • We do not share your information with third parties for marketing
        </Text>

        <Text style={[styles.heading, { color: theme.text }]}>How We Use Your Information</Text>

        <Text style={[styles.subheading, { color: theme.text }]}>HAC Credentials</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          Stored exclusively on your device. Used only to log into HAC on your behalf via a hidden browser session. We cannot access them.
        </Text>

        <Text style={[styles.subheading, { color: theme.text }]}>Grade Sharing Data</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          When enabled, submitted grade percentages are aggregated to compute class averages. Averages are only displayed when at least 10 students have contributed data, to protect individual privacy. This data is hosted on Supabase.
        </Text>

        <Text style={[styles.heading, { color: theme.text }]}>Data Retention & Deletion</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          • Local data: deleted when you log out or uninstall the app{'\n'}
          • Grade sharing data: deleted from our database immediately when you disable Grade Sharing{'\n'}
          • You can opt out and delete your submitted data at any time in Settings → Grade Sharing
        </Text>

        <Text style={[styles.heading, { color: theme.text }]}>Children's Privacy (COPPA)</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          This app requires users to be at least 13 years old. We do not knowingly collect personal information from children under 13. If you are a parent and believe your child has used this app without consent, please contact us so we can remove any associated data.{'\n\n'}
          Because Grade Sharing is opt-in and uses only anonymous identifiers, no personal data about children is collected or transmitted.
        </Text>

        <Text style={[styles.heading, { color: theme.text }]}>Third-Party Services</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          • Home Access Center (HAC): Your credentials are sent directly from your device to HAC servers operated by PowerSchool / St. Johns County Schools. See their privacy policy for details.{'\n'}
          • Supabase: Grade sharing data is stored on Supabase, a secure cloud database. No personal information is stored there.
        </Text>

        <Text style={[styles.heading, { color: theme.text }]}>Security</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          • Credentials are encrypted using iOS Keychain / Android Keystore{'\n'}
          • Optional biometric lock prevents unauthorized access{'\n'}
          • All network communication uses HTTPS{'\n'}
          • Grade sharing data contains no personally identifiable information
        </Text>

        <Text style={[styles.heading, { color: theme.text }]}>Disclaimer</Text>
        <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
          ScoreBoard is NOT affiliated with, endorsed by, or connected to PowerSchool or St. Johns County Schools.
        </Text>

        <Text style={[styles.acknowledgment, { color: theme.textSecondary }]}>
          YOU ACKNOWLEDGE THAT:{'\n'}
          • HAC credentials are stored on your device only{'\n'}
          • Grade sharing is opt-in and uses anonymous identifiers{'\n'}
          • You are responsible for the security of your device{'\n'}
          • This is an unofficial third-party app
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
    borderLeftColor: '#FF9800',
    fontWeight: '600',
  },
});
