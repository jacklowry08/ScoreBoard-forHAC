import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import * as SecureStore from 'expo-secure-store';

const SHARING_ENABLED_KEY = 'grade_sharing_enabled';
// Per-period keys so each marking period uploads independently.
const UPLOAD_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

const MINIMUM_STUDENTS = 10; // Back to production value

export interface GradeData {
  courseCode: string;
  className: string;
  percentage: number;
}

export interface ClassAverageResult {
  average: number | null;
  studentCount: number;
}

export class GradeSharingService {
  private static getUploadKey(markingPeriod: number): string {
    return `grade_sharing_last_upload_v2_p${markingPeriod}`;
  }

  /**
   * Derive a stable, anonymous student identifier from the HAC username.
   * Same username → same hash on every device, so multi-device logins don't
   * inflate the student count in Supabase.
   */
  private static async getStudentIdentifier(): Promise<string> {
    try {
      const username = await SecureStore.getItemAsync('hac_username');
      if (!username) return 'anonymous';
      // djb2 hash — deterministic, no native crypto needed
      let hash = 5381;
      for (let i = 0; i < username.length; i++) {
        hash = ((hash << 5) + hash) + username.charCodeAt(i);
        hash = hash >>> 0; // keep unsigned 32-bit
      }
      return `u_${hash.toString(36)}`;
    } catch {
      return 'anonymous';
    }
  }

  /**
   * Check if user can upload for a specific marking period (24 hour per-period cooldown)
   */
  static async canUpload(markingPeriod: number): Promise<boolean> {
    try {
      const lastUpload = await AsyncStorage.getItem(this.getUploadKey(markingPeriod));
      if (!lastUpload) {
        console.log(`✅ No previous upload for period ${markingPeriod}, can upload`);
        return true;
      }

      const timeSinceUpload = Date.now() - parseInt(lastUpload);
      const hoursRemaining = Math.ceil((UPLOAD_COOLDOWN - timeSinceUpload) / (1000 * 60 * 60));

      if (timeSinceUpload < UPLOAD_COOLDOWN) {
        console.log(`⏰ Period ${markingPeriod} upload cooldown: ${hoursRemaining}h remaining`);
        return false;
      }

      console.log(`✅ Period ${markingPeriod} cooldown expired, can upload`);
      return true;
    } catch (error) {
      console.error('Error checking upload cooldown:', error);
      return true;
    }
  }

  /**
   * Get hours until next upload allowed for a specific marking period
   */
  static async getHoursUntilNextUpload(markingPeriod: number): Promise<number> {
    try {
      const lastUpload = await AsyncStorage.getItem(this.getUploadKey(markingPeriod));
      if (!lastUpload) return 0;

      const timeSinceUpload = Date.now() - parseInt(lastUpload);
      if (timeSinceUpload >= UPLOAD_COOLDOWN) return 0;

      const hoursRemaining = Math.ceil((UPLOAD_COOLDOWN - timeSinceUpload) / (1000 * 60 * 60));
      return hoursRemaining;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check if grade sharing is enabled
   */
  static async isEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(SHARING_ENABLED_KEY);
      const isEnabled = enabled === 'true';
      console.log('📊 Grade sharing enabled:', isEnabled);
      return isEnabled;
    } catch (error) {
      console.error('Error checking if sharing is enabled:', error);
      return false;
    }
  }

  /**
   * Enable or disable grade sharing
   */
  static async setEnabled(enabled: boolean): Promise<boolean> {
    try {
      await AsyncStorage.setItem(SHARING_ENABLED_KEY, enabled.toString());
      console.log('✅ Grade sharing set to:', enabled);

      if (!enabled) {
        await this.deleteSharedData();
      }

      return true;
    } catch (error) {
      console.error('Error setting sharing enabled:', error);
      return false;
    }
  }

  /**
   * Submit grades to Supabase for a specific marking period.
   * Only deletes/replaces this device's data for that period,
   * so all four periods can coexist in the table.
   */
  static async submitGrades(grades: GradeData[], markingPeriod: number): Promise<void> {
    try {
      console.log('📤 submitGrades called with', grades.length, 'grades for period', markingPeriod);

      const enabled = await this.isEnabled();
      if (!enabled) {
        console.log('📊 Grade sharing disabled, skipping upload');
        return;
      }

      const canUpload = await this.canUpload(markingPeriod);
      if (!canUpload) {
        const hours = await this.getHoursUntilNextUpload(markingPeriod);
        console.log(`⏰ Upload cooldown active: ${hours} hours remaining`);
        return;
      }

      const studentIdentifier = await this.getStudentIdentifier();
      const schoolCode = 'pvhs_sjc';

      // Delete only this period's rows for this device, preserving other periods.
      const { error: deleteError } = await supabase
        .from('class_grades')
        .delete()
        .eq('device_fingerprint', studentIdentifier)
        .eq('marking_period', markingPeriod);

      if (deleteError) {
        console.error('❌ Error deleting old grades:', deleteError);
      }

      const records = grades.map(grade => ({
        device_fingerprint: studentIdentifier,
        school_code: schoolCode,
        course_code: grade.courseCode,
        class_name: grade.className,
        grade_percentage: grade.percentage,
        marking_period: markingPeriod,
      }));

      const { error: insertError } = await supabase
        .from('class_grades')
        .upsert(records, { onConflict: 'device_fingerprint,course_code,marking_period' });

      if (insertError) {
        console.error('❌ Error uploading grades:', insertError);
        return;
      }

      await AsyncStorage.setItem(this.getUploadKey(markingPeriod), Date.now().toString());
      console.log('✅ Successfully uploaded', grades.length, 'grades for period', markingPeriod);
    } catch (error) {
      console.error('❌ Error submitting grades:', error);
    }
  }

  /**
   * Get class average for a specific course and marking period.
   */
  static async getClassAverage(courseCode: string, className: string, markingPeriod: number): Promise<ClassAverageResult> {
    try {
      const schoolCode = 'pvhs_sjc';

      const { data, error } = await supabase
        .from('class_grades')
        .select('grade_percentage, device_fingerprint')
        .eq('school_code', schoolCode)
        .eq('course_code', courseCode)
        .eq('marking_period', markingPeriod);

      if (error) {
        console.error('Error fetching class average:', error);
        return { average: null, studentCount: 0 };
      }

      if (!data || data.length === 0) {
        return { average: null, studentCount: 0 };
      }

      const uniqueDevices = new Set(data.map(d => d.device_fingerprint));
      const studentCount = uniqueDevices.size;

      if (studentCount < MINIMUM_STUDENTS) {
        console.log(`Privacy threshold not met: only ${studentCount} students (need ${MINIMUM_STUDENTS})`);
        return { average: null, studentCount };
      }

      const sum = data.reduce((acc, curr) => acc + curr.grade_percentage, 0);
      const average = Math.round(sum / data.length);

      console.log(`📊 ${className}: ${average}% (period ${markingPeriod}, ${studentCount} students)`);
      return { average, studentCount };
    } catch (error) {
      console.error('Error getting class average:', error);
      return { average: null, studentCount: 0 };
    }
  }

  /**
   * Delete user's shared data
   */
  static async deleteSharedData(): Promise<void> {
    try {
      const studentIdentifier = await this.getStudentIdentifier();

      const { error } = await supabase
        .from('class_grades')
        .delete()
        .eq('device_fingerprint', studentIdentifier);

      if (error) {
        console.error('Error deleting shared data:', error);
      } else {
        console.log('🗑️ Deleted shared grade data');
      }
    } catch (error) {
      console.error('Error in deleteSharedData:', error);
    }
  }
}
