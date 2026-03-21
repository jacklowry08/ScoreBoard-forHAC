import React, { useRef } from 'react';
import { WebView } from 'react-native-webview';
import {
  NAVIGATE_TO_GRADES,
  getPeriodSubmitFormScript,
  CHECK_AND_FULL_SCRAPE_SCRIPT,
} from '../services/webScraper';
import { GradeCacheService } from '../services/GradeCacheService';
import { GradeSharingService } from '../services/GradeSharingService';

const ASSIGNMENTS_URL =
  'https://homeaccess.stjohns.k12.fl.us/HomeAccess/Content/Student/Assignments.aspx';

interface Props {
  period: number;
  onDone: (period: number) => void;
}

/**
 * Headless WebView that scrapes one marking period in the background using
 * the shared persistent cookie session (no login needed). Unmounts itself
 * via onDone once the grades are cached or if the session has expired.
 */
export default function PeriodScraper({ period, onDone }: Props) {
  const webViewRef = useRef<WebView>(null);
  const periodSubmittedRef = useRef(false);

  const handleLoad = (event: any) => {
    const url = event.nativeEvent.url;

    // Session expired — abort silently; GradesScreen will handle it on demand.
    if (url.includes('/LogOn')) {
      onDone(period);
      return;
    }

    const isGradesPage =
      url.includes('/Assignments.aspx') || url.includes('/Classes/Classwork');

    if (!isGradesPage) {
      // Intermediate page (e.g. WeekView) — push to Assignments.aspx.
      webViewRef.current?.injectJavaScript(NAVIGATE_TO_GRADES);
      return;
    }

    if (!periodSubmittedRef.current) {
      // Phase 1: select the target period via form submission.
      periodSubmittedRef.current = true;
      webViewRef.current?.injectJavaScript(getPeriodSubmitFormScript(period));
    } else {
      // Phase 2: grades page reload (or disambiguation for M2/M4).
      // CHECK_AND_FULL_SCRAPE_SCRIPT auto-handles disambiguation and sends
      // { type: 'full_scrape' } with grades + all class assignments.
      webViewRef.current?.injectJavaScript(CHECK_AND_FULL_SCRAPE_SCRIPT);
    }
  };

  const handleMessage = async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'debug') return;

      if (msg.type === 'full_scrape') {
        if (msg.grades && msg.grades.length > 0) {
          await GradeCacheService.saveGrades(msg.grades, period);
          // Cache every class's assignments for this period in one shot.
          const assignmentMap = msg.assignments as Record<string, any[]>;
          for (const [classId, assignments] of Object.entries(assignmentMap)) {
            if (assignments.length > 0) {
              await GradeCacheService.saveAssignments(`${classId}_p${period}`, assignments);
            }
          }
          console.log(`✅ BG scrape: cached grades + assignments for period ${period}`);
          const gradeData = msg.grades.map((g: any) => ({
            courseCode: g.courseCode,
            className: g.className,
            percentage: g.percentage,
          }));
          GradeSharingService.submitGrades(gradeData, period); // fire-and-forget
        }
        onDone(period);
        return;
      }

      // Fallback for legacy 'grades'-only message.
      if (msg.type !== 'grades') return;
      if (msg.data && msg.data.length > 0) {
        await GradeCacheService.saveGrades(msg.data, period);
        console.log(`✅ BG scrape: cached ${msg.data.length} grades for period ${period}`);
        const gradeData = msg.data.map((g: any) => ({
          courseCode: g.courseCode,
          className: g.className,
          percentage: g.percentage,
        }));
        GradeSharingService.submitGrades(gradeData, period); // fire-and-forget
      }
      onDone(period);
    } catch {
      onDone(period);
    }
  };

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: ASSIGNMENTS_URL }}
      onLoad={handleLoad}
      onMessage={handleMessage}
      javaScriptEnabled
      domStorageEnabled
      sharedCookiesEnabled={false}
      thirdPartyCookiesEnabled={false}
      cacheEnabled={false}
      style={{ position: 'absolute', top: -400, left: 0, height: 400, width: 400 }}
    />
  );
}
