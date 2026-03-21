import AsyncStorage from '@react-native-async-storage/async-storage';
import { Grade, Assignment } from './webScraper';

const CACHE_VERSION = 'v6'; // bump this to invalidate all existing caches
const GRADES_CACHE_KEY = `grades_cache_${CACHE_VERSION}_P`; // append period index 0-4
const CACHE_TIMESTAMP_KEY = `grades_cache_timestamp_${CACHE_VERSION}_P`;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

const ASSIGNMENT_CACHE_PREFIX = 'assignments_cache_';
const ASSIGNMENT_TIMESTAMP_PREFIX = 'assignments_timestamp_';

export class GradeCacheService {
  /**
   * Save grades to cache
   */
  static async saveGrades(grades: Grade[], period = 0): Promise<void> {
    try {
      await AsyncStorage.setItem(`${GRADES_CACHE_KEY}${period}`, JSON.stringify(grades));
      await AsyncStorage.setItem(`${CACHE_TIMESTAMP_KEY}${period}`, Date.now().toString());
    } catch (error) {
      console.error('Error saving grades to cache:', error);
    }
  }

  /** Returns cached grades only if still within the TTL. */
  static async getCachedGrades(period = 0): Promise<Grade[] | null> {
    try {
      const cachedGrades = await AsyncStorage.getItem(`${GRADES_CACHE_KEY}${period}`);
      const timestamp = await AsyncStorage.getItem(`${CACHE_TIMESTAMP_KEY}${period}`);

      if (!cachedGrades || !timestamp) return null;

      const cacheAge = Date.now() - parseInt(timestamp);
      if (cacheAge > CACHE_DURATION) return null;

      return JSON.parse(cachedGrades);
    } catch (error) {
      return null;
    }
  }

  /** Returns cached grades regardless of age (for stale-while-revalidate). */
  static async getCachedGradesStale(period = 0): Promise<Grade[] | null> {
    try {
      const cachedGrades = await AsyncStorage.getItem(`${GRADES_CACHE_KEY}${period}`);
      if (!cachedGrades) return null;
      return JSON.parse(cachedGrades);
    } catch {
      return null;
    }
  }

  /** Returns true if cached grades exist but are past the TTL. */
  static async isCacheStale(period = 0): Promise<boolean> {
    try {
      const timestamp = await AsyncStorage.getItem(`${CACHE_TIMESTAMP_KEY}${period}`);
      if (!timestamp) return false;
      return Date.now() - parseInt(timestamp, 10) > CACHE_DURATION;
    } catch {
      return false;
    }
  }

  // Clears all period caches (used on logout / full refresh)
  static async clearCache(): Promise<void> {
    try {
      for (let p = 0; p <= 5; p++) {
        await AsyncStorage.removeItem(`${GRADES_CACHE_KEY}${p}`);
        await AsyncStorage.removeItem(`${CACHE_TIMESTAMP_KEY}${p}`);
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Clears cache for a single period (used on pull-to-refresh)
  static async clearCacheForPeriod(period: number): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${GRADES_CACHE_KEY}${period}`);
      await AsyncStorage.removeItem(`${CACHE_TIMESTAMP_KEY}${period}`);
    } catch (error) {
      console.error('Error clearing period cache:', error);
    }
  }

  /** Returns the epoch ms when grades were last saved for a period, or null. */
  static async getCacheTimestamp(period = 0): Promise<number | null> {
    try {
      const ts = await AsyncStorage.getItem(`${CACHE_TIMESTAMP_KEY}${period}`);
      return ts ? parseInt(ts, 10) : null;
    } catch {
      return null;
    }
  }

  /**
   * Save assignments for a specific class to cache
   */
  static async saveAssignments(classId: string, assignments: Assignment[]): Promise<void> {
    try {
      await AsyncStorage.setItem(`${ASSIGNMENT_CACHE_PREFIX}${classId}`, JSON.stringify(assignments));
      await AsyncStorage.setItem(`${ASSIGNMENT_TIMESTAMP_PREFIX}${classId}`, Date.now().toString());
      console.log('💾 Cached', assignments.length, 'assignments for', classId);
    } catch (error) {
      console.error('Error saving assignments to cache:', error);
    }
  }

  /** Returns cached assignments regardless of age (for stale-while-revalidate). */
  static async getCachedAssignmentsStale(classId: string): Promise<Assignment[] | null> {
    try {
      const cached = await AsyncStorage.getItem(`${ASSIGNMENT_CACHE_PREFIX}${classId}`);
      if (!cached) return null;
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }

  /**
   * Get cached assignments for a class if still valid (within 15 minutes)
   */
  static async getCachedAssignments(classId: string): Promise<Assignment[] | null> {
    try {
      const cached = await AsyncStorage.getItem(`${ASSIGNMENT_CACHE_PREFIX}${classId}`);
      const timestamp = await AsyncStorage.getItem(`${ASSIGNMENT_TIMESTAMP_PREFIX}${classId}`);

      if (!cached || !timestamp) return null;

      const cacheAge = Date.now() - parseInt(timestamp);
      const minutesOld = Math.floor(cacheAge / 60000);

      if (cacheAge > CACHE_DURATION) {
        console.log('⏰ Assignment cache expired for', classId, '(', minutesOld, 'minutes old)');
        return null;
      }

      console.log('📦 Using cached assignments for', classId, '(', minutesOld, 'minutes old)');
      return JSON.parse(cached);
    } catch (error) {
      console.error('Error reading assignments from cache:', error);
      return null;
    }
  }

  /**
   * Clear cached assignments for a specific class
   */
  static async clearAssignmentCache(classId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${ASSIGNMENT_CACHE_PREFIX}${classId}`);
      await AsyncStorage.removeItem(`${ASSIGNMENT_TIMESTAMP_PREFIX}${classId}`);
      console.log('🗑️ Assignment cache cleared for', classId);
    } catch (error) {
      console.error('Error clearing assignment cache:', error);
    }
  }
}
