/**
 * Direct HTTP client for HAC (Home Access Center) grade scraping.
 *
 * Cookie strategy:
 *   credentials:'include' lets NSURLSession (iOS) / OkHttp (Android) manage
 *   cookies automatically. This ensures the ASP.NET session cookie from the
 *   login GET is included in the login POST, satisfying CSRF validation.
 *   We do NOT manually set Cookie headers — that would conflict with the OS
 *   cookie store and could strip cookies the OS captured but JS can't see.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Grade, Assignment } from './webScraper';

export interface PeriodData {
  grades: Grade[];
  assignments: Record<string, Assignment[]>;
}

export interface AttendanceDay {
  day: number;
  date: string;        // 'YYYY-MM-DD'
  color: string;       // HAC hex color, e.g. '#00CC00'
  description: string; // attendance type label, e.g. 'Excused Absence'
}

export interface AttendanceMonthData {
  year: number;
  month: number;       // 1-12
  monthName: string;   // e.g. 'March 2026'
  days: AttendanceDay[];
  calTarget: string;   // __EVENTTARGET for calendar nav (same for prev/next)
  prevArg: string;     // __EVENTARGUMENT for ‹ button
  nextArg: string;     // __EVENTARGUMENT for › button
  hiddenInputs: Record<string, string>;
  legend: { color: string; label: string }[];
}

export type LoginResult = 'ok' | 'invalid_credentials' | 'network_error';
export interface HacLoginSuccess { result: 'ok'; gradesHtml?: string; }
export interface HacLoginFailure { result: 'invalid_credentials' | 'network_error'; }
export type HacLoginOutcome = HacLoginSuccess | HacLoginFailure;

interface AspNetFields {
  viewState: string;
  viewStateGenerator: string;
  eventValidation: string;
}

interface PeriodOption {
  value: string;
  text: string;
}

let currentBaseUrl = 'https://homeaccess.stjohns.k12.fl.us';

// Cached ASP.NET fields + period options from the last successful full fetch.
// Lets hacFetchPeriod skip the initial GET (saves ~300-500ms per call).
let _cachedAspFields: AspNetFields | null = null;
let _cachedPeriodOptions: { options: PeriodOption[]; selectedIndex: number } | null = null;

export function clearHACSessionCache(): void {
  _cachedAspFields = null;
  _cachedPeriodOptions = null;
}

export function configureDistrict(baseUrl: string): void {
  currentBaseUrl = baseUrl;
}

const BASE_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** Fetch wrapper that adds common headers and uses the OS cookie store. */
async function doFetch(
  url: string,
  init: Omit<RequestInit, 'credentials'> & { headers?: Record<string, string> } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    ...BASE_HEADERS,
    ...(init.headers ?? {}),
  };
  return fetch(url, {
    ...init,
    headers,
    credentials: 'include', // OS (NSURLSession / OkHttp) manages session cookies
  });
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&nbsp;/g, ' ');
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

function extractField(html: string, fieldName: string): string {
  let m = html.match(new RegExp(`name="${fieldName}"[^>]*value="([^"]*)"`, 'i'));
  if (!m) m = html.match(new RegExp(`value="([^"]*)"[^>]*name="${fieldName}"`, 'i'));
  return m ? decodeHtml(m[1]) : '';
}

function extractAspNetFields(html: string): AspNetFields {
  return {
    viewState: extractField(html, '__VIEWSTATE'),
    viewStateGenerator: extractField(html, '__VIEWSTATEGENERATOR'),
    eventValidation: extractField(html, '__EVENTVALIDATION'),
  };
}

function extractAllHiddenInputs(html: string): Record<string, string> {
  const inputs: Record<string, string> = {};
  const re = /<input[^>]+type=["']?hidden["']?[^>]*/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const nameM = tag.match(/name="([^"]*)"/i);
    const valueM = tag.match(/value="([^"]*)"/i);
    if (nameM) inputs[nameM[1]] = valueM ? decodeHtml(valueM[1]) : '';
  }
  return inputs;
}

/**
 * Extract checked checkboxes so their "true" value overrides the ASP.NET
 * hidden companion input ("false") that we pick up via extractAllHiddenInputs.
 */
function extractCheckedCheckboxes(html: string): Record<string, string> {
  const inputs: Record<string, string> = {};
  const re = /<input[^>]+type=["']?checkbox["']?[^>]*/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    if (!/\bchecked\b/i.test(tag)) continue;
    const nameM = tag.match(/name="([^"]*)"/i);
    const valueM = tag.match(/value="([^"]*)"/i);
    if (nameM) inputs[nameM[1]] = valueM ? decodeHtml(valueM[1]) : 'on';
  }
  return inputs;
}

function extractPeriodOptions(html: string): {
  options: PeriodOption[];
  selectedIndex: number;
} {
  const selectM = html.match(
    /<select[^>]+id="plnMain_ddlReportCardRuns"[^>]*>([\s\S]*?)<\/select>/i,
  );
  if (!selectM) return { options: [], selectedIndex: 0 };

  const content = selectM[1];
  const optRe = /<option([^>]*)>([^<]*)<\/option>/gi;
  const options: PeriodOption[] = [];
  let selectedIndex = 0;
  let om;
  while ((om = optRe.exec(content)) !== null) {
    const attrs = om[1];
    const text = om[2].trim();
    const valueM = attrs.match(/value="([^"]*)"/i);
    const value = valueM ? valueM[1] : '';
    if (attrs.toLowerCase().includes('selected')) selectedIndex = options.length;
    options.push({ value, text });
  }
  return { options, selectedIndex };
}

// ─── Grade / assignment parsing ───────────────────────────────────────────────

function splitIntoClassBlocks(html: string): string[] {
  const marker = 'class="AssignmentClass"';
  const blocks: string[] = [];
  let start = html.indexOf(marker);
  while (start !== -1) {
    const next = html.indexOf(marker, start + marker.length);
    blocks.push(next !== -1 ? html.slice(start, next) : html.slice(start));
    start = next;
  }
  return blocks;
}

function extractGradeFromBlock(block: string, index: number): Grade | null {
  const nameM = block.match(/<a[^>]+sg-header-heading[^>]*>([^<]+)<\/a>/i);
  const gradeM = block.match(/<span[^>]+sg-right[^>]*>([^<]+)<\/span>/i);
  if (!nameM || !gradeM) return null;

  const fullName = decodeHtml(nameM[1].trim());
  const gradeText = decodeHtml(gradeM[1].trim());

  const courseCodeM = fullName.match(/^(\d+)/);
  const courseCode = courseCodeM ? courseCodeM[1] : '';
  const classNameM = fullName.match(/^\d+ - \d+\s+(.+)/);
  const className = classNameM ? classNameM[1].trim() : fullName;

  const pctM = gradeText.match(/Average\s+(\d+)/);
  const percentage = pctM ? parseInt(pctM[1], 10) : 0;

  let letterGrade = 'F';
  if (percentage >= 90) letterGrade = 'A';
  else if (percentage >= 80) letterGrade = 'B';
  else if (percentage >= 70) letterGrade = 'C';
  else if (percentage >= 60) letterGrade = 'D';

  return { id: `class_${index}`, courseCode, className, percentage, letterGrade };
}

function extractAssignmentsFromBlock(block: string): Assignment[] {
  const assignments: Assignment[] = [];
  const rowRe = /<tr[^>]+sg-asp-table-data-row[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowM;

  while ((rowM = rowRe.exec(block)) !== null) {
    const rowContent = rowM[1];

    const titleAnchorM = rowContent.match(/<a[^>]+title="(Title:[^"]+)"[^>]*>/i);
    if (!titleAnchorM) continue;

    const titleAttr = decodeHtml(titleAnchorM[1]);
    const titleM = titleAttr.match(
      /Title:\s*Assignment Course[^:]*:\s*(.+?)(?:\s{2,}Category:|$)/,
    );
    if (!titleM) continue;

    const name = titleM[1].trim();
    const categoryM  = titleAttr.match(/Category:\s*(.+?)(?:\s{2,}Due Date:|$)/);
    const dueDateM   = titleAttr.match(/Due Date:\s*(.+?)(?:\s{2,}Max Points:|$)/);
    const maxPointsM = titleAttr.match(/Max Points:\s*([\d.]+)/);
    const category   = categoryM  ? categoryM[1].trim()  : '';
    const dateDue    = dueDateM   ? dueDateM[1].trim()   : '';
    const titlePoints = maxPointsM ? maxPointsM[1].trim() : '';

    const cells: string[] = [];
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellM;
    while ((cellM = cellRe.exec(rowContent)) !== null) {
      cells.push(stripTags(cellM[1]).replace(/\s+/g, ' ').trim());
    }

    if (cells.length >= 5 && name) {
      assignments.push({
        name,
        category,
        dateDue,
        score:  cells[4] || 'N/A',
        // Prefer cell value; fall back to title's Max Points (covers Incomplete rows
        // where the score/points cells may be blank but the assignment has a real total).
        points: (cells[5] && cells[5] !== '') ? cells[5] : (titlePoints || 'N/A'),
        weight: cells[6] || '1',
      });
    }
  }
  return assignments;
}

function parseAssignmentsPage(html: string): PeriodData {
  const blocks = splitIntoClassBlocks(html);
  const grades: Grade[] = [];
  const assignments: Record<string, Assignment[]> = {};

  blocks.forEach((block, i) => {
    const grade = extractGradeFromBlock(block, i);
    if (grade) {
      grades.push(grade);
      assignments[grade.id] = extractAssignmentsFromBlock(block);
    }
  });

  return { grades, assignments };
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function buildFormBody(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function fetchGradesPage(): Promise<string> {
  const resp = await doFetch(`${currentBaseUrl}/HomeAccess/Content/Student/Assignments.aspx`);
  const html = await resp.text();
  if (html.includes('LogOnDetails.UserName') || (resp.url && resp.url.includes('/LogOn'))) {
    throw new Error('session_expired');
  }
  return html;
}

async function fetchPeriodPage(periodValue: string, aspFields: AspNetFields): Promise<string> {
  const body = buildFormBody({
    __VIEWSTATE: aspFields.viewState,
    __VIEWSTATEGENERATOR: aspFields.viewStateGenerator,
    __EVENTVALIDATION: aspFields.eventValidation,
    __EVENTTARGET: 'ctl00$plnMain$btnRefreshView',
    __EVENTARGUMENT: '',
    'ctl00$plnMain$ddlReportCardRuns': periodValue,
  });

  const resp = await doFetch(`${currentBaseUrl}/HomeAccess/Content/Student/Assignments.aspx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  let html = await resp.text();

  if (needsDisambiguation(html)) {
    html = await handleDisambiguation(html);
  }
  return html;
}

function needsDisambiguation(html: string): boolean {
  return /value="Continue"/i.test(html);
}

async function handleDisambiguation(disambigHtml: string): Promise<string> {
  const hiddenInputs = extractAllHiddenInputs(disambigHtml);

  const selectWithDM = disambigHtml.match(
    /<select[^>]+name="([^"]+)"[^>]*>[\s\S]*?<option[^>]+value="(D[^"]*)"/i,
  );
  const fields: Record<string, string> = { ...hiddenInputs };
  if (selectWithDM) fields[selectWithDM[1]] = selectWithDM[2];

  const continueBtnM = disambigHtml.match(/<input[^>]+value="Continue"[^>]*>/i);
  if (continueBtnM) {
    const btnNameM = continueBtnM[0].match(/name="([^"]+)"/i);
    if (btnNameM) fields[btnNameM[1]] = 'Continue';
  }

  const resp = await doFetch(`${currentBaseUrl}/HomeAccess/Content/Student/Assignments.aspx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: buildFormBody(fields),
  });
  return resp.text();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function hacLogin(username: string, password: string): Promise<HacLoginOutcome> {
  try {
    console.log('🔑 hacLogin: step 1 — LogOff');
    await doFetch(`${currentBaseUrl}/HomeAccess/Account/LogOff`).catch(() => {});

    console.log('🔑 hacLogin: step 2 — GET LogOn');
    let loginPageResp = await doFetch(`${currentBaseUrl}/HomeAccess/Account/LogOn`);
    let loginHtml = await loginPageResp.text();
    console.log(`🔑 hacLogin: login page length=${loginHtml.length}, hasForm=${loginHtml.includes('LogOnDetails.UserName')}`);

    if (!loginHtml.includes('LogOnDetails.UserName')) {
      console.log('🔑 hacLogin: session survived LogOff, trying POST LogOff');
      await doFetch(`${currentBaseUrl}/HomeAccess/Account/LogOff`, { method: 'POST' }).catch(() => {});
      loginPageResp = await doFetch(`${currentBaseUrl}/HomeAccess/Account/LogOn`);
      loginHtml = await loginPageResp.text();
      if (!loginHtml.includes('LogOnDetails.UserName')) {
        console.warn('🔑 hacLogin: could not reach login page → network_error');
        return { result: 'network_error' };
      }
    }

    const formActionM = loginHtml.match(/<form[^>]+action="([^"]+)"[^>]*>/i);
    const rawAction = formActionM ? decodeHtml(formActionM[1]) : '';
    const postUrl = rawAction.startsWith('http')
      ? rawAction
      : rawAction
        ? currentBaseUrl + rawAction
        : `${currentBaseUrl}/HomeAccess/Account/LogOn`;

    const hiddenInputs = extractAllHiddenInputs(loginHtml);
    const checkedBoxes = extractCheckedCheckboxes(loginHtml);

    const fields: Record<string, string> = {
      ...hiddenInputs,
      ...checkedBoxes,
      'LogOnDetails.UserName': username,
      'LogOnDetails.Password': password,
    };
    if (!fields['Database']) fields['Database'] = '10';

    console.log(`🔑 hacLogin: step 3 — POST credentials to ${postUrl}`);
    const resp = await doFetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: postUrl,
        Origin: currentBaseUrl,
      },
      body: buildFormBody(fields),
    });

    const html = await resp.text();
    const finalUrl: string = (resp as any).url ?? '';
    console.log(`🔑 hacLogin: POST response length=${html.length}, finalUrl=${finalUrl}, hasLoginForm=${html.includes('LogOnDetails.UserName')}, hasErrors=${html.includes('validation-summary-errors') || html.includes('field-validation-error')}`);

    if (
      html.includes('LogOnDetails.UserName') ||
      html.includes('validation-summary-errors') ||
      html.includes('field-validation-error')
    ) {
      console.warn('🔑 hacLogin: credentials rejected → invalid_credentials');
      return { result: 'invalid_credentials' };
    }

    const landedOnGrades =
      (finalUrl.includes('/Assignments') || finalUrl.includes('/Classwork')) &&
      !html.includes('LogOnDetails.UserName') &&
      html.includes('AssignmentClass');
    if (landedOnGrades) {
      console.log('🔑 hacLogin: landed on grades page → ok');
      return { result: 'ok', gradesHtml: html };
    }

    if (finalUrl && !finalUrl.includes('/LogOn') && !finalUrl.includes('/Account/')) {
      console.log(`🔑 hacLogin: finalUrl=${finalUrl} → ok`);
      return { result: 'ok' };
    }

    console.log('🔑 hacLogin: step 4 — final probe of Assignments page');
    const verifyResp = await doFetch(`${currentBaseUrl}/HomeAccess/Content/Student/Assignments.aspx`);
    const verifyHtml = await verifyResp.text();
    console.log(`🔑 hacLogin: verify length=${verifyHtml.length}, hasLoginForm=${verifyHtml.includes('LogOnDetails.UserName')}`);
    if (!verifyHtml.includes('LogOnDetails.UserName') && verifyHtml.length > 500) {
      console.log('🔑 hacLogin: verify succeeded → ok');
      return { result: 'ok', gradesHtml: verifyHtml };
    }

    console.warn('🔑 hacLogin: verify failed → invalid_credentials');
    return { result: 'invalid_credentials' };
  } catch (e) {
    console.error('🔑 hacLogin error:', e);
    return { result: 'network_error' };
  }
}

export async function hacFetchAllPeriods(
  onPeriodReady: (periodIndex: number, data: PeriodData) => void | Promise<void>,
  preloadedHtml?: string,
): Promise<{ currentPeriodIndex: number; numPeriods: number; error?: string }> {
  try {
    const html = preloadedHtml ?? await fetchGradesPage();
    const aspFields = extractAspNetFields(html);
    const { options, selectedIndex } = extractPeriodOptions(html);

    const numPeriods = options.length > 1 ? options.length - 1 : 4;
    const currentPeriodIndex = selectedIndex > 0 ? selectedIndex : numPeriods;

    // Cache for use by hacFetchPeriod
    _cachedAspFields = aspFields;
    _cachedPeriodOptions = { options, selectedIndex };

    const currentData = parseAssignmentsPage(html);

    const otherPeriods = options
      .map((opt, idx) => ({ ...opt, index: idx }))
      .filter(({ index, value }) => index > 0 && index !== selectedIndex && value);

    // Start all background HTTP fetches immediately (overlapped with current-period
    // processing) so they run in parallel. We collect the parsed results but do NOT
    // call onPeriodReady yet — the current period must fire first so it always wins
    // the "first period with data" race in startFetching.
    const otherPeriodPromises = otherPeriods.map(async ({ value, index }) => {
      try {
        const periodHtml = await fetchPeriodPage(value, aspFields);
        return { index, data: parseAssignmentsPage(periodHtml) };
      } catch (e) {
        console.warn(`⚠️ hacFetchAllPeriods: period ${index} failed:`, e);
        return null;
      }
    });

    // Current period callback fires first (guaranteed correct period key + navigation).
    await onPeriodReady(currentPeriodIndex, currentData);

    // Then deliver background results as they resolve.
    await Promise.all(
      otherPeriodPromises.map(async (promise) => {
        const result = await promise;
        if (result) await onPeriodReady(result.index, result.data);
      }),
    );

    return { currentPeriodIndex, numPeriods };
  } catch (e) {
    console.warn('hacFetchAllPeriods error:', e);
    return { currentPeriodIndex: 0, numPeriods: 4, error: String(e) };
  }
}

/**
 * Fetch the student's real first name from the HAC demographic page.
 * Requires a valid session (cookies via NSURLSession).
 * Returns the capitalised first name, e.g. "Jack", or null on failure.
 */
export async function fetchStudentName(): Promise<string | null> {
  try {
    const resp = await doFetch(`${currentBaseUrl}/HomeAccess/Registration/Demographic`);
    const url: string = (resp as any).url ?? '';
    if (url.includes('/LogOn') || url.includes('/Account/')) return null;

    const html = await resp.text();
    const m = html.match(/sg-menu-element-identity[^>]*>[\s\S]*?<span>([^<]+)<\/span>/i);
    if (!m) return null;

    const fullName = decodeHtml(m[1].trim());
    const parts = fullName.split(/\s+/);
    const firstName = parts[0];
    const lastName  = parts.slice(1).join(' ');
    if (!firstName) return null;

    const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';

    if (lastName) {
      await AsyncStorage.setItem('student_last_name', cap(lastName)).catch(() => {});
    }

    return cap(firstName);
  } catch (e) {
    console.warn('fetchStudentName error:', e);
    return null;
  }
}

export async function hacFetchPeriod(periodIndex: number): Promise<PeriodData | null> {
  try {
    const html = await fetchGradesPage();
    const aspFields = extractAspNetFields(html);
    const { options, selectedIndex } = extractPeriodOptions(html);

    // Update cache with fresh fields
    _cachedAspFields = aspFields;
    _cachedPeriodOptions = { options, selectedIndex };

    if (periodIndex === selectedIndex || periodIndex <= 0) {
      return parseAssignmentsPage(html);
    }

    if (periodIndex >= options.length) return null;
    const periodValue = options[periodIndex].value;
    if (!periodValue) return null;

    const periodHtml = await fetchPeriodPage(periodValue, aspFields);
    return parseAssignmentsPage(periodHtml);
  } catch (e) {
    console.error('hacFetchPeriod error:', e);
    return null;
  }
}

// ─── Transcript ───────────────────────────────────────────────────────────────

export interface TranscriptCourse {
  courseCode: string;
  courseName: string;
  sm1: string;
  sm2: string;
  fin: string;
  creditEarned: string;
}

export interface TranscriptGroup {
  year: string;
  grade: string;
  gpa: string;
  credit: string;
  courses: TranscriptCourse[];
}

export interface GpaEntry {
  type: string;
  gpa: string;
  rank: string;
}

export interface TranscriptData {
  groups: TranscriptGroup[];
  gpaTable: GpaEntry[];
}

/**
 * Returns the text content of the first element with the given id.
 * Handles simple cases like <span id="...">text</span>.
 */
function extractTextById(html: string, id: string): string {
  const idx = html.indexOf(`id="${id}"`);
  if (idx === -1) return '';
  const tagEnd = html.indexOf('>', idx);
  if (tagEnd === -1) return '';
  const textEnd = html.indexOf('<', tagEnd + 1);
  if (textEnd === -1) return '';
  return decodeHtml(html.slice(tagEnd + 1, textEnd).trim());
}

/**
 * Returns the full HTML of the table element with the given id,
 * correctly handling nested <table> elements.
 */
function extractTableById(html: string, id: string): string | null {
  const idx = html.indexOf(`id="${id}"`);
  if (idx === -1) return null;
  const tableStart = html.lastIndexOf('<table', idx);
  if (tableStart === -1) return null;
  const slice = html.slice(tableStart);
  let depth = 0;
  let pos = 0;
  while (pos < slice.length) {
    const lt = slice.indexOf('<', pos);
    if (lt === -1) break;
    const rest = slice.slice(lt);
    if (/^<table[\s>]/i.test(rest)) { depth++; pos = lt + 1; }
    else if (/^<\/table>/i.test(rest)) {
      depth--;
      if (depth === 0) return slice.slice(0, lt + 8);
      pos = lt + 1;
    } else { pos = lt + 1; }
  }
  return slice;
}

function parseTranscriptHtml(html: string): TranscriptData {
  const groups: TranscriptGroup[] = [];
  let n = 0;

  while (true) {
    const year = extractTextById(html, `plnMain_rpTranscriptGroup_lblYearValue_${n}`);
    if (!year) break;

    const grade  = extractTextById(html, `plnMain_rpTranscriptGroup_lblGradeValue_${n}`);
    const gpa    = extractTextById(html, `plnMain_rpTranscriptGroup_lblGPAValue_${n}`);
    const credit = extractTextById(html, `plnMain_rpTranscriptGroup_LblTCreditValue_${n}`);

    const courses: TranscriptCourse[] = [];
    const tableHtml = extractTableById(html, `plnMain_rpTranscriptGroup_dgCourses_${n}`);
    if (tableHtml) {
      const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowM;
      while ((rowM = rowRe.exec(tableHtml)) !== null) {
        const cells: string[] = [];
        const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let cellM;
        while ((cellM = cellRe.exec(rowM[1])) !== null) {
          cells.push(decodeHtml(stripTags(cellM[1])).replace(/\s+/g, ' ').trim());
        }
        if (cells.length >= 2) {
          const courseName = cells[1];
          if (courseName && courseName !== 'Description') {
            courses.push({
              courseCode:   cells[0] || '',
              courseName,
              sm1:          cells[2] || '',
              sm2:          cells[3] || '',
              fin:          cells[4] || '',
              creditEarned: cells[5] || '',
            });
          }
        }
      }
    }

    groups.push({ year, grade, gpa, credit, courses });
    n++;
  }

  const gpaTable: GpaEntry[] = [];
  for (let i = 1; i <= 2; i++) {
    const type = extractTextById(html, `plnMain_rpTranscriptGroup_lblGPADescr${i}`);
    const gpa  = extractTextById(html, `plnMain_rpTranscriptGroup_lblGPACum${i}`);
    const rank = extractTextById(html, `plnMain_rpTranscriptGroup_lblGPARank${i}`);
    if (type && gpa) gpaTable.push({ type, gpa, rank });
  }

  return { groups, gpaTable };
}

/**
 * Fetch and parse the HAC transcript page using the existing session.
 * Returns null if the session has expired (redirected to LogOn).
 * Throws on network errors.
 */
export async function hacFetchTranscript(): Promise<TranscriptData | null> {
  const resp = await doFetch(`${currentBaseUrl}/HomeAccess/Content/Student/Transcript.aspx`);
  const url: string = (resp as any).url ?? '';
  if (url.includes('/LogOn') || url.includes('/Account/')) return null;
  const html = await resp.text();
  if (html.includes('LogOnDetails.UserName')) return null;
  const data = parseTranscriptHtml(html);
  return data.groups.length > 0 ? data : null;
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export interface ScheduleCourse {
  period: string;
  courseName: string;
  teacher: string;
  room: string;
  days: string;
}

function parseScheduleHtml(html: string): ScheduleCourse[] {
  const courses: ScheduleCourse[] = [];

  // Find the schedule table specifically
  const tableM = html.match(/<table[^>]+id="plnMain_dgSchedule"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableM) return courses;

  const tableHtml = tableM[1];
  const rowRe = /<tr[^>]+class="sg-asp-table-data-row"[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowM;

  while ((rowM = rowRe.exec(tableHtml)) !== null) {
    const row = rowM[1];
    const cells: string[] = [];
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellM;
    while ((cellM = cellRe.exec(row)) !== null) {
      cells.push(decodeHtml(stripTags(cellM[1])).replace(/\s+/g, ' ').trim());
    }
    // Columns: 0=CourseCode, 1=Description, 2=Period, 3=Teacher, 4=Room, 5=Days
    if (cells.length >= 5 && cells[1]) {
      courses.push({
        period:     cells[2] || '',
        courseName: cells[1] || '',
        teacher:    cells[3] || '',
        room:       cells[4] || '',
        days:       cells[5] || '',
      });
    }
  }
  return courses;
}

export async function hacFetchSchedule(): Promise<ScheduleCourse[] | null> {
  try {
    const resp = await doFetch(`${currentBaseUrl}/HomeAccess/Content/Student/Classes.aspx`);
    const url: string = (resp as any).url ?? '';
    console.log('📅 schedule url:', url);
    if (url.includes('/LogOn') || url.includes('/Account/')) {
      console.warn('📅 schedule: redirected to login');
      return null;
    }
    const html = await resp.text();
    console.log('📅 schedule html length:', html.length);
    console.log('📅 schedule has table:', html.includes('plnMain_dgSchedule'));
    console.log('📅 schedule html snippet:', html.substring(0, 500));
    if (html.includes('LogOnDetails.UserName')) {
      console.warn('📅 schedule: login form detected');
      return null;
    }
    const courses = parseScheduleHtml(html);
    console.log('📅 schedule parsed courses:', courses.length, courses);
    return courses.length > 0 ? courses : null;
  } catch (e) {
    console.error('📅 hacFetchSchedule error:', e);
    return null;
  }
}

// ─── Attendance ────────────────────────────────────────────────────────────────

const ATT_MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function parseAttendanceMonthView(html: string): AttendanceMonthData | null {
  if (html.includes('LogOnDetails.UserName')) return null;

  // ── Month/year ──────────────────────────────────────────────────────────
  const monthRe = new RegExp(`(${ATT_MONTH_NAMES.join('|')})\\s+(\\d{4})`, 'i');
  const monthM = html.match(monthRe);
  if (!monthM) return null;
  const monthIdx = ATT_MONTH_NAMES.findIndex(m => m.toLowerCase() === monthM[1].toLowerCase());
  if (monthIdx === -1) return null;
  const month = monthIdx + 1;
  const year  = parseInt(monthM[2], 10);
  const monthName = `${ATT_MONTH_NAMES[monthIdx]} ${year}`;

  // ── Navigation ──────────────────────────────────────────────────────────
  // HAC uses ASP.NET Calendar control — both nav links share the same EVENTTARGET
  // but differ in EVENTARGUMENT ('V9528' for prev, 'V9587' for next).
  const pbRe = /javascript:__doPostBack\('([^']+)','(V\d+)'\)/gi;
  let pbM: RegExpExecArray | null;
  const navLinks: { target: string; arg: string }[] = [];
  while ((pbM = pbRe.exec(html)) !== null) {
    navLinks.push({ target: pbM[1], arg: pbM[2] });
  }
  const calTarget = navLinks[0]?.target ?? 'ctl00$plnMain$cldAttendance';
  const prevArg   = navLinks[0]?.arg ?? '';
  const nextArg   = navLinks[1]?.arg ?? '';

  // ── Hidden inputs ────────────────────────────────────────────────────────
  const hiddenInputs = extractAllHiddenInputs(html);

  // ── Color legend (parse HAC's embedded legend) ───────────────────────────
  const legend: { color: string; label: string }[] = [];
  const legRe = /background-color:\s*(#[0-9a-fA-F]{6})[^>]*>(?:&nbsp;|\s)+<\/span>\s*<span>([^<]+)<\/span>/gi;
  let legM: RegExpExecArray | null;
  while ((legM = legRe.exec(html)) !== null) {
    legend.push({ color: legM[1].toLowerCase(), label: decodeHtml(legM[2].trim()) });
  }

  // ── Calendar cells ───────────────────────────────────────────────────────
  // HAC encodes attendance as background-color on each <td> + a title attribute.
  // We search raw HTML directly — avoids nested-table regex truncation issues
  // (non-greedy [\s\S]*? stops at the nav table's </table>, cutting off day rows).
  const days: AttendanceDay[] = [];

  const cellRe = /<td([^>]*)>(\d{1,2})<\/td>/gi;
  let cellM: RegExpExecArray | null;

  while ((cellM = cellRe.exec(html)) !== null) {
    const cellAttrs = cellM[1];
    const dayNum    = parseInt(cellM[2], 10);
    if (dayNum < 1 || dayNum > 31) continue;

    // Must have an explicit background-color (plain school days have none)
    const bgM  = cellAttrs.match(/background-color:\s*(#[0-9a-fA-F]{6})/i);
    if (!bgM) continue;
    const color = bgM[1].toLowerCase();

    // #cccccc = school closed / weekend — not an attendance event
    if (color === '#cccccc') continue;

    // title carries the description; HAC sometimes omits the opening quote
    const titleM = cellAttrs.match(/title=["']?([^"'>]+)/i);
    let description = titleM ? decodeHtml(titleM[1]) : '';
    description = description.replace(/["']+$/, '').replace(/^Attendance:\s*/i, '').trim();

    days.push({
      day: dayNum,
      date: `${year}-${String(month).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`,
      color,
      description,
    });
  }

  return { year, month, monthName, days, calTarget, prevArg, nextArg, hiddenInputs, legend };
}

const ATTENDANCE_URL = () => `${currentBaseUrl}/HomeAccess/Content/Attendance/MonthlyView.aspx`;

export async function hacFetchAttendanceMonth(): Promise<AttendanceMonthData | null> {
  try {
    const resp = await doFetch(ATTENDANCE_URL());
    const url: string = (resp as any).url ?? '';
    if (url.includes('/LogOn') || url.includes('/Account/')) return null;
    const html = await resp.text();
    return parseAttendanceMonthView(html);
  } catch (e) {
    console.error('hacFetchAttendanceMonth error:', e);
    return null;
  }
}

export async function hacNavigateAttendanceMonth(
  direction: 'prev' | 'next',
  current: AttendanceMonthData,
): Promise<AttendanceMonthData | null> {
  try {
    const eventArg = direction === 'prev' ? current.prevArg : current.nextArg;
    const fields: Record<string, string> = {
      ...current.hiddenInputs,
      __EVENTTARGET:   current.calTarget,
      __EVENTARGUMENT: eventArg,
    };
    const resp = await doFetch(ATTENDANCE_URL(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildFormBody(fields),
    });
    const html = await resp.text();
    return parseAttendanceMonthView(html);
  } catch (e) {
    console.error('hacNavigateAttendanceMonth error:', e);
    return null;
  }
}
