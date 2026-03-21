import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { hacFetchAllPeriods, hacFetchTranscript, fetchStudentName, configureDistrict } from '../services/HACDirectClient';
import { GradeCacheService } from '../services/GradeCacheService';
import { DISTRICTS, DEFAULT_DISTRICT, DISTRICT_KEY } from '../config/districts';

const PREFETCHED_PERIOD_KEY = 'prefetched_current_period';
// Must match the keys in TranscriptScreen.tsx
const TRANSCRIPT_CACHE_KEY = 'transcript_cache_v2';
const TRANSCRIPT_CACHE_TIME_KEY = 'transcript_cache_time_v2';

// Instead of clicking the submit button (which causes a navigation that onLoadEnd
// may not re-fire for on same-URL 200 responses), we use fetch() from the WebView's
// JS context. WebKit handles cookies correctly for same-origin POSTs (unlike
// NSURLSession which has SameSite=Lax enforcement issues). We check response.url
// to determine success vs wrong credentials, then postMessage the result.
function makeAuthScript(username: string, password: string): string {
  const u = JSON.stringify(username);
  const p = JSON.stringify(password);
  return `
(function() {
  var uEl = document.querySelector('input[name="LogOnDetails.UserName"]');
  var pEl = document.querySelector('input[name="LogOnDetails.Password"]');
  if (!uEl || !pEl) {
    window.ReactNativeWebView.postMessage('no_form');
    return;
  }
  uEl.value = ${u};
  pEl.value = ${p};
  var db = document.querySelector('input[name="Database"]');
  if (db) db.value = '10';
  var form = document.querySelector('form');
  if (!form) {
    window.ReactNativeWebView.postMessage('no_form');
    return;
  }
  var fd = new FormData(form);
  var action = form.action || window.location.href;
  fetch(action, { method: 'POST', body: fd, credentials: 'include', redirect: 'follow' })
    .then(function(r) {
      var url = r.url || '';
      window.ReactNativeWebView.postMessage(
        url.toLowerCase().includes('/logon') ? 'wrong_credentials' : 'success'
      );
    })
    .catch(function() {
      window.ReactNativeWebView.postMessage('network_error');
    });
})();
true;
`;
}

// Fallback: if fetch() in the WebView never postMessages back within this time,
// treat as wrong credentials (covers network issues, unexpected page states, etc.)
const AUTH_TIMEOUT = 12000;

export default function AuthenticatingScreen({ navigation, route }: any) {
  // freshLogin = true when user explicitly typed credentials on LoginScreen.
  // In that case we must LogOff first to clear any stale WebView session.
  // For auto-login (return visit) we go straight to LogOn — saves 2 round trips.
  const freshLogin: boolean = route?.params?.freshLogin === true;
  const { theme } = useTheme();
  const { setAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();

  const [loginError, setLoginError] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_DISTRICT.baseUrl);

  const doneRef = useRef(false);
  const navigatedRef = useRef(false);
  const injectedRef = useRef(false);
  const authTimerRef = useRef<NodeJS.Timeout | null>(null);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    loadCredentials();
    return () => {
      if (authTimerRef.current) clearTimeout(authTimerRef.current);
    };
  }, []);

  const loadCredentials = async () => {
    const districtId = await AsyncStorage.getItem(DISTRICT_KEY);
    const district = DISTRICTS.find(d => d.id === districtId) ?? DEFAULT_DISTRICT;
    configureDistrict(district.baseUrl);
    setBaseUrl(district.baseUrl);
    const username = await SecureStore.getItemAsync('hac_username');
    const password = await SecureStore.getItemAsync('hac_password');
    if (!username || !password) {
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
      return;
    }
    setCredentials({ username, password });
  };

  // onLoadEnd fires on every navigation inside the hidden WebView.
  const handleLoadEnd = (syntheticEvent: any) => {
    if (doneRef.current) return;
    const { url } = syntheticEvent.nativeEvent;
    console.log('🌐 onLoadEnd:', url, '| injected:', injectedRef.current, '| fresh:', freshLogin);
    if (!url || url.length < 5) return;
    const lowerUrl = url.toLowerCase();

    // ── LogOff flow (freshLogin only) ───────────────────────────────────────
    if (lowerUrl.includes('/logoff')) {
      if (lowerUrl.includes('/logoffcomplete')) {
        webViewRef.current?.injectJavaScript(
          `window.location.href = '${baseUrl}/HomeAccess/Account/LogOn'; true;`
        );
      }
      return;
    }

    // ── Already authenticated (return visit, no freshLogin) ─────────────────
    // If HAC redirected us away from /logon without us doing anything, the
    // existing WebKit session is still valid → skip auth entirely.
    if (!freshLogin && !lowerUrl.includes('/logon') && !injectedRef.current) {
      console.log('✅ Existing session detected — skipping auth');
      handleSuccess();
      return;
    }

    // ── LogOn page loaded — inject auth script ──────────────────────────────
    if (!injectedRef.current && lowerUrl.includes('/logon')) {
      const creds = credentials;
      if (!creds) return;
      console.log('💉 Injecting auth fetch script');
      webViewRef.current?.injectJavaScript(makeAuthScript(creds.username, creds.password));
      injectedRef.current = true;
      authTimerRef.current = setTimeout(() => {
        console.warn('⏰ Auth timeout — treating as wrong credentials');
        handleWrongCredentials();
      }, AUTH_TIMEOUT);
    }
  };

  // onMessage: receives the result of the fetch() POST from within the WebView
  const handleMessage = (event: any) => {
    if (doneRef.current) return;
    const msg = event.nativeEvent.data;
    console.log('📨 WebView message:', msg);
    if (authTimerRef.current) clearTimeout(authTimerRef.current);

    if (msg === 'success') {
      handleSuccess();
    } else if (msg === 'wrong_credentials') {
      handleWrongCredentials();
    } else if (msg === 'network_error' || msg === 'no_form') {
      doneRef.current = true;
      setNetworkError(true);
    }
  };

  const handleSuccess = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    fetchStudentName().then(name => {
      if (name) AsyncStorage.setItem('student_first_name', name);
    }).catch(() => {});
    startFetching();
  };

  const handleWrongCredentials = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLoginError(true);
  };

  const doNavigateToMain = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    setAuthenticated(true);
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));
  };

  const startFetching = async () => {
    if (!freshLogin) {
      // ── Return visit ──────────────────────────────────────────────────────
      // Period key and grade cache are already set from the last session.
      // Navigate to Main immediately and refresh everything in the background.
      doNavigateToMain();

      hacFetchAllPeriods(async (periodIndex, data) => {
        if (data.grades.length > 0 && periodIndex > 0) {
          await GradeCacheService.saveGrades(data.grades, periodIndex);
          for (const [classId, assignments] of Object.entries(data.assignments)) {
            if (assignments.length > 0) {
              await GradeCacheService.saveAssignments(`${classId}_p${periodIndex}`, assignments);
            }
          }
          console.log(`💾 BG: cached period ${periodIndex}`);
          // Do NOT update PREFETCHED_PERIOD_KEY here — all periods fire in parallel
          // and the last one to complete would overwrite the correct current period.
          // The key was already set correctly during the fresh login.
        }
      }).catch(e => console.warn('BG fetch error:', e));

      hacFetchTranscript().then(async (transcriptData) => {
        if (transcriptData && transcriptData.groups.length > 0) {
          await AsyncStorage.setItem(TRANSCRIPT_CACHE_KEY, JSON.stringify(transcriptData));
          await AsyncStorage.setItem(TRANSCRIPT_CACHE_TIME_KEY, Date.now().toString());
        }
      }).catch(() => {});

      return;
    }

    // ── Fresh login ───────────────────────────────────────────────────────────
    // No grade cache yet — wait for the first period to come back so we can set
    // PREFETCHED_PERIOD_KEY before navigating (GradesScreen needs it on first load).
    let callbackCount = 0;
    let firstPeriodHadData = false;
    let navigatedToMain = false;
    let bestPeriod = 0;

    const fetchTimeout = setTimeout(doNavigateToMain, 25000);

    await hacFetchAllPeriods(async (periodIndex, data) => {
      callbackCount++;
      if (callbackCount === 1) firstPeriodHadData = data.grades.length > 0;

      if (data.grades.length > 0 && periodIndex > 0) {
        await GradeCacheService.saveGrades(data.grades, periodIndex);
        for (const [classId, assignments] of Object.entries(data.assignments)) {
          if (assignments.length > 0) {
            await GradeCacheService.saveAssignments(`${classId}_p${periodIndex}`, assignments);
          }
        }
        console.log(`💾 Auth: cached period ${periodIndex}`);
        if (periodIndex > bestPeriod) bestPeriod = periodIndex;

        if (firstPeriodHadData && !navigatedToMain) {
          navigatedToMain = true;
          await AsyncStorage.setItem(PREFETCHED_PERIOD_KEY, String(periodIndex));
          doNavigateToMain();
        }
      }
    }).catch(e => console.warn('hacFetchAllPeriods error:', e));

    clearTimeout(fetchTimeout);
    if (!navigatedToMain) {
      if (bestPeriod > 0) await AsyncStorage.setItem(PREFETCHED_PERIOD_KEY, String(bestPeriod));
      doNavigateToMain();
    }

    hacFetchTranscript().then(async (transcriptData) => {
      if (transcriptData && transcriptData.groups.length > 0) {
        await AsyncStorage.setItem(TRANSCRIPT_CACHE_KEY, JSON.stringify(transcriptData));
        await AsyncStorage.setItem(TRANSCRIPT_CACHE_TIME_KEY, Date.now().toString());
        console.log('💾 Auth: cached transcript');
      }
    }).catch(() => {});
  };

  const handleReenterCredentials = async () => {
    await SecureStore.deleteItemAsync('hac_username');
    await SecureStore.deleteItemAsync('hac_password');
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
  };

  const handleRetry = () => {
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
  };

  const innerStyle = {
    flex: 1,
    paddingTop: insets.top + 160,
    paddingHorizontal: 40,
    alignItems: 'center' as const,
  };

  if (loginError) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={innerStyle}>
          <Text style={styles.errorIcon}>🔒</Text>
          <Text style={[styles.errorTitle, { color: theme.text }]}>Authentication Failed</Text>
          <Text style={[styles.errorMessage, { color: theme.textSecondary }]}>
            Invalid username or password.{'\n'}Please re-enter your credentials.
          </Text>
          <TouchableOpacity
            style={[styles.errorButton, { backgroundColor: theme.primary }]}
            onPress={handleReenterCredentials}
            activeOpacity={0.7}>
            <Text style={styles.errorButtonText}>Re-enter Credentials</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (networkError) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={innerStyle}>
          <Text style={styles.errorIcon}>📡</Text>
          <Text style={[styles.errorTitle, { color: theme.text }]}>Connection Failed</Text>
          <Text style={[styles.errorMessage, { color: theme.textSecondary }]}>
            Could not connect to HAC.{'\n'}Check your network and try again.
          </Text>
          <TouchableOpacity
            style={[styles.errorButton, { backgroundColor: theme.primary }]}
            onPress={handleRetry}
            activeOpacity={0.7}>
            <Text style={styles.errorButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={innerStyle}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Signing in...</Text>
      </View>
      {credentials && (
        <WebView
          ref={webViewRef}
          source={{ uri: freshLogin
            ? `${baseUrl}/HomeAccess/Account/LogOff`
            : `${baseUrl}/HomeAccess/Account/LogOn` }}
          style={styles.hiddenWebView}
          onLoadEnd={handleLoadEnd}
          onMessage={handleMessage}
          sharedCookiesEnabled={true}
          javaScriptEnabled={true}
          userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingText: { marginTop: 15, fontSize: 16 },
  hiddenWebView: {
    position: 'absolute',
    top: -2000,
    left: 0,
    width: 375,
    height: 812,
    opacity: 0,
  },
  errorIcon: { fontSize: 64, marginBottom: 20 },
  errorTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  errorMessage: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  errorButton: { paddingHorizontal: 30, paddingVertical: 15, borderRadius: 10 },
  errorButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
