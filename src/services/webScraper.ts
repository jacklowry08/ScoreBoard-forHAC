/**
 * Client-side HAC scraper using WebView
 */

export interface Grade {
  id: string;
  courseCode: string;
  className: string;
  percentage: number;
  letterGrade: string;
  period?: number;
}

export interface Assignment {
  name: string;
  category: string;
  dateDue: string;
  score: string;
  points: string;
  weight: string;
}

export const CHECK_LOGIN_ERROR_SCRIPT = `
(function() {
  function sendToApp(type, data) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type, data }));
  }
  const errorDiv = document.querySelector('.validation-summary-errors');
  const errorText = document.querySelector('.field-validation-error');
  const errorMessage = document.querySelector('.ErrorMessage');
  if (errorDiv || errorText || errorMessage) {
    const message = errorDiv?.textContent || errorText?.textContent || errorMessage?.textContent || '';
    sendToApp('login_error', { message: message.trim() });
    return;
  }
  const loginForm = document.querySelector('input[name="LogOnDetails.UserName"]');
  if (loginForm) {
    sendToApp('login_error', { message: 'Invalid username or password' });
  }
})();
`;

export function getLoginScript(username: string, password: string): string {
  return `
    (function() {
      const userField = document.querySelector('input[name="LogOnDetails.UserName"]');
      const passField = document.querySelector('input[name="LogOnDetails.Password"]');
      const dbField = document.querySelector('input[name="Database"]');
      const form = document.querySelector('form');
      let submitBtn = document.querySelector('input[type="submit"]');
      if (!submitBtn) submitBtn = document.querySelector('button[type="submit"]');
      if (userField && passField) {
        userField.value = ${JSON.stringify(username)};
        passField.value = ${JSON.stringify(password)};
        if (dbField) dbField.value = '10';
        if (submitBtn) { submitBtn.click(); } else if (form) { form.submit(); }
      }
    })();
  `;
}

export const NAVIGATE_TO_GRADES = `
  window.location.href = 'https://homeaccess.stjohns.k12.fl.us/HomeAccess/Content/Student/Assignments.aspx';
`;

/**
 * Scrapes grades from the currently loaded Assignments.aspx page.
 * HAC format: "0708400 - 1    AP Spanish Lang & Cult" / "Average 84"
 */
export const SCRAPER_SCRIPT = `
(function() {
  var hacErr = sessionStorage.getItem('__hacFetchErr');
  if (hacErr) {
    sessionStorage.removeItem('__hacFetchErr');
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'fetch_error', data: { msg: hacErr } }));
  }
  var grades = [];
  document.querySelectorAll('.AssignmentClass').forEach(function(div, i) {
    var nameElem = div.querySelector('a.sg-header-heading');
    var gradeElem = div.querySelector('span.sg-header-heading.sg-right');
    if (nameElem && gradeElem) {
      var fullName = nameElem.textContent.trim();
      var gradeText = gradeElem.textContent.trim();
      var courseCodeMatch = fullName.match(/^(\\d+)/);
      var courseCode = courseCodeMatch ? courseCodeMatch[1] : '';
      var nameMatch = fullName.match(/^\\d+ - \\d+\\s+(.+)/);
      var className = nameMatch ? nameMatch[1].trim() : fullName;
      var pctMatch = gradeText.match(/Average\\s+(\\d+)/);
      var percentage = pctMatch ? parseInt(pctMatch[1]) : 0;
      var letter = 'F';
      if (percentage >= 90) letter = 'A';
      else if (percentage >= 80) letter = 'B';
      else if (percentage >= 70) letter = 'C';
      else if (percentage >= 60) letter = 'D';
      grades.push({ id: 'class_' + i, courseCode: courseCode, className: className, percentage: percentage, letterGrade: letter });
    }
  });
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'grades', data: grades }));
})();
`;

/**
 * Auto-detect the current marking period from the dropdown, send 'period_detected',
 * then scrape grades from the live DOM.
 */
export const AUTO_DETECT_AND_SCRAPE_SCRIPT = `
(function() {
  try {
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', msg: 'auto_detect_started url=' + window.location.href }));
  var MAX_ATTEMPTS = 10;
  var attempt = 0;

  function scrapeGrades() {
    var grades = [];
    document.querySelectorAll('.AssignmentClass').forEach(function(div, i) {
      var nameElem = div.querySelector('a.sg-header-heading');
      var gradeElem = div.querySelector('span.sg-header-heading.sg-right');
      if (nameElem && gradeElem) {
        var fullName = nameElem.textContent.trim();
        var gradeText = gradeElem.textContent.trim();
        var courseCodeMatch = fullName.match(/^(\\d+)/);
        var courseCode = courseCodeMatch ? courseCodeMatch[1] : '';
        var nameMatch = fullName.match(/^\\d+ - \\d+\\s+(.+)/);
        var className = nameMatch ? nameMatch[1].trim() : fullName;
        var pctMatch = gradeText.match(/Average\\s+(\\d+)/);
        var percentage = pctMatch ? parseInt(pctMatch[1]) : 0;
        var letter = 'F';
        if (percentage >= 90) letter = 'A';
        else if (percentage >= 80) letter = 'B';
        else if (percentage >= 70) letter = 'C';
        else if (percentage >= 60) letter = 'D';
        grades.push({ id: 'class_' + i, courseCode: courseCode, className: className, percentage: percentage, letterGrade: letter });
      }
    });
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'grades', data: grades }));
  }

  function tryDetect() {
    var sel = document.getElementById('plnMain_ddlReportCardRuns');
    if (!sel && attempt < MAX_ATTEMPTS) { attempt++; setTimeout(tryDetect, 1000); return; }
    var numPeriods = sel ? Math.max(sel.options.length - 1, 1) : 4;
    var currentIdx = (sel && sel.selectedIndex > 0) ? sel.selectedIndex : numPeriods;
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'period_detected',
      data: { selectedPeriod: currentIdx, numPeriods: numPeriods }
    }));
    setTimeout(scrapeGrades, 300);
  }

  tryDetect();
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', msg: 'auto_detect_error: ' + String(e) }));
  }
})();
true;
`;

/**
 * Sets a sessionStorage flag identifying the target period value, then submits
 * the ASP.NET form to reload Assignments.aspx with that period.
 *
 * After the reload, inject CHECK_AND_SCRAPE_SCRIPT — it reads the flag and
 * scrapes the freshly loaded page. Any duplicate WKWebView nav events that fire
 * before the real reload won't have the flag and will silently no-op.
 */
export function getPeriodSubmitFormScript(periodIndex: number): string {
  return `
(function() {
  var MAX_ATTEMPTS = 10;
  var attempt = 0;

  function trySubmit() {
    var sel = document.getElementById('plnMain_ddlReportCardRuns');
    if (!sel && attempt < MAX_ATTEMPTS) { attempt++; setTimeout(trySubmit, 1000); return; }
    var targetIdx = ${periodIndex};
    var targetValue = (sel && sel.options[targetIdx]) ? sel.options[targetIdx].value : null;
    if (!targetValue) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'grades', data: [] }));
      return;
    }
    var form = document.getElementById('aspnetForm') || document.querySelector('form');
    if (sel) sel.selectedIndex = targetIdx;
    var et = document.getElementById('__EVENTTARGET');
    var ea = document.getElementById('__EVENTARGUMENT');
    if (et) et.value = 'ctl00$plnMain$btnRefreshView';
    if (ea) ea.value = '';
    // Flag must be set BEFORE submit so it survives into the next page load.
    try { sessionStorage.setItem('__hacPeriodPending', targetValue); } catch(e) {}
    if (form) form.submit();
  }

  trySubmit();
})();
true;
`;
}

/**
 * Shared JS fragment that extracts assignment rows from one .AssignmentClass div.
 * Inlined into both full-scrape scripts below (no shared runtime between injections).
 */
function _assignmentExtractorJS(): string {
  return `
    function extractClassAssignments(div) {
      var rows = div.querySelectorAll('tr.sg-asp-table-data-row');
      var assignments = [];
      rows.forEach(function(row) {
        var titleElem = row.querySelector('a[title^="Title:"]');
        var cells = row.querySelectorAll('td');
        if (titleElem && cells.length >= 6) {
          var titleAttr = titleElem.getAttribute('title') || '';
          var titleMatch = titleAttr.match(/Title:\\s*Assignment Course[^:]*:\\s*(.+?)(?:\\s+Category:|$)/);
          var categoryMatch = titleAttr.match(/Category:\\s*(.+?)(?:\\s+Due Date:|$)/);
          var dueDateMatch = titleAttr.match(/Due Date:\\s*(.+?)(?:\\s+Max Points:|$)/);
          var name = titleMatch ? titleMatch[1].trim() : '';
          var category = categoryMatch ? categoryMatch[1].trim() : '';
          var dateDue = dueDateMatch ? dueDateMatch[1].trim() : '';
          var score = cells[4].textContent.trim();
          var points = cells[5].textContent.trim();
          if (name) {
            assignments.push({ name: name, category: category, dateDue: dateDue,
              score: score || 'N/A', points: points || 'N/A' });
          }
        }
      });
      return assignments;
    }
  `;
}

/**
 * Shared JS fragment that extracts both grades and all assignment rows from the
 * current Assignments.aspx DOM. Returns a { grades, assignments } payload.
 */
function _gradeAndAssignmentExtractorJS(): string {
  return `
    ${_assignmentExtractorJS()}
    function extractAllData() {
      var grades = [];
      var allAssignments = {};
      var classDivs = Array.from(document.querySelectorAll('.AssignmentClass'));
      classDivs.forEach(function(div, i) {
        var nameElem = div.querySelector('a.sg-header-heading');
        var gradeElem = div.querySelector('span.sg-header-heading.sg-right');
        if (nameElem && gradeElem) {
          var fullName = nameElem.textContent.trim();
          var gradeText = gradeElem.textContent.trim();
          var courseCodeMatch = fullName.match(/^(\\d+)/);
          var courseCode = courseCodeMatch ? courseCodeMatch[1] : '';
          var nameMatch = fullName.match(/^\\d+ - \\d+\\s+(.+)/);
          var className = nameMatch ? nameMatch[1].trim() : fullName;
          var pctMatch = gradeText.match(/Average\\s+(\\d+)/);
          var percentage = pctMatch ? parseInt(pctMatch[1]) : 0;
          var letter = 'F';
          if (percentage >= 90) letter = 'A';
          else if (percentage >= 80) letter = 'B';
          else if (percentage >= 70) letter = 'C';
          else if (percentage >= 60) letter = 'D';
          grades.push({ id: 'class_' + i, courseCode: courseCode, className: className,
            percentage: percentage, letterGrade: letter });
        }
        allAssignments['class_' + i] = extractClassAssignments(div);
      });
      return { grades: grades, allAssignments: allAssignments };
    }
  `;
}

/**
 * Like AUTO_DETECT_AND_SCRAPE_SCRIPT but also extracts every class's assignments
 * in the same page load. Posts { type:'full_scrape', grades, assignments }.
 */
export const AUTO_DETECT_AND_FULL_SCRAPE_SCRIPT = `
(function() {
  try {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', msg: 'full_detect_started' }));
    var MAX_ATTEMPTS = 10;
    var attempt = 0;
    ${_gradeAndAssignmentExtractorJS()}

    function tryDetect() {
      var sel = document.getElementById('plnMain_ddlReportCardRuns');
      if (!sel && attempt < MAX_ATTEMPTS) { attempt++; setTimeout(tryDetect, 1000); return; }
      var numPeriods = sel ? Math.max(sel.options.length - 1, 1) : 4;
      var currentIdx = (sel && sel.selectedIndex > 0) ? sel.selectedIndex : numPeriods;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'period_detected',
        data: { selectedPeriod: currentIdx, numPeriods: numPeriods }
      }));
      setTimeout(function() {
        var result = extractAllData();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'full_scrape', grades: result.grades, assignments: result.allAssignments
        }));
      }, 300);
    }

    tryDetect();
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', msg: 'full_detect_error: ' + String(e) }));
  }
})();
true;
`;

/**
 * Like CHECK_AND_SCRAPE_SCRIPT but also extracts every class's assignments.
 * Posts { type:'full_scrape', grades, assignments, periodVal }.
 */
export const CHECK_AND_FULL_SCRAPE_SCRIPT = `
(function() {
  try {
    // M2/M4 disambiguation: auto-click Continue WITHOUT consuming the sessionStorage
    // flag so it's still available on the next page load.
    var continueBtn = null;
    var allBtns = document.querySelectorAll('input[type=submit], input[type=button], button');
    for (var i = 0; i < allBtns.length; i++) {
      var t = (allBtns[i].value || allBtns[i].textContent || '').trim();
      if (t === 'Continue') { continueBtn = allBtns[i]; break; }
    }
    if (continueBtn) {
      var selects = document.querySelectorAll('select');
      for (var j = 0; j < selects.length; j++) {
        var sel = selects[j];
        for (var k = 0; k < sel.options.length; k++) {
          if (sel.options[k].value.charAt(0) === 'D') { sel.selectedIndex = k; break; }
        }
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', msg: 'full_check: disambiguation, continuing' }));
      continueBtn.click();
      return;
    }

    var pending = sessionStorage.getItem('__hacPeriodPending');
    if (!pending) return;
    sessionStorage.removeItem('__hacPeriodPending');

    ${_gradeAndAssignmentExtractorJS()}
    var result = extractAllData();
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'full_scrape', grades: result.grades, assignments: result.allAssignments, periodVal: pending
    }));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', msg: 'check_full_error: ' + String(e) }));
  }
})();
true;
`;

/**
 * Checks sessionStorage for a pending period flag (set by getPeriodSubmitFormScript).
 * If found, scrapes grades from the current page and sends them.
 * Safe to inject on any Assignments.aspx load — no-op if no flag is present.
 */
export const CHECK_AND_SCRAPE_SCRIPT = `
(function() {
  try {
    // Check for the sub-period disambiguation form (shown for M2/M4 which have
    // both a marking period and a semester sub-period). Auto-select the D option
    // (marking period) and click Continue WITHOUT consuming the sessionStorage flag
    // so it's available on the next load.
    var continueBtn = null;
    var allBtns = document.querySelectorAll('input[type=submit], input[type=button], button');
    for (var i = 0; i < allBtns.length; i++) {
      var t = (allBtns[i].value || allBtns[i].textContent || '').trim();
      if (t === 'Continue') { continueBtn = allBtns[i]; break; }
    }
    if (continueBtn) {
      var selects = document.querySelectorAll('select');
      for (var j = 0; j < selects.length; j++) {
        var sel = selects[j];
        for (var k = 0; k < sel.options.length; k++) {
          if (sel.options[k].value.charAt(0) === 'D') { sel.selectedIndex = k; break; }
        }
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', msg: 'check_scrape: disambiguation found, auto-continuing' }));
      continueBtn.click();
      return;
    }

    var pending = sessionStorage.getItem('__hacPeriodPending');
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', msg: 'check_and_scrape pending=' + pending }));
    if (!pending) return;
    sessionStorage.removeItem('__hacPeriodPending');
    var grades = [];
    document.querySelectorAll('.AssignmentClass').forEach(function(div, i) {
      var nameElem = div.querySelector('a.sg-header-heading');
      var gradeElem = div.querySelector('span.sg-header-heading.sg-right');
      if (nameElem && gradeElem) {
        var fullName = nameElem.textContent.trim();
        var gradeText = gradeElem.textContent.trim();
        var courseCodeMatch = fullName.match(/^(\\d+)/);
        var courseCode = courseCodeMatch ? courseCodeMatch[1] : '';
        var nameMatch = fullName.match(/^\\d+ - \\d+\\s+(.+)/);
        var className = nameMatch ? nameMatch[1].trim() : fullName;
        var pctMatch = gradeText.match(/Average\\s+(\\d+)/);
        var percentage = pctMatch ? parseInt(pctMatch[1]) : 0;
        var letter = 'F';
        if (percentage >= 90) letter = 'A';
        else if (percentage >= 80) letter = 'B';
        else if (percentage >= 70) letter = 'C';
        else if (percentage >= 60) letter = 'D';
        grades.push({ id: 'class_' + i, courseCode: courseCode, className: className, percentage: percentage, letterGrade: letter });
      }
    });
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'grades', data: grades, periodVal: pending }));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', msg: 'check_scrape_error: ' + String(e) }));
  }
})();
true;
`;
