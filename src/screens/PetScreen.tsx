import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Switch,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Dimensions,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { checkAndUpdatePet, xpToNextLevel } from '../services/PetService';
import { supabase } from '../services/supabase';
import GradientHeader from '../components/GradientHeader';

const PET_SAD   = require('../../assets/tung_tung_sad.png');
const PET_HAPPY = require('../../assets/tung_tung_happy.png');
const HAPPY_TAP_THRESHOLD = 5;

const ANON_KEY        = 'pet_is_anonymous';
const SCREEN_NAME_KEY = 'pet_screen_name';
const CLICKS_KEY_PREFIX = 'pet_clicks_v1_';

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const HEART = '❤️';

type HeartParticle = {
  id: number;
  x: number;
  y: number;
  emoji: string;
  scale: Animated.Value;
  opacity: Animated.Value;
  translateY: Animated.Value;
  translateX: number;
};

type LeaderboardEntry = {
  username: string;
  level: number;
  clicks: number;
  is_anonymous: boolean;
  screen_name: string | null;
};

function displayName(entry: LeaderboardEntry, myUsername: string): string {
  if (entry.username === myUsername) return 'You';
  if (entry.is_anonymous || !entry.screen_name) return 'Anonymous';
  return entry.screen_name;
}

export default function PetScreen({ navigation }: any) {
  const { theme } = useTheme();

  const [displayLevel, setDisplayLevel]         = useState(0);
  const [leaderboard, setLeaderboard]           = useState<LeaderboardEntry[]>([]);
  const [clicksLeaderboard, setClicksLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myUsername, setMyUsername]             = useState('');
  const [myRank, setMyRank]                     = useState<number | null>(null);
  const [myClicksRank, setMyClicksRank]         = useState<number | null>(null);
  const [leaderboardTab, setLeaderboardTab]     = useState<'level' | 'clicks'>('level');
  const [showFull, setShowFull]                 = useState(false);
  const [fullLeaderboard, setFullLeaderboard]   = useState<LeaderboardEntry[]>([]);
  const [loadingFull, setLoadingFull]           = useState(false);

  const [isHappy, setIsHappy]           = useState(false);
  const sessionTaps                     = useRef(0);
  const [screenTab, setScreenTab]       = useState<'pet' | 'shop'>('pet');

  // Hearts
  const [particles, setParticles] = useState<HeartParticle[]>([]);
  const particleId   = useRef(0);
  const clicksRef      = useRef(0);
  const usernameRef    = useRef('');
  const lastSyncRef    = useRef(0);

  // Identity
  const [isAnonymous, setIsAnonymous]         = useState(true);
  const [screenName, setScreenName]           = useState('');
  const [screenNameInput, setScreenNameInput] = useState('');
  const [nameSaved, setNameSaved]             = useState(false);

  const sheetAnim   = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const petScale    = useRef(new Animated.Value(1)).current;
  const glowScale   = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.35)).current;
  const barAnim     = useRef(new Animated.Value(0)).current;
  const breathingRef = useRef<Animated.CompositeAnimation | null>(null);
  const glowRef      = useRef<Animated.CompositeAnimation | null>(null);
  const bounceRef    = useRef<Animated.CompositeAnimation | null>(null);

  const startBreathing = () => {
    breathingRef.current?.stop();
    glowRef.current?.stop();
    breathingRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(petScale, { toValue: 1.06, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(petScale, { toValue: 1.0,  duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    glowRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.6,  duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.25, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    breathingRef.current.start();
    glowRef.current.start();
  };

  const bouncePet = () => {
    breathingRef.current?.stop();
    glowRef.current?.stop();
    bounceRef.current?.stop();

    // Snap to launch scale instantly so spam taps always feel responsive
    petScale.setValue(1.38);

    bounceRef.current = Animated.spring(petScale, {
      toValue: 1.0,
      friction: 4,
      tension: 220,
      useNativeDriver: true,
    });
    bounceRef.current.start(({ finished }) => {
      if (finished) { bounceRef.current = null; startBreathing(); }
    });

    Animated.sequence([
      Animated.timing(glowScale, { toValue: 1.5, duration: 120, useNativeDriver: true }),
      Animated.timing(glowScale, { toValue: 1.0, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const handlePetTap = (evt: any) => {
    const { pageX, pageY } = evt.nativeEvent;
    const count = 1;

    // Session tap counter — switch to happy after threshold
    sessionTaps.current += 1;
    if (!isHappy && sessionTaps.current >= HAPPY_TAP_THRESHOLD) {
      setIsHappy(true);
    }

    // Increment click count
    clicksRef.current += 1;
    const newClicks = clicksRef.current;
    const uname = usernameRef.current;
    if (uname) {
      AsyncStorage.setItem(`${CLICKS_KEY_PREFIX}${uname}`, String(newClicks));
      // Sync to Supabase every 10 taps to avoid hammering the DB
      // Update local leaderboard state immediately
      const updateList = (list: LeaderboardEntry[]) =>
        list.map(e => e.username === uname ? { ...e, clicks: newClicks } : e)
            .sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0));
      setClicksLeaderboard(prev => updateList(prev));
      setFullLeaderboard(prev => prev.length > 0 ? updateList(prev) : prev);

      const now = Date.now();
      if (now - lastSyncRef.current >= 150) {
        lastSyncRef.current = now;
        supabase.from('pet_leaderboard')
          .update({ clicks: newClicks })
          .eq('username', uname)
          .then(() => {});
      }
    }

    const newParticles: HeartParticle[] = Array.from({ length: count }, () => ({
      id: particleId.current++,
      x: pageX,
      y: pageY,
      emoji: HEART,
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(0),
      translateX: (Math.random() - 0.5) * 60,
    }));

    setParticles(prev => [...prev, ...newParticles]);

    newParticles.forEach((p) => {
      const floatDist = 80 + Math.random() * 40;
      Animated.parallel([
        // Pop in then shrink slightly
        Animated.sequence([
          Animated.timing(p.scale, { toValue: 1.3, duration: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(p.scale, { toValue: 1.0, duration: 100, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ]),
        // Fade in → hold → fade out
        Animated.sequence([
          Animated.timing(p.opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.delay(400),
          Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
        // Smooth float up
        Animated.timing(p.translateY, {
          toValue: -floatDist,
          duration: 880,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => setParticles(prev => prev.filter(h => h.id !== p.id)));
    });

    bouncePet();
  };

  const animateBarTo = (fraction: number, duration: number): Promise<void> =>
    new Promise(resolve =>
      Animated.timing(barAnim, {
        toValue: fraction,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start(() => resolve()),
    );

  const runAnimation = async (
    oldLevel: number, oldXP: number,
    newLevel: number, newXP: number,
    levelsGained: number,
  ) => {
    let curLevel = oldLevel, curXP = oldXP;
    for (let i = 0; i < levelsGained; i++) {
      const needed = xpToNextLevel(curLevel);
      const fillDuration = Math.max(300, Math.min(800, ((needed - curXP) / needed) * 800));
      barAnim.setValue(curXP / needed);
      await animateBarTo(1, fillDuration);
      await delay(150);
      bouncePet();
      curLevel++;
      curXP = 0;
      setDisplayLevel(curLevel);
      barAnim.setValue(0);
      await delay(350);
    }
    const finalFraction = newXP / xpToNextLevel(newLevel);
    if (finalFraction > 0) await animateBarTo(finalFraction, 500);
  };

  const syncLeaderboard = async (
    username: string,
    level: number,
    anon: boolean,
    name: string,
    clicks?: number,
  ) => {
    // Upsert — don't let a failure block the leaderboard fetch
    try {
      const payload: Record<string, any> = {
        username,
        level,
        is_anonymous: anon,
        screen_name: name || null,
        updated_at: new Date().toISOString(),
      };
      if (clicks !== undefined) payload.clicks = clicks;
      const { error } = await supabase.from('pet_leaderboard').upsert(
        payload,
        { onConflict: 'username' },
      );
      if (error) console.warn('Pet leaderboard upsert error:', error.message);
    } catch (e) {
      console.warn('Pet leaderboard upsert exception:', e);
    }

    // Fetch top 5 by level
    try {
      const { data: top5, error } = await supabase
        .from('pet_leaderboard')
        .select('username, level, clicks, is_anonymous, screen_name')
        .order('level', { ascending: false })
        .limit(5);

      if (error) { console.warn('Pet leaderboard fetch error:', error.message); }
      else if (top5) {
        setLeaderboard(top5);
        const inTop5 = top5.some(e => e.username === username);
        if (!inTop5) {
          const { count } = await supabase
            .from('pet_leaderboard')
            .select('*', { count: 'exact', head: true })
            .gt('level', level);
          setMyRank((count ?? 0) + 1);
        } else {
          setMyRank(null);
        }
      }
    } catch (e) {
      console.warn('Pet leaderboard fetch exception:', e);
    }

    // Fetch top 5 by clicks
    try {
      const myClicks = clicks ?? 0;
      const { data: top5clicks, error } = await supabase
        .from('pet_leaderboard')
        .select('username, level, clicks, is_anonymous, screen_name')
        .order('clicks', { ascending: false })
        .limit(5);

      if (error) { console.warn('Pet clicks leaderboard fetch error:', error.message); }
      else if (top5clicks) {
        setClicksLeaderboard(top5clicks);
        const inTop5 = top5clicks.some(e => e.username === username);
        if (!inTop5) {
          const { count } = await supabase
            .from('pet_leaderboard')
            .select('*', { count: 'exact', head: true })
            .gt('clicks', myClicks);
          setMyClicksRank((count ?? 0) + 1);
        } else {
          setMyClicksRank(null);
        }
      }
    } catch (e) {
      console.warn('Pet clicks leaderboard fetch exception:', e);
    }
  };

  const openFullLeaderboard = async (tab: 'level' | 'clicks') => {
    setLoadingFull(true);
    setShowFull(true);
    sheetAnim.setValue(SCREEN_HEIGHT);
    Animated.spring(sheetAnim, {
      toValue: 0,
      damping: 28,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
    try {
      const { data, error } = await supabase
        .from('pet_leaderboard')
        .select('username, level, clicks, is_anonymous, screen_name')
        .order(tab, { ascending: false });
      if (!error && data) setFullLeaderboard(data);
    } catch (e) {
      console.warn('Full leaderboard fetch exception:', e);
    }
    setLoadingFull(false);
  };

  const closeFullLeaderboard = () => {
    Animated.timing(sheetAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setShowFull(false));
  };

  // Persist identity change and re-sync
  const applyIdentity = async (anon: boolean, name: string, username: string, level: number) => {
    await Promise.all([
      AsyncStorage.setItem(ANON_KEY, anon ? '1' : '0'),
      AsyncStorage.setItem(SCREEN_NAME_KEY, name),
    ]);
    syncLeaderboard(username, level, anon, name);
  };

  const toggleAnonymous = () => {
    const next = !isAnonymous;
    setIsAnonymous(next);
    applyIdentity(next, screenName, myUsername, displayLevel);
  };

  const saveName = () => {
    const trimmed = screenNameInput.trim();
    setScreenName(trimmed);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 1500);
    applyIdentity(false, trimmed, myUsername, displayLevel);
  };

  useEffect(() => {
    (async () => {
      const username = (await SecureStore.getItemAsync('hac_username')) ?? '';
      setMyUsername(username);
      usernameRef.current = username;

      // Load stored identity + clicks
      const [anonStr, storedName, clicksStr] = await Promise.all([
        AsyncStorage.getItem(ANON_KEY),
        AsyncStorage.getItem(SCREEN_NAME_KEY),
        AsyncStorage.getItem(`${CLICKS_KEY_PREFIX}${username}`),
      ]);
      clicksRef.current = clicksStr ? parseInt(clicksStr, 10) : 0;
      const anon = anonStr !== '0'; // default anonymous
      const name = storedName ?? '';
      setIsAnonymous(anon);
      setScreenName(name);
      setScreenNameInput(name);
      setNameSaved(false);

      // Admin override: if Supabase level differs from local, Supabase wins
      try {
        const { data } = await supabase
          .from('pet_leaderboard')
          .select('level')
          .eq('username', username)
          .single();
        if (data) {
          const localLevelStr = await AsyncStorage.getItem(`pet_level_v4_${username}`);
          const localLevel = localLevelStr !== null ? parseInt(localLevelStr, 10) : null;
          if (localLevel !== null && data.level !== localLevel) {
            await AsyncStorage.setItem(`pet_level_v4_${username}`, String(data.level));
            await AsyncStorage.setItem(`pet_xp_v4_${username}`, '0');
          }
        }
      } catch {}

      const result = await checkAndUpdatePet();
      setDisplayLevel(result.oldLevel);

      if (result.levelsGained > 0 || result.gainedXP > 0) {
        barAnim.setValue(result.oldXP / xpToNextLevel(result.oldLevel));
        await runAnimation(result.oldLevel, result.oldXP, result.newLevel, result.newXP, result.levelsGained);
        if (result.levelsGained === 0) bouncePet();
        startBreathing();
        syncLeaderboard(username, result.newLevel, anon, name, clicksRef.current);
      } else {
        setDisplayLevel(result.newLevel);
        barAnim.setValue(result.newXP / xpToNextLevel(result.newLevel));
        startBreathing();
        syncLeaderboard(username, result.newLevel, anon, name, clicksRef.current);
      }
    })();

    return () => {
      breathingRef.current?.stop();
      glowRef.current?.stop();
      // Flush remaining clicks on unmount
      const uname = usernameRef.current;
      if (uname && clicksRef.current > 0) {
        supabase.from('pet_leaderboard')
          .update({ clicks: clicksRef.current })
          .eq('username', uname)
          .then(() => {});
      }
    };
  }, []);

  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <GradientHeader style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color={theme.headerText} />
            <Text style={[styles.backButtonText, { color: theme.headerText }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.headerText }]}>My Pet</Text>

          <View style={styles.screenTabRow}>
            {(['pet', 'shop'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.screenTab, screenTab === tab && styles.screenTabActive]}
                onPress={() => setScreenTab(tab)}>
                <Text style={[styles.screenTabText, screenTab === tab && styles.screenTabTextActive]}>
                  {tab === 'pet' ? 'Pet' : 'Shop'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </GradientHeader>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {screenTab === 'shop' ? (
            <View style={styles.comingSoonContainer}>
              <Text style={styles.comingSoonEmoji}>🛍️</Text>
              <Text style={[styles.comingSoonTitle, { color: theme.text }]}>Shop</Text>
              <Text style={[styles.comingSoonText, { color: theme.textSecondary }]}>
                Coming soon — spend your taps on skins for your pet.
              </Text>
              <Text style={[styles.comingSoonBalance, { color: theme.primary }]}>
                🪙 {Math.floor(clicksRef.current / 100).toLocaleString()} coins
              </Text>
            </View>
          ) : null}
          {screenTab === 'pet' ? (<>
          {/* Pet */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={handlePetTap}
            style={styles.petArea}>
            <Animated.View
              style={[
                styles.glow,
                {
                  backgroundColor: theme.primary + '30',
                  borderColor: theme.primary + '60',
                  transform: [{ scale: glowScale }],
                  opacity: glowOpacity,
                },
              ]}
            />
            <Animated.View style={{ transform: [{ scale: petScale }] }}>
              <Image source={isHappy ? PET_HAPPY : PET_SAD} style={styles.petImage} resizeMode="contain" />
            </Animated.View>
          </TouchableOpacity>

          <Text style={[styles.levelText, { color: theme.text }]}>{displayLevel}</Text>

          <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
            <Animated.View style={[styles.progressFill, { backgroundColor: theme.primary, width: barWidth }]} />
          </View>

          {/* Identity card */}
          <View style={[styles.identityCard, { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: theme.cardBorderWidth }]}>
            <View style={styles.identityRow}>
              <View style={styles.identityLeft}>
                <Text style={[styles.identityLabel, { color: theme.text }]}>Show on leaderboard</Text>
                <Text style={[styles.identityStatus, { color: theme.textSecondary }]}>
                  {isAnonymous ? 'You appear as Anonymous' : 'Visible with a screen name'}
                </Text>
              </View>
              <Switch
                value={!isAnonymous}
                onValueChange={v => { setIsAnonymous(!v); applyIdentity(!v, screenName, myUsername, displayLevel); }}
                trackColor={{ false: '#767577', true: theme.primary }}
                thumbColor="#fff"
              />
            </View>

            {!isAnonymous && (
              <View style={styles.nameSection}>
                <View style={[styles.nameInputRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Ionicons name="person-outline" size={16} color={theme.textSecondary as string} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.nameInput, { color: theme.text, flex: 1 }]}
                    value={screenNameInput}
                    onChangeText={txt => { setScreenNameInput(txt); setNameSaved(false); }}
                    placeholder="Enter screen name"
                    placeholderTextColor={theme.textSecondary as string}
                    maxLength={20}
                    returnKeyType="done"
                    onSubmitEditing={saveName}
                  />
                  {screenNameInput.trim().length > 0 && (
                    <TouchableOpacity
                      style={[styles.saveBtn, { backgroundColor: nameSaved ? '#4CAF50' : theme.primary }]}
                      onPress={saveName}>
                      <Text style={styles.saveBtnText}>{nameSaved ? '✓' : 'Save'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {screenName ? (
                  <Text style={[styles.nameHint, { color: theme.textSecondary }]}>
                    Showing as "{screenName}" on the leaderboard
                  </Text>
                ) : (
                  <Text style={[styles.nameHint, { color: theme.textSecondary }]}>
                    Set a name so others can recognize you
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Leaderboard */}
          {(leaderboard.length > 0 || clicksLeaderboard.length > 0) && (() => {
            const isLevel = leaderboardTab === 'level';
            const activeList = showFull ? fullLeaderboard : (isLevel ? leaderboard : clicksLeaderboard);
            const activeRank = isLevel ? myRank : myClicksRank;
            return (
              <View style={styles.leaderboardSection}>
                {/* Tab switcher */}
                <View style={[styles.tabRow, { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: theme.cardBorderWidth }]}>
                  {(['level', 'clicks'] as const).map(tab => (
                    <TouchableOpacity
                      key={tab}
                      style={[
                        styles.tab,
                        leaderboardTab === tab && { backgroundColor: theme.primary },
                      ]}
                      onPress={() => { setLeaderboardTab(tab); setShowFull(false); }}>
                      <Text style={[
                        styles.tabText,
                        { color: leaderboardTab === tab ? '#fff' : theme.textSecondary },
                      ]}>
                        {tab === 'level' ? 'Levels' : 'Taps'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {activeList.map((entry, i) => {
                  const isMe = entry.username === myUsername;
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                  const statLabel = isLevel ? `Lv. ${entry.level}` : `${(entry.clicks ?? 0).toLocaleString()} taps`;
                  return (
                    <View
                      key={entry.username}
                      style={[
                        styles.leaderboardRow,
                        {
                          backgroundColor: isMe ? theme.primary + '18' : theme.cardBackground,
                          borderColor: isMe ? theme.primary + '60' : theme.border,
                          borderWidth: theme.cardBorderWidth,
                        },
                      ]}>
                      <Text style={[styles.rankText, { color: theme.textSecondary }]}>
                        {medal ?? `#${i + 1}`}
                      </Text>
                      <Text style={[styles.usernameText, { color: isMe ? theme.primary : theme.text }]} numberOfLines={1}>
                        {displayName(entry, myUsername)}
                      </Text>
                      <Text style={[styles.entryLevel, { color: theme.text }]}>{statLabel}</Text>
                    </View>
                  );
                })}

                <TouchableOpacity
                  style={[styles.fullLeaderboardBtn, { borderColor: theme.border }]}
                  onPress={() => openFullLeaderboard(leaderboardTab)}>
                  <Text style={[styles.fullLeaderboardBtnText, { color: theme.primary }]}>
                    See full leaderboard →
                  </Text>
                </TouchableOpacity>

                {activeRank !== null && (
                  <>
                    <View style={styles.rankSeparator}>
                      <View style={[styles.rankSeparatorLine, { backgroundColor: theme.border }]} />
                      <Text style={[styles.rankSeparatorText, { color: theme.textSecondary }]}>your rank</Text>
                      <View style={[styles.rankSeparatorLine, { backgroundColor: theme.border }]} />
                    </View>
                    <View
                      style={[
                        styles.leaderboardRow,
                        {
                          backgroundColor: theme.primary + '18',
                          borderColor: theme.primary + '60',
                          borderWidth: theme.cardBorderWidth,
                        },
                      ]}>
                      <Text style={[styles.rankText, { color: theme.textSecondary }]}>#{activeRank}</Text>
                      <Text style={[styles.usernameText, { color: theme.primary }]}>You</Text>
                      <Text style={[styles.entryLevel, { color: theme.text }]}>
                        {isLevel ? `Lv. ${displayLevel}` : `${clicksRef.current.toLocaleString()} taps`}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            );
          })()}
          </>) : null}
        </ScrollView>

        {/* Heart particles — rendered above everything, pointer-events none */}
        {particles.map(p => (
          <Animated.Text
            key={p.id}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: p.x - 14,
              top: p.y - 14,
              fontSize: 26,
              opacity: p.opacity,
              transform: [
                { scale: p.scale },
                { translateY: p.translateY },
                { translateX: p.translateX },
              ],
            }}>
            {p.emoji}
          </Animated.Text>
        ))}
      </View>

      {/* Full leaderboard modal sheet */}
      <Modal
        visible={showFull}
        transparent
        animationType="none"
        onRequestClose={closeFullLeaderboard}>
        {/* Backdrop */}
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={closeFullLeaderboard}
        />

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: theme.cardBackground, transform: [{ translateY: sheetAnim }] },
          ]}>
          {/* Handle */}
          <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>
              {leaderboardTab === 'level' ? 'Level Leaderboard' : 'Tap Leaderboard'}
            </Text>
            <TouchableOpacity onPress={closeFullLeaderboard} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={theme.textSecondary as string} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.sheetList} showsVerticalScrollIndicator={false}>
            {loadingFull ? (
              <Text style={[styles.sheetLoading, { color: theme.textSecondary }]}>Loading...</Text>
            ) : fullLeaderboard.map((entry, i) => {
              const isMe = entry.username === myUsername;
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
              const statLabel = leaderboardTab === 'level'
                ? `Lv. ${entry.level}`
                : `${(entry.clicks ?? 0).toLocaleString()} taps`;
              return (
                <View
                  key={entry.username}
                  style={[
                    styles.leaderboardRow,
                    {
                      backgroundColor: isMe ? theme.primary + '18' : theme.background,
                      borderColor: isMe ? theme.primary + '60' : theme.border,
                      borderWidth: theme.cardBorderWidth,
                    },
                  ]}>
                  <Text style={[styles.rankText, { color: theme.textSecondary }]}>
                    {medal ?? `#${i + 1}`}
                  </Text>
                  <Text style={[styles.usernameText, { color: isMe ? theme.primary : theme.text }]} numberOfLines={1}>
                    {displayName(entry, myUsername)}
                  </Text>
                  <Text style={[styles.entryLevel, { color: theme.text }]}>{statLabel}</Text>
                </View>
              );
            })}
          </ScrollView>
        </Animated.View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backButton:     { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  backButtonText: { fontSize: 16, fontWeight: '600' },
  headerTitle:    { fontSize: 22, fontWeight: 'bold', fontFamily: 'Inter_700Bold' },

  screenTabRow: {
    flexDirection: 'row',
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 3,
  },
  screenTab: {
    flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center',
  },
  screenTabActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  screenTabText: {
    fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.75)',
  },
  screenTabTextActive: {
    color: '#333',
  },

  comingSoonContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 80, paddingHorizontal: 32,
  },
  comingSoonEmoji: { fontSize: 48, marginBottom: 16 },
  comingSoonTitle: { fontSize: 22, fontWeight: '800', fontFamily: 'Inter_700Bold', marginBottom: 8 },
  comingSoonText: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  comingSoonBalance: { fontSize: 16, fontWeight: '700' },

  body: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  petArea: {
    width: 200, height: 200,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 32,
  },
  glow: {
    position: 'absolute',
    width: 200, height: 200,
    borderRadius: 100, borderWidth: 2,
  },
  petImage: { width: 160, height: 160, marginLeft: -16 },

  levelText: {
    fontSize: 48, fontWeight: '800',
    fontFamily: 'Inter_700Bold', marginBottom: 20,
  },

  progressTrack: {
    width: '100%', height: 8,
    borderRadius: 4, overflow: 'hidden', marginBottom: 20,
  },
  progressFill: { height: '100%', borderRadius: 4 },

  // Identity card
  identityCard: {
    width: '100%', borderRadius: 14,
    padding: 14, marginBottom: 28,
  },
  identityRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 12,
  },
  identityLeft: { flex: 1 },
  identityLabel: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  identityStatus: { fontSize: 12 },
  nameSection: { marginTop: 14 },
  nameInputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  nameInput: {
    fontSize: 15, paddingVertical: 8,
  },
  saveBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 7, marginLeft: 6,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  nameHint: { fontSize: 12, marginTop: 7, marginLeft: 2 },

  // Leaderboard
  leaderboardSection: { width: '100%' },
  tabRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  leaderboardRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, marginBottom: 8,
  },
  rankText:     { fontSize: 16, width: 36 },
  usernameText: { flex: 1, fontSize: 14, fontWeight: '500' },
  entryLevel:   { fontSize: 14, fontWeight: '700' },

  fullLeaderboardBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 4,
    borderTopWidth: 1,
    marginTop: 2,
  },
  fullLeaderboardBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Modal sheet
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.88,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 20,
  },
  sheetHandle: {
    width: 40, height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18, fontWeight: '700', fontFamily: 'Inter_700Bold',
  },
  sheetList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sheetLoading: {
    textAlign: 'center', marginTop: 40, fontSize: 14,
  },

  rankSeparator: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 8, gap: 8,
  },
  rankSeparatorLine: { flex: 1, height: 1 },
  rankSeparatorText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
});
