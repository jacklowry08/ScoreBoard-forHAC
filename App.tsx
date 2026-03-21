import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import BiometricGate from './src/components/BiometricGate';
import AuthGate from './src/components/AuthGate';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import GradesScreen from './src/screens/GradesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SecurityScreen from './src/screens/SecurityScreen';
import GradeSharingScreen from './src/screens/GradeSharingScreen';
import AppearanceScreen from './src/screens/AppearanceScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from './src/screens/TermsOfServiceScreen';
import AssignmentsScreen from './src/screens/AssignmentsScreen';
import TranscriptScreen from './src/screens/TranscriptScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import PlannerScreen from './src/screens/PlannerScreen';
import GPACalculatorScreen from './src/screens/GPACalculatorScreen';
import GradeCalculatorScreen from './src/screens/GradeCalculatorScreen';
import AuthenticatingScreen from './src/screens/AuthenticatingScreen';
import { useAuth } from './src/context/AuthContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <AuthGate>
      <Tab.Navigator
        initialRouteName="HomeTab"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: isDark ? '#888' : '#999',
          tabBarStyle: {
            paddingBottom: insets.bottom + 6,
            paddingTop: 10,
            height: 58 + insets.bottom,
            backgroundColor: theme.cardBackground,
            borderTopColor: theme.border,
          },
          tabBarShowLabel: false,
        }}>
        <Tab.Screen
          name="HomeTab"
          component={HomeScreen}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={27} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="GradesTab"
          component={GradesScreen}
          options={{
            tabBarLabel: 'Grades',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={27} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="AttendanceTab"
          component={AttendanceScreen}
          options={{
            tabBarLabel: 'Attendance',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={27} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="PlannerTab"
          component={PlannerScreen}
          options={{
            tabBarLabel: 'Planner',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'journal' : 'journal-outline'} size={27} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="TranscriptTab"
          component={TranscriptScreen}
          options={{
            tabBarLabel: 'Transcript',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'school' : 'school-outline'} size={27} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="SettingsTab"
          component={SettingsScreen}
          options={{
            tabBarLabel: 'Settings',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'settings' : 'settings-outline'} size={27} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </AuthGate>
  );
}

function Navigation() {
  const { isLoading, hasCredentials } = useAuth();
  const { theme } = useTheme();

  return (
    <BiometricGate>
      {isLoading ? (
        <View style={{ flex: 1 }} />
      ) : (
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}
            initialRouteName={hasCredentials ? 'Authenticating' : 'Login'}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Authenticating" component={AuthenticatingScreen} />
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="GradeSharing" component={GradeSharingScreen} />
            <Stack.Screen name="Security" component={SecurityScreen} />
            <Stack.Screen name="Appearance" component={AppearanceScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
            <Stack.Screen name="Assignments" component={AssignmentsScreen} />
            <Stack.Screen name="GPACalculator" component={GPACalculatorScreen} />
            <Stack.Screen name="GradeCalculator" component={GradeCalculatorScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </BiometricGate>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Navigation />
      </AuthProvider>
    </ThemeProvider>
  );
}
