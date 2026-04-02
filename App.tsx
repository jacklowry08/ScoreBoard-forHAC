import React from 'react';
import { View } from 'react-native';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
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
import PlannerScreen from './src/screens/PlannerScreen';
import GPACalculatorScreen from './src/screens/GPACalculatorScreen';
import GradeCalculatorScreen from './src/screens/GradeCalculatorScreen';
import PetScreen from './src/screens/PetScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import AuthenticatingScreen from './src/screens/AuthenticatingScreen';
import { useAuth } from './src/context/AuthContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const tabPillStyle = {
  width: 52,
  height: 36,
  borderRadius: 18,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

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
            borderTopWidth: theme.cardBorderWidth,
          },
          tabBarShowLabel: false,
        }}>
        {[
          { name: 'HomeTab',       component: HomeScreen,       icon: 'home',        label: 'Home' },
          { name: 'GradesTab',     component: GradesScreen,     icon: 'stats-chart', label: 'Grades' },
          { name: 'PlannerTab',    component: PlannerScreen,    icon: 'journal',     label: 'Planner' },
          { name: 'TranscriptTab', component: TranscriptScreen, icon: 'school',      label: 'Transcript' },
          { name: 'SettingsTab',   component: SettingsScreen,   icon: 'settings',    label: 'Settings' },
        ].map(({ name, component, icon, label }) => (
          <Tab.Screen
            key={name}
            name={name}
            component={component}
            options={{
              tabBarLabel: label,
              tabBarIcon: ({ color, focused }) => (
                <View style={[
                  tabPillStyle,
                  focused && { backgroundColor: theme.primary + '20' },
                ]}>
                  <Ionicons
                    name={focused ? icon as any : `${icon}-outline` as any}
                    size={31}
                    color={color}
                  />
                </View>
              ),
            }}
          />
        ))}
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
            <Stack.Screen name="Pet" component={PetScreen} />
            <Stack.Screen name="Schedule" component={ScheduleScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </BiometricGate>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) return <View style={{ flex: 1 }} />;

  return (
    <ThemeProvider>
      <AuthProvider>
        <Navigation />
      </AuthProvider>
    </ThemeProvider>
  );
}
