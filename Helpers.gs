/**
 * BDL REVENUE AUDIT BACKEND
 * Shared Helper Functions
 */

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function logAttempt(e, key) {
  const logSheet = getOrCreateSheet(SHEETS.LOGS, ['Timestamp', 'Action', 'Key Attempted', 'Method']);
  let action = e.parameter ? e.parameter.action : "Unknown";
  try { if (e.postData) action = JSON.parse(e.postData.contents).action || action; } catch(err) {}
  logSheet.appendRow([new Date(), action, key, e.postData ? 'POST' : 'GET']);
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  } else if (headers && headers.length > 0) {
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const missing = headers.filter(h => !existingHeaders.includes(h));
    if (missing.length > 0) {
      sheet.getRange(1, existingHeaders.length + 1, 1, missing.length).setValues([missing]);
    }
  }
  return sheet;
}

function restoreCalculatorLead(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), delSheet = ss.getSheetByName(SHEETS.DELETED);
  const leadSheet = getOrCreateSheet(SHEETS.CALC_LEADS, DEFAULT_CALC_LEAD_HEADERS);
  if (!delSheet) return { success: false, error: "Trash is empty" };
  const data = delSheet.getDataRange().getValues(), headers = data[0], idCol = headers.indexOf('id');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(id)) {
      leadSheet.appendRow(data[i]); delSheet.deleteRow(i + 1); return { success: true };
    }
  }
  return { success: false, error: "Lead not found" };
}

/**
 * Verifies email domain legitimacy by looking up active MX records using Google's free Public DNS API.
 * @param {string} email The email address to verify.
 * @returns {boolean} True if the domain is valid and configured to receive mail.
 */
function isValidEmailDomain(email) {
  try {
    const parts = email.split('@');
    if (parts.length !== 2) return false;
    const domain = parts[1].trim();
    
    // DNS over HTTPS MX records lookup
    const url = 'https://dns.google/resolve?name=' + encodeURIComponent(domain) + '&type=MX';
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());
    
    return !!(data && data.Answer && data.Answer.length > 0);
  } catch (e) {
    return true; // Fallback to avoid false negatives on network failures
  }
}