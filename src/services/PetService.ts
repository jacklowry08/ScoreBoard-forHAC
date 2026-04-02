import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

async function petKeys() {
  const username = (await SecureStore.getItemAsync('hac_username')) ?? 'default';
  return {
    username,
    level:     `pet_level_v4_${username}`,
    xp:        `pet_xp_v4_${username}`,
    formative: `pet_counted_formative_v4_${username}`,
    summative: `pet_counted_summative_v4_${username}`,
  };
}

export const FORMATIVE_XP = 50;
export const SUMMATIVE_XP = 150;

/** XP required to go from level N to N+1 */
export function xpToNextLevel(level: number): number {
  return 100 + level * 50;
}

async function countAssignmentsByCategory(): Promise<{ formative: number; summative: number }> {
  const keys = await AsyncStorage.getAllKeys();
  const assignmentKeys = keys.filter(k => k.startsWith('assignments_cache_'));
  const seen = new Set<string>();
  let formative = 0, summative = 0;

  for (const key of assignmentKeys) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      const assignments = JSON.parse(raw);
      const classId = key.replace('assignments_cache_', '').replace(/_p\d+$/, '');

      for (const a of assignments) {
        const rawScore = (a.score || '').toLowerCase().trim();
        if (!rawScore || rawScore === 'n/a') continue;
        if (!a.points || a.points === 'N/A') continue;
        const dedupKey = a.name;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);
        const cat = (a.category || '').toLowerCase();
        if (cat.includes('summative')) summative++;
        else formative++;
      }
    } catch {}
  }
  return { formative, summative };
}

function applyXP(
  level: number,
  xp: number,
  gained: number,
): { level: number; xp: number; levelsGained: number } {
  let l = level, x = xp + gained, levelsGained = 0;
  while (x >= xpToNextLevel(l)) {
    x -= xpToNextLevel(l);
    l++;
    levelsGained++;
  }
  return { level: l, xp: x, levelsGained };
}

export interface PetUpdateResult {
  oldLevel: number;
  oldXP: number;
  newLevel: number;
  newXP: number;
  levelsGained: number;
  gainedXP: number;
}

export async function checkAndUpdatePet(): Promise<PetUpdateResult> {
  const counts = await countAssignmentsByCategory();

  const keys = await petKeys();
  const [levelStr, xpStr, formativeStr, summativeStr] = await Promise.all([
    AsyncStorage.getItem(keys.level),
    AsyncStorage.getItem(keys.xp),
    AsyncStorage.getItem(keys.formative),
    AsyncStorage.getItem(keys.summative),
  ]);

  // First run for v4 keys — migrate level/xp from v3, reset baseline counts
  if (formativeStr === null) {
    const [oldLevelStr, oldXpStr] = await Promise.all([
      AsyncStorage.getItem(`pet_level_v3_${keys.username}`),
      AsyncStorage.getItem(`pet_xp_v3_${keys.username}`),
    ]);
    const migratedLevel = oldLevelStr ? parseInt(oldLevelStr, 10) : 0;
    const migratedXP    = oldXpStr    ? parseInt(oldXpStr, 10)    : 0;
    await Promise.all([
      AsyncStorage.setItem(keys.level,     migratedLevel.toString()),
      AsyncStorage.setItem(keys.xp,        migratedXP.toString()),
      AsyncStorage.setItem(keys.formative, counts.formative.toString()),
      AsyncStorage.setItem(keys.summative, counts.summative.toString()),
    ]);
    return { oldLevel: migratedLevel, oldXP: migratedXP, newLevel: migratedLevel, newXP: migratedXP, levelsGained: 0, gainedXP: 0 };
  }

  const oldLevel = levelStr    ? parseInt(levelStr, 10)     : 0;
  const oldXP    = xpStr       ? parseInt(xpStr, 10)        : 0;
  const prevF    = formativeStr ? parseInt(formativeStr, 10) : 0;
  const prevS    = summativeStr ? parseInt(summativeStr, 10) : 0;

  const newFormatives = Math.max(0, counts.formative - prevF);
  const newSummatives = Math.max(0, counts.summative - prevS);
  const gainedXP = newFormatives * FORMATIVE_XP + newSummatives * SUMMATIVE_XP;

  const { level: newLevel, xp: newXP, levelsGained } = applyXP(oldLevel, oldXP, gainedXP);

  await Promise.all([
    AsyncStorage.setItem(keys.level,     newLevel.toString()),
    AsyncStorage.setItem(keys.xp,        newXP.toString()),
    AsyncStorage.setItem(keys.formative, counts.formative.toString()),
    AsyncStorage.setItem(keys.summative, counts.summative.toString()),
  ]);

  return { oldLevel, oldXP, newLevel, newXP, levelsGained, gainedXP };
}
