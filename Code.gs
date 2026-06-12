/**
 * BDL REVENUE AUDIT BACKEND
 * Handles Calculator leads, Admin actions, and 90-Day Tracker data.
 */ 

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const SHEETS = {
  LEADS: "Leads",
  LOGS: "Logs",
  TRACKER: "Tracker",
  CALC_LEADS: "Calculator Leads",
  CONFIG: "Config",
  ARCHIVED: "Archived",
  DELETED: "Deleted",
  CLIENTS: "Clients",
  TRACKER: "Tracker", // Ensure Tracker is defined here
  LOGS: "Logs", // Ensure Logs is defined here
  VERIFIED: "Verified Payments" // Added for clarity
};
const DEFAULT_CALC_LEAD_HEADERS = ['id','date','name','email','phone','business','niche','street','city','state','zip','country','website','monthlyRevenue','employees','googleRating','googleReviews','totalLeakage','annualLeakage','leakageBreakdown','platforms','paidReport','reportRequestDate','contacted','notes','paymentReference','calculationInputs','userAgent','timeOnPage'];
const DEFAULT_VERIFIED_HEADERS = ['Reference', 'Email', 'Business', 'Niche', 'Leakage', 'Amount', 'Date', 'Status'];

const DEFAULT_TRACKER_HEADERS = ['Tracker ID', 'Data'];
const SETTINGS = {
  REPORT_PRICE: 47,
  ADMIN_EMAIL: "jamescluster35@gmail.com",
  ADMIN_DASHBOARD_URL: "https://your-domain.com/admin.html"
};
 
/**
 * Retrieves the admin password from the 'Config' sheet.
 * The password is expected to be in cell A1 of the 'Config' sheet.
 * @returns {string} The admin password or "SHEET_NOT_FOUND" if the sheet does not exist.
 */
function getAdminPassword() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CONFIG);
  if (!sheet) return "SHEET_NOT_FOUND";
  return String(sheet.getRange('A1').getValue());
}

/**
 * Retrieves the global payment link (Wise/Stripe/LemonSqueezy) from 'Config' sheet cell A2.
 */
function getGlobalPaymentLink() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CONFIG);
  if (!sheet) return "https://wise.com/pay/your-default-link"; // Fallback
  return String(sheet.getRange('A2').getValue());
}

/**
 * Retrieves the webhook signing secret from 'Config' sheet cell A3.
 */
function getWebhookSecret() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CONFIG);
  if (!sheet) return "";
  return String(sheet.getRange('A3').getValue()).trim();
}

/**
 * Entry point for HTTP GET requests. Delegates to handleRequest.
 * @param {GoogleAppsScript.Events.DoGet} e The event object for a GET request.
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function doGet(e) { return handleRequest(e); }
/** 
 * Entry point for HTTP POST requests. Delegates to handleRequest.
 * @param {GoogleAppsScript.Events.DoPost} e The event object for a POST request.
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function doPost(e) { return handleRequest(e); }

/**
 * Handles incoming web requests (GET or POST) by routing them to appropriate functions
 * based on the 'action' parameter. Includes authentication and error handling.
 *
 * @param {GoogleAppsScript.Events.DoGet|GoogleAppsScript.Events.DoPost} e The event object from the web request.
 * @returns {GoogleAppsScript.Content.TextOutput} A JSON string containing the result or an error message.
 */
function handleRequest(e) {
  const event = e || {};
  const data = (event.postData && event.postData.contents) ? JSON.parse(event.postData.contents) : {};
  let action = data.action || (event.parameter ? event.parameter.action : null);
  
  // Unified authentication check
  const authKey = data.key || data.password || (event.parameter ? event.parameter.key : "");

  if (!action && data && data.data && data.data.id && data.data.attributes) {
    action = 'webhookPayment';
  }

  const protectedActions = [
    'getAll', 'moveLead', 'deleteLead', 'archiveLead', 'promoteClient', 'restoreLead',
    'getCalculatorLeads', 'updateCalculatorLead', 'markPaymentPaid', 'deleteCalculatorLead', 
    'generateAndSendReport', 'sendFollowUpEmails', 'sendPaymentRequestEmail', 'getLeadPdf', 'dailyBackupToDrive'
  ];

  if (protectedActions.includes(action) && authKey !== getAdminPassword()) {
    if (action) logAttempt(event, authKey);
    return jsonResponse({ success: false, error: 'Unauthorized: Access Denied' });
  }

  const router = {
    // CRM Actions
    'getAll': getAll,
    'addLead': addLead,
    'updateLead': (data) => updateLead(data.id, data.changes, data.tab || SHEETS.LEADS),
    'moveLead': (data) => moveLead(data.id, data.fromTab, data.toTab, data.changes || {}),
    'deleteLead': (data) => moveLead(data.id, data.fromTab, SHEETS.DELETED, {}),
    'archiveLead': (data) => moveLead(data.id, SHEETS.LEADS, SHEETS.ARCHIVED, {}),
    'promoteClient': (data) => moveLead(data.id, SHEETS.LEADS, SHEETS.CLIENTS, {}),
    'restoreLead': (data) => moveLead(data.id, data.fromTab, SHEETS.LEADS, { status: 'New' }),
    
    // Calculator Actions
    'saveCalculatorLead': (data) => saveCalculatorLead(data.lead),
    'getCalculatorLeads': getCalculatorLeads,
    'updateCalculatorLead': (data) => updateCalculatorLead(data.id || data.email, data.changes || {}),
    'markPaymentPaid': (data) => markPaymentPaid(data.id || data.email, data.changes || {}),
    'deleteCalculatorLead': (data) => deleteCalculatorLead(data.id || data.email),
    'restoreCalculatorLead': (data) => restoreCalculatorLead(data.id),
    'getDeletedLeads': getDeletedLeads,
    
    // Email & Payment Actions
    'generateAndSendReport': (data) => generateAndSendReport(data.lead, data.email, data.note, data.subject, data.htmlBody),
    'sendFollowUpEmails': (data) => sendFollowUpEmails(data.lead, data.email),
    'sendPaymentRequestEmail': (data) => sendPaymentRequestEmail(data.lead, data.email, data.wiseLink),
    'verifyPayment': (data) => verifyPayment(data.orderId, data.email),
    'webhookPayment': (data) => webhookPayment(data, event),
    'getLeadPdf': (data) => getLeadPdf(data.lead, data.note),
    
    // Tracker Actions
    'getTrackerData': (data) => getTracker(data.trackerId),
    'saveTrackerData': (data) => saveTracker(data.trackerId, data.tracker),

    // Admin Actions
    'dailyBackupToDrive': dailyBackupToDrive,
  };

  try {
    let result;
    const handler = router[action];
    if (handler) {
      result = handler(data);
    } else {
      result = { error: 'Unknown action: ' + action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message, stack: err.stack });
  }
}

/**
 * Retrieves tracker data for a specific lead.
 * It fetches lead information from 'Calculator Leads' and saved tracker progress from 'Tracker' sheet.
 * Also sends an admin notification when a tracker is viewed.
 * @param {string} trackerId The ID of the tracker (usually the lead's ID).
 * @returns {object} A JSON response containing success status, lead data, and tracker data, or an error message.
 */
function getTracker(trackerId) {
  const leadSheet = getOrCreateSheet(SHEETS.CALC_LEADS, DEFAULT_CALC_LEAD_HEADERS); // Use utility function
  const trackerSheet = getOrCreateSheet(SHEETS.TRACKER, DEFAULT_TRACKER_HEADERS);
  
  // Get Lead Info
  const leads = leadSheet.getDataRange().getValues(); // Get all data from lead sheet
  const headers = leads.shift();
  let lead = null;
  for (let row of leads) {
    if (row[0] == trackerId) { // Using lead ID as tracker ID
      lead = {};
      headers.forEach((h, i) => lead[h] = row[i]);
      break;
    }
  }

  if (!lead) return jsonResponse({ error: 'Tracker not found' });

  // Engagement alert to admin
  try {
    const adminEmail = SETTINGS.ADMIN_EMAIL; 
    const adminDashboardUrl = SETTINGS.ADMIN_DASHBOARD_URL;
    const subject = "👀 Tracker Viewed: " + (lead.business || "Unknown Business");
    const body = `The 90-day action tracker for ${lead.business} (${lead.email}) has just been viewed.\n\n` +
                 `View Time: ${new Date().toLocaleString()}\n\n` +
                 `View Lead in Admin: ${adminDashboardUrl}?search=${encodeURIComponent(lead.email)}`;
    
    MailApp.sendEmail(adminEmail, subject, body);
  } catch (e) {
    Logger.log("Tracker notification error: " + e.toString()); // Log error if notification fails
  }

  // Get Saved Progress
  const progressData = trackerSheet.getDataRange().getValues();
  let tracker = {};
  for (let row of progressData) {
    if (row[0] == trackerId) {
      try { tracker = JSON.parse(row[1]); } catch(e) {}
      break;
    }
  }
 
  return jsonResponse({ success: true, lead: lead, tracker: tracker });
}

/**
 * Creates a JSON response object suitable for Google Apps Script web apps.
 * @param {object} obj The object to be converted to a JSON string.
 * @returns {GoogleAppsScript.Content.TextOutput} A TextOutput object with JSON MIME type.
 */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Logs unauthorized access attempts to a 'Logs' sheet.
 * If the 'Logs' sheet does not exist, it will be created.
 * @param {GoogleAppsScript.Events.DoGet|GoogleAppsScript.Events.DoPost} e The event object from the web request.
 * @param {string} key The key/password attempted by the user.
 */
function logAttempt(e, key) {
  const logSheet = getOrCreateSheet(SHEETS.LOGS, ['Timestamp', 'Action', 'Key Attempted', 'Method']); // Use direct headers
  let action = e.parameter ? e.parameter.action : "Unknown";
  try { if (e.postData) action = JSON.parse(e.postData.contents).action || action; } catch(err) {}
  logSheet.appendRow([new Date(), action, key, e.postData ? 'POST' : 'GET']);
}

// ── CRM Tab Operations ────────────────────────────────
function getAll() {
  return {
    leads:    getTabData(SHEETS.LEADS),
    archived: getTabData(SHEETS.ARCHIVED),
    deleted:  getTabData(SHEETS.DELETED),
    clients:  getTabData(SHEETS.CLIENTS), // Get data from all CRM tabs
  }
}

/**
 * Retrieves all data from a specified sheet, parsing JSON fields and boolean flags.
 * @param {string} tabName The name of the sheet to retrieve data from.
 * @returns {Array<object>} An array of objects, where each object represents a row in the sheet.
 */
function getTabData(tabName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tabName)
  if (!sheet) return []
  const rows = sheet.getDataRange().getValues()
  if (rows.length <= 1) return []
  const headers = rows[0]
  return rows.slice(1).map(row => {
    const lead = {}
    headers.forEach((h, i) => {
      if (h === 'outreachLog' || h === 'contacts') {
        try { lead[h] = JSON.parse(row[i] || '[]') }
        catch { lead[h] = [] }
      } else if (h === 'pitchSent') {
        lead[h] = row[i] === true || row[i] === 'TRUE' || row[i] === 'true'
      } else {
        lead[h] = row[i] === undefined ? '' : row[i]
      }
    })
    return lead
  }).filter(l => l.id && l.id !== '')
}

/**
 * Adds a new lead to the 'Leads' sheet.
 * @param {object} lead An object containing the lead's data.
 * @returns {object} A success status.
 */
function addLead(lead) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.LEADS); // Get Leads sheet
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]; // Get headers
  const row = headers.map(h => { // Map lead object to row values
    if (h === 'outreachLog' || h === 'contacts') return JSON.stringify(lead[h] || []); // Stringify JSON fields
    if (h === 'pitchSent') return lead[h] ? 'TRUE' : 'FALSE'; // Convert boolean to string
    return lead[h] !== undefined ? lead[h] : ''; // Assign other values
  });
  sheet.appendRow(row); // Append new row
  return { success: true }
}

/**
 * Updates an existing lead's data in a specified sheet.
 * @param {string} id The unique ID of the lead to update.
 * @param {object} changes An object containing the fields to update and their new values.
 * @param {string} tabName The name of the sheet where the lead is located.
 * @returns {object} A success status or an error message if the lead or tab is not found.
 */
function updateLead(id, changes, tabName) {
  const sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tabName)
  if (!sheet) return { error: 'Tab not found: ' + tabName }
  const data    = sheet.getDataRange().getValues()
  const headers = data[0]
  const idCol   = headers.indexOf('id')
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      Object.keys(changes).forEach(key => {
        const col = headers.indexOf(key)
        if (col !== -1) {
          let val = changes[key]
          if (key === 'outreachLog' || key === 'contacts') val = JSON.stringify(val)
          if (key === 'pitchSent') val = val ? 'TRUE' : 'FALSE'
          sheet.getRange(i + 1, col + 1).setValue(val)
        }
      })
      return { success: true }
    }
  }
  return { error: 'Lead not found in ' + tabName }
}

/**
 * Moves a lead from one sheet to another, applying optional changes.
 * @param {string} id The unique ID of the lead to move.
 * @param {string} fromTab The name of the source sheet.
 * @param {string} toTab The name of the destination sheet.
 * @param {object} changes Optional. An object containing additional changes to apply to the lead.
 * @returns {object} A success status or an error message if the lead or tabs are not found.
 */
function moveLead(id, fromTab, toTab, changes) {
  const ss       = SpreadsheetApp.getActiveSpreadsheet()
  const fromSheet = ss.getSheetByName(fromTab)
  const toSheet   = ss.getSheetByName(toTab)
  if (!fromSheet || !toSheet) return { error: 'Tab mapping error' }
  const fromData    = fromSheet.getDataRange().getValues()
  const fromHeaders = fromData[0]
  const toHeaders   = toSheet.getRange(1, 1, 1, toSheet.getLastColumn()).getValues()[0]
  const idCol       = fromHeaders.indexOf('id')
  for (let i = 1; i < fromData.length; i++) {
    if (String(fromData[i][idCol]) === String(id)) {
      const lead = {}
      fromHeaders.forEach((h, j) => {
        if (h === 'outreachLog' || h === 'contacts') {
          try { lead[h] = JSON.parse(fromData[i][j] || '[]') }
          catch { lead[h] = [] }
        } else { lead[h] = fromData[i][j] }
      })
      Object.assign(lead, changes)
      const newRow = toHeaders.map(h => {
        if (h === 'outreachLog' || h === 'contacts') return JSON.stringify(lead[h] || [])
        if (h === 'pitchSent') return lead[h] ? 'TRUE' : 'FALSE'
        return lead[h] !== undefined ? lead[h] : ''
      })
      toSheet.appendRow(newRow)
      fromSheet.deleteRow(i + 1)
      return { success: true }
    }
  }
  return { error: 'Lead not found in ' + fromTab }
}

/**
 * Saves or updates tracker progress for a specific tracker ID.
 * If the tracker ID exists, its data is updated; otherwise, a new entry is appended.
 * @param {string} trackerId The ID of the tracker.
 * @param {object} tracker The tracker data object to save.
 */
function saveTracker(trackerId, tracker) {
  const sheet = getOrCreateSheet(SHEETS.TRACKER, DEFAULT_TRACKER_HEADERS); // Use utility function
  const data = sheet.getDataRange().getValues(); // Re-fetch data after potential header creation
  const stringified = JSON.stringify(tracker);
  
  // Find existing row or append new one
  for (let i = 0; i < data.length; i++) { // Start from 0 to include headers in search
    if (String(data[i][0]) === String(trackerId)) {
      sheet.getRange(i + 1, 2).setValue(stringified); // Update existing row
      return { success: true };
    }
  }
  sheet.appendRow([trackerId, stringified]); // Append new row if not found
  return { success: true };
}

/**
 * Saves a new calculator lead or updates an existing one in the 'Calculator Leads' sheet.
 * If the lead's email already exists, the row is updated; otherwise, a new row is appended.
 * Also sends a confirmation email if the lead requested a paid report.
 * @param {object} lead An object containing the calculator lead's data.
 */
function saveCalculatorLead(lead) {
  const sheet = getOrCreateSheet(SHEETS.CALC_LEADS, DEFAULT_CALC_LEAD_HEADERS);

  // Generate a unique ID if one doesn't exist for Foolproof Payment Identification 
  if (!lead.id) { // If lead ID is not provided
    lead.id = 'BDL-' + Math.random().toString(36).substr(2, 6).toUpperCase(); 
  }

  const data = sheet.getDataRange().getValues(); // Get all data
  const headers = data[0]; // Get headers
  const idCol = headers.indexOf('id');
  const emailCol = headers.indexOf('email'); // Get email column index
  if (idCol === -1 || emailCol === -1) return { error: 'Required columns (id/email) missing in sheet' };

  let rowIndex = -1; // Initialize row index
  
  for (let i = 1; i < data.length; i++) {
    if (lead.id && String(data[i][idCol]||'').trim() === String(lead.id)) {
      rowIndex = i + 1;
      break;
    }
    if (lead.email && String(data[i][emailCol]||'').trim().toLowerCase() === String(lead.email).toLowerCase()) {
      rowIndex = i + 1; // Update existing email match
      break;
    }
  }

  if (lead.email) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][emailCol]).toLowerCase() === String(lead.email).toLowerCase()) {
        rowIndex = i + 1;
        break;
      }
    }
  }
  const rowValues = headers.map(h => { // Map lead object to row values
    let val = lead[h] !== undefined ? lead[h] : ''; // Get value from lead object
    if (h === 'phone') return "'" + String(val); // Prefix with ' to force text format in Excel/Sheets
    return val; // Return value
  });
  if (rowIndex > 0) { // If lead exists, update row
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]); // Set new values
  } else { // If lead doesn't exist, append new row
    sheet.appendRow(rowValues); // Append new row
  }
  if (lead.email && lead.email.includes('@') && lead.paidReport === 'Requested') {
    sendInitialPaymentRequestEmail(lead);
  }
  return { success: true };
}

/**
 * Generates a revenue audit report (PDF) and sends it via email.
 * Updates the lead's status in the 'Calculator Leads' sheet after sending.
 * @param {object} lead The lead object for whom the report is generated.
 * @param {string} toEmail The email address to send the report to.
 * @param {string} note A personal note to include in the report.
 * @param {string} subject The subject line for the email.
 * @param {string} htmlBodyOverride Optional HTML body content to override the default.
 * @returns {object} A success status with the report ID, or an error message.
 */
function generateAndSendReport(lead, toEmail, note, subject, htmlBodyOverride) {
  try {
    const bizName = esc(lead.business || 'Your Business');
    const firstName = esc(String(lead.name || 'there').split(' ')[0]);
    const isPaid = ['paid','delivered'].includes(String(lead.paidReport||'').toLowerCase());
    const attachments = [];
    const template = getTemplateForLead(lead);
    const reportId = lead.id || 'N/A';

    if (isPaid) {
      attachments.push(createPdfAttachment(buildFullPdfReportHtml(lead, note), bizName + ' Revenue Leakage Report.pdf'));
    }

    // Use internal generators if no override is provided (standard for Admin Dashboard calls)
    const finalHtml = htmlBodyOverride || (isPaid ? buildFullReportEmailHtml(lead, note, template) : buildSummaryReportEmailHtml(lead, note, template));
    
    // Ensure subject is unique and personalized
    let finalSubject = (subject || (isPaid ? template.subject : ('Your Revenue Audit — ' + bizName)))
      .replace('{bizName}', bizName).replace('{name}', firstName).replace('{id}', reportId);
    
    // Add Ref ID to subject to prevent Gmail threading
    if (!finalSubject.includes(reportId)) finalSubject += ` (Ref: ${reportId})`;

    MailApp.sendEmail({
      to: toEmail,
      subject: finalSubject,
      htmlBody: finalHtml,
      name: 'BDL Revenue Intelligence',
      attachments: attachments
    });
    updateCalculatorLead(lead.id || lead.email, {
      contacted: 'Yes',
      paidReport: isPaid ? 'Delivered' : (lead.paidReport || 'Requested')
    });
    return { success: true, reportId: reportId };
  } catch(err) { return { error: err.message }; }
}

/**
 * Marks a calculator lead as 'Paid' and records the payment in the 'Verified Payments' sheet.
 * It updates the lead's status in 'Calculator Leads' and appends a new row to 'Verified Payments'.
 * @param {string} identifier The ID or email of the lead to mark as paid.
 * @param {object} changes An object containing changes to apply, including paymentReference and amount.
 * @returns {object} A success status or an error message if the lead or sheet is not found.
 */
function markPaymentPaid(identifier, changes) {
  const sheet = getOrCreateSheet(SHEETS.CALC_LEADS, DEFAULT_CALC_LEAD_HEADERS); // Use utility function
  const data = sheet.getDataRange().getValues(); // Re-fetch data after potential header creation
  const headers = data[0]; // Get headers from the fetched data
  const idCol = headers.indexOf('id');
  const emailCol = headers.indexOf('email');
  const lookupValue = String(identifier || '').trim();
  const isEmail = lookupValue.includes('@');
  for (let i = 1; i < data.length; i++) {
    const rowId = String(data[i][idCol]).trim();
    const rowEmail = String(data[i][emailCol]).trim().toLowerCase();
    const matched = (isEmail && rowEmail === lookupValue.toLowerCase()) || (!isEmail && rowId === lookupValue);
    if (matched) {
      Object.keys(changes).forEach(key => {
        const col = headers.indexOf(key);
        if (col !== -1) sheet.getRange(i + 1, col + 1).setValue(changes[key]);
      });
      const verifiedSheet = getOrCreateSheet(SHEETS.VERIFIED, DEFAULT_VERIFIED_HEADERS); // Use utility function
      const lead = headers.reduce((obj, h, j) => { obj[h] = data[i][j]; return obj; }, {});
      const ref = changes.paymentReference || lead.id || 'manual';
      const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      verifiedSheet.appendRow([ref, lead.email, lead.business, lead.niche, lead.totalLeakage, SETTINGS.REPORT_PRICE, date, 'Paid']);
      generateAndSendReport(lead, lead.email, "Payment verified. Your Executive Revenue Diagnostic is attached.", "", null);
      return { success: true };
    }
  }
  return { error: 'Lead not found' };
}

/**
 * Deletes a calculator lead from the 'Calculator Leads' sheet.
 * @param {string} identifier The ID or email of the lead to delete.
 * @returns {object} A success status or an error message if the lead is not found.
 */
function deleteCalculatorLead(identifier) {
  const sheet = getOrCreateSheet(SHEETS.CALC_LEADS, DEFAULT_CALC_LEAD_HEADERS); // Use utility function
  const delSheet = getOrCreateSheet(SHEETS.DELETED, DEFAULT_CALC_LEAD_HEADERS); // Use utility function
  const data = sheet.getDataRange().getValues(); // Re-fetch data after potential header creation
  const headers = data[0]; // Get headers from the fetched data
  const idCol = headers.indexOf('id');
  const emailCol = headers.indexOf('email');
  const lookupValue = String(identifier || '').trim();
  const isEmail = lookupValue.includes('@');
  for (let i = 1; i < data.length; i++) {
    const matched = (isEmail && String(data[i][emailCol]).toLowerCase() === lookupValue.toLowerCase()) || (!isEmail && String(data[i][idCol]).trim() === lookupValue);
    if (matched) {
      delSheet.appendRow(data[i]); // Safe storage: move to Deleted tab instead of hard delete
      sheet.deleteRow(i + 1); 
      return { success: true }; 
    }
  }
  return { error: 'Lead not found' };
}

/**
 * Retrieves all calculator leads from the 'Calculator Leads' sheet.
 * @returns {object} A success status and an array of lead objects, or an empty array if the sheet is empty.
 */
function getCalculatorLeads() {
  const sheet = getOrCreateSheet(SHEETS.CALC_LEADS, DEFAULT_CALC_LEAD_HEADERS); // Use utility function
  const rows = sheet.getDataRange().getValues(); // Re-fetch data after potential header creation
  if (rows.length <= 1) return { success: true, leads: [] }; // Check rows length after fetching
  const headers = rows[0];
  const leads = rows.slice(1).map(row => {
    const lead = {};
    DEFAULT_CALC_LEAD_HEADERS.forEach(h => { // Use default headers for consistent object structure
      const colIndex = headers.indexOf(h);
      lead[String(h).trim()] = colIndex !== -1 ? row[colIndex] || '' : '';
    });
    return lead;
  });
  return { success: true, leads: leads.reverse() };
}

/**
 * Fetches leads specifically from the Deleted tab for the Admin UI.
 */
function getDeletedLeads() {
  const sheet = getOrCreateSheet(SHEETS.DELETED, DEFAULT_CALC_LEAD_HEADERS); // Use utility function
  const rows = sheet.getDataRange().getValues(); // Re-fetch data after potential header creation
  if (rows.length <= 1) return { success: true, leads: [] }; // Check rows length after fetching
  const headers = rows[0];
  const leads = rows.slice(1).map(row => {
    const lead = {};
    DEFAULT_CALC_LEAD_HEADERS.forEach(h => { // Use default headers for consistent object structure
      const colIndex = headers.indexOf(h);
      lead[String(h).trim()] = colIndex !== -1 ? row[colIndex] || '' : '';
    });
    return lead;
  });
  return { success: true, leads: leads.reverse() };
}

/**
 * Normalizes a niche string by converting it to lowercase and removing non-alphanumeric characters.
 * @param {string} niche The niche string to normalize.
 * @returns {string} The normalized niche string.
 */
function normalizeNiche(niche){
  return String(niche||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
}

function verifyPayment(orderId, email) {
  if (!orderId) return { valid: false, error: 'No order ID' };
  const sheet = getOrCreateSheet(SHEETS.VERIFIED, DEFAULT_VERIFIED_HEADERS); // Use utility function
  const data = sheet.getDataRange().getValues(); // Re-fetch data after potential header creation
  const headers = data[0]; // Get headers from the fetched data
  const orderCol = headers.indexOf('Reference'); // Assuming 'Reference' is the order ID column
  const statusCol = headers.indexOf('Status');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][orderCol]) === String(orderId)) {
      const status = String(data[i][statusCol] || '').toLowerCase();
      if (status === 'paid' || status === 'completed') return { valid: true, orderId: orderId };
      return { valid: false, error: 'Payment not completed' };
    }
  }
  return { valid: false, error: 'Order not found' };
}

/**
 * Processes a payment webhook, typically from a service like Lemon Squeezy.
 * Records payment details in the 'Verified Payments' sheet and updates the lead's status in 'Calculator Leads'.
 * @param {object} data The webhook payload data.
 * @param {object} event The raw event object containing headers for signature verification.
 * @returns {object} A success status or an error message.
 */
function webhookPayment(data, event) {
  try {
    // Security Check: Verify HMAC-SHA256 signature from provider
    const secret = getWebhookSecret(); // Retrieve webhook secret from Config 
    if (secret && event && event.postData) {
      const headers = event.headers || {};
      // Standard Lemon Squeezy header is 'x-signature'
      const signature = headers['X-Signature'] || headers['x-signature'];
      
      if (!signature) {
        Logger.log("Webhook rejected: Missing X-Signature header");
        return { error: 'Unauthorized: Missing signature' };
      }

      const hmac = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, event.postData.contents, secret);
      const hash = hmac.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
      
      if (hash !== signature) {
        Logger.log("Webhook rejected: Signature mismatch");
        return { error: 'Unauthorized: Invalid signature' };
      }
    }

    const sheet = getOrCreateSheet(SHEETS.VERIFIED, DEFAULT_VERIFIED_HEADERS); // Use utility function

    const orderId   = data.data?.id || data.orderId || '';
    const email     = data.data?.attributes?.user_email || data.email || '';
    const amount    = data.data?.attributes?.total || SETTINGS.REPORT_PRICE;
    const status    = String(data.data?.attributes?.status || data.status || 'paid').toLowerCase();
    const business  = data.data?.attributes?.custom_data?.business || '';
    const niche     = data.data?.attributes?.custom_data?.niche || '';
    const leakage   = data.data?.attributes?.custom_data?.leakage || '';
    const date      = new Date(); // Store full date object for consistency
    sheet.appendRow([orderId, email, business, niche, leakage, amount, date, status, '']); // calculatorLeadId is empty for webhooks unless custom_data is passed 

    if (email) { // If email is provided
      updateCalculatorLead(email, { paidReport: 'Paid', reportRequestDate: date }); // Update lead status 

      // Automatically trigger high-fidelity report delivery if payment is verified
      if (status === 'paid' || status === 'completed') {
        const leadsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CALC_LEADS);
        const rows = leadsSheet.getDataRange().getValues();
        const headers = rows[0];
        const emailCol = headers.indexOf('email');
        const leadRow = rows.find(r => String(r[emailCol]).toLowerCase() === email.toLowerCase());

        if (leadRow) {
          const lead = headers.reduce((obj, h, i) => { obj[h] = leadRow[i]; return obj; }, {});
          // Ensure the object has the correct status for PDF generation logic  
          lead.paidReport = 'Paid';
          generateAndSendReport(lead, email, "Payment verified. Your Executive Revenue Diagnostic is attached.", "", null);
        }
      }
    }
    return { success: true };
  } catch(err) { return { error: err.message }; }
}

/**
 * Sends an immediate follow-up email (Email 1) to the lead.
 * @param {object} lead The lead object for whom to send follow-up emails.
 * @param {string} toEmail The email address to send the follow-up to.
 * @returns {object} A success status and a message, or an error message.
 */
function sendFollowUpEmails(lead, toEmail){
  try {
    const email1 = buildFollowUpEmail1(lead, toEmail);
    MailApp.sendEmail({ to: toEmail, subject: email1.subject, htmlBody: email1.html, name: 'BDL Revenue Intelligence' }); // Send follow-up email
    return { success: true, message: 'Immediate follow-up email sent.' };
  } catch(err) { return { error: err.message }; }
}

/**
 * Builds the HTML content and subject for the first follow-up email (Week 1 Quick Wins).
 * @param {object} lead The lead object.
 * @param {string} toEmail The recipient email address.
 * @returns {object} An object containing the email subject and HTML body.
 */
function buildFollowUpEmail1(lead, toEmail){
  const bizName = esc(lead.business || 'Your Business');
  const firstName = esc(String(lead.name || 'there').split(' ')[0]);
  const niche = esc(lead.niche || 'General');
  const rules = getNicheCalculationRules(niche); // Use getNicheCalculationRules
  const quickWins = (rules.plan90 || []).filter(function(p){ return p.quick; });
  const quickWinsHtml = quickWins.map(function(item){ // Build HTML for quick wins
    return '<div style="background:#0F1117;border:1px solid #1E2230;padding:14px;margin-bottom:10px;color:#E8EAF0;">'+
      '<b>✓ '+esc(item.action)+'</b><br><span style="font-size:11px;color:#6B7280;">'+esc(item.detail)+'</span></div>';
  }).join('');
  return {
    subject: 'Week 1: 3 Quick Wins for ' + bizName,
    html: `<body style="margin:0;padding:0;background:#08090C;font-family:Arial,sans-serif;color:#E8EAF0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="padding:20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#141720;border-radius:12px;border:1px solid #1E2230;">
              <tr>
                <td style="padding:20px;">
                  <h1 style="color:#F97316;font-size:22px;margin-bottom:15px;font-family:Arial,sans-serif;">Hi ${firstName}, here are your Quick Wins for ${bizName}!</h1>
                  <p style="color:#E8EAF0;font-size:14px;line-height:1.6;margin-bottom:20px;">These are the highest-impact actions you can take in the first 1-2 weeks to start recovering revenue:</p>
                  ${quickWinsHtml}
                  <p style="color:#9CA3AF;font-size:12px;line-height:1.6;margin-top:20px;">For your full 90-day roadmap and detailed analysis, please refer to your Executive Revenue Diagnostic PDF.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>`
  };
}

/**
 * Sends an email to a lead requesting payment for a revenue audit, including a payment link.
 * @param {object} lead The lead object for whom the payment request is sent.
 * @param {string} toEmail The email address to send the payment request to.
 * @param {string} wiseLink The payment link (e.g., Wise, Stripe, Lemon Squeezy).
 * @returns {object} A success status or an error message.
 */
/**
 * Sends a high-fidelity payment request email.
 */
function sendPaymentRequestEmail(lead, toEmail, wiseLink) {
  try {
    const bizName = lead.business || 'Your Business';
    const firstName = String(lead.name || 'there').split(' ')[0];
    const leakage = Number(lead.totalLeakage || 0);
    const reportId = 'BDL-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd') + '-' + (lead.niche || 'GEN').toUpperCase().slice(0, 3);

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #08090C; color: #E8EAF0; border-radius: 16px;">
      <div style="text-align: center; padding: 20px 0;">
        <div style="color: #F97316; font-size: 12px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">BDL REVENUE INTELLIGENCE</div>
      </div>
      <div style="background: #0F1117; border: 1px solid #1E2230; border-radius: 12px; padding: 32px;">
        <h2 style="color: #fff; margin-top: 0; font-size: 22px;">Your Revenue Audit is Ready</h2>
        <p style="color: #9CA3AF; line-height: 1.6; font-size: 14px;">Hi ${firstName}, our analyst team has completed the revenue diagnostic for <strong>${bizName}</strong>.</p>
        
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0;">
          <p style="margin: 0; color: #EF4444; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Identified Monthly Leakage</p>
          <p style="margin: 8px 0; color: #fff; font-size: 42px; font-weight: 800; line-height: 1;">$${leakage.toLocaleString()}</p>
          <p style="margin: 0; color: #6B7280; font-size: 13px;">≈ $${(leakage * 12).toLocaleString()} per year</p>
        </div>

        <div style="background: #141720; border: 1px solid #1E2230; padding: 20px; border-radius: 10px; margin-bottom: 24px;">
          <p style="margin: 0 0 12px; font-weight: bold; font-size: 13px; color: #F97316;">How to Unlock Your Full Audit:</p>
          <p style="margin: 0 0 20px; font-size: 13px; color: #9CA3AF; line-height: 1.5;">
            1. Click the button below to pay via Wise.<br>
            2. Include Reference ID: <strong>${reportId}</strong><br>
            3. Full PDF report delivered within 24 hours.
          </p>
          <a href="${wiseLink}" style="display: block; background: #F97316; color: #fff; text-align: center; padding: 16px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">Unlock Report — $47 USD →</a>
        </div>

        <p style="font-size: 12px; color: #6B7280; text-align: center; margin: 0;">One-time secure payment. Professional Analyst support included.</p>
      </div>
      <p style="text-align: center; font-size: 11px; color: #4B5563; margin-top: 20px;">BDL Revenue Intelligence • Confidential for ${bizName}</p>
    </div>`;

    MailApp.sendEmail({
      to: toEmail,
      subject: `[ACTION REQUIRED] Unlock your Audit Report — ${bizName} (Ref: ${reportId})`,
      htmlBody: html,
      name: 'BDL Revenue Intelligence'
    });
    return { success: true };
  } catch(err) { return { error: err.message }; }
}

/**
 * Builds the Complete High-Fidelity PDF Structure.
 */
function buildFullPdfReportHtml(lead, note) {
  const bizName = esc(lead.business || 'Your Business');
  const calc = calculateLeadLeakage(lead);
  const firstName = String(lead.name || 'there').split(' ')[0];
  const niche = (lead.niche || 'General').toLowerCase();
  const reportId = 'BDL-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd') + '-' + (niche.toUpperCase().slice(0, 3));
  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM dd, yyyy');
  const hColor = calc.score > 75 ? '#10B981' : calc.score > 50 ? '#F59E0B' : '#EF4444';

  // Define Explanations for Niche areas
  const explains = {
    dental: ['Lost revenue from patients not showing up.', 'Missed revenue from overdue hygiene visits.', 'Potential patients lost due to slow phone callbacks.'],
    realestate: ['Lost commissions from lead follow-up delays.', 'Inefficient spend on portals vs conversion.', 'Administrative drag on agent selling time.'],
    general: ['Inefficiencies in sales pipeline conversion.', 'Operational overhead and manual task drag.', 'Missed revenue from unoptimized pricing or follow-up.']
  };
  const nicheExplains = explains[niche] || explains.general;

  const itemsHtml = calc.breakdown.map((item, i) => {
    const col = i === 0 ? '#EF4444' : i === 1 ? '#F97316' : '#F59E0B';
    const share = Math.round(calc.monthlyLeak / Math.max(1, calc.breakdown.length));
    return `
      <div style="margin-bottom:16px; border-left: 4px solid ${col}; background: #f9fafb; padding: 16px; border-radius: 0 12px 12px 0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong style="font-size:14px; color:#111;">${esc(item)}</strong>
          <span style="color:${col}; font-weight:800; font-size:15px;">-$${share.toLocaleString()}/mo</span>
        </div>
        <div style="font-size:12px; color:#666; line-height:1.6;"><strong>Benchmark Analysis:</strong> ${nicheExplains[i] || 'This area represents a significant gap in your revenue capture cycle.'}</div>
      </div>`;
  }).join('');

  const planSteps = (calc.rules.plan90 || []).map((step, i) => `
    <div style="margin-bottom:20px; padding-left:12px; border-left:2px solid #F97316;">
      <div style="background:#1a1a2e; color:#fff; padding:4px 10px; border-radius:4px; font-size:10px; font-weight:bold; display:inline-block; margin-bottom:8px;">WEEK ${step.week}</div>
      <div style="font-weight:bold; font-size:14px; color:#111; margin-bottom:4px;">${esc(step.action)}</div>
      <div style="font-size:12px; color:#555; line-height:1.5;">${esc(step.detail)}</div>
      <div style="color:#10B981; font-weight:bold; font-size:11px; margin-top:6px; text-transform:uppercase;">Expected Impact: ${esc(step.impact)}</div>
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      @page { margin: 15mm; }
      body { font-family: 'Helvetica', Arial, sans-serif; color: #111; line-height: 1.5; margin: 0; padding: 0; }
      .page-break { page-break-before: always; }
      .header { background: #1a1a2e; color: #fff; padding: 30px 24px; display: flex; justify-content: space-between; align-items: center; }
      .brand { color: #F97316; font-size: 12px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; }
      .stat-card { background: #f3f4f6; border-radius: 12px; padding: 20px; text-align: center; flex: 1; border: 1px solid #e5e7eb; }
      .score-circle { border: 4px solid ${hColor}; border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: ${hColor}; font-size: 20px; }
    </style></head>
    <body>
      <div class="header">
        <div>
          <div class="brand">BDL Revenue Intelligence</div>
          <h1 style="margin: 5px 0 0; font-size: 24px;">Executive Revenue Diagnostic</h1>
          <div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">ID: ${reportId} • Issued: ${dateStr}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 16px; font-weight: bold;">${bizName}</div>
          <div style="font-size: 11px; color: #9ca3af;">${esc(lead.city || '')}, ${esc(lead.state || '')}</div>
        </div>
      </div>

      <div style="padding: 24px;">
        <div style="display:flex; gap:16px; margin-bottom: 30px;">
          <div class="stat-card">
            <div style="font-size:10px; color:#6b7280; text-transform:uppercase; font-weight:bold; margin-bottom:8px;">Monthly Leakage</div>
            <div style="font-size:28px; font-weight:900; color:#EF4444;">$${calc.monthlyLeak.toLocaleString()}</div>
          </div>
          <div class="stat-card">
            <div style="font-size:10px; color:#6b7280; text-transform:uppercase; font-weight:bold; margin-bottom:8px;">Annual Impact</div>
            <div style="font-size:28px; font-weight:900; color:#EF4444;">$${calc.annualLeak.toLocaleString()}</div>
          </div>
          <div class="stat-card" style="display:flex; flex-direction:column; align-items:center; background:#fff8f0; border-color:#fed7aa;">
            <div style="font-size:10px; color:#92400e; text-transform:uppercase; font-weight:bold; margin-bottom:4px;">Audit Score</div>
            <div class="score-circle">${calc.score}</div>
            <div style="font-size:10px; font-weight:bold; color:${hColor}; margin-top:4px;">${calc.grade}</div>
          </div>
        </div>

        ${note ? `<div style="background:#fff8f0; border-left:4px solid #F97316; padding: 20px; border-radius: 8px; font-style: italic; font-size: 13px; color: #444; margin-bottom: 30px;"><strong>Analyst Note:</strong><br>${esc(note).replace(/\n/g, '<br>')}</div>` : ''}

        <h2 style="font-size:14px; text-transform:uppercase; color:#F97316; letter-spacing:1px; border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:20px;">01 — Critical Friction Points</h2>
        ${itemsHtml}

        <div class="page-break"></div>

        <h2 style="font-size:14px; text-transform:uppercase; color:#F97316; letter-spacing:1px; border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:24px;">02 — 90-Day Implementation Roadmap</h2>
        <div style="padding: 0 10px;">${planSteps}</div>

        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; color: #9ca3af; font-size: 10px; text-align: center;">
          BDL Revenue Intelligence • Confidential Report for ${bizName} • © 2026 BDL Intelligence Team
        </div>
      </div>
    </body></html>`;
}

/**
 * Creates a PDF attachment from HTML content.
 * @param {string} html The HTML content to convert to PDF.
 * @param {string} filename The desired filename for the PDF.
 * @returns {GoogleAppsScript.Base.Blob} A Blob object representing the PDF file.
 */
function createPdfAttachment(html, filename) {
  const blob = Utilities.newBlob(html, 'text/html', 'report.html');
  const pdfBlob = blob.getAs('application/pdf');
  pdfBlob.setName(filename || 'Revenue_Audit.pdf'); // Set PDF filename 
  return pdfBlob;
}

/**
 * Escapes HTML special characters in a string to prevent XSS.
 * @param {string} s The string to escape.
 * @returns {string} The HTML-escaped string.
 */
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); // Escape HTML characters 
}

/**
 * Builds the HTML content for a summary revenue audit report email.
 * This is typically used for unpaid reports or initial summaries.
 * @param {object} lead The lead object containing report data.
 * @param {string} note A personal note to include.
 * @param {object} template The template object (though not fully utilized here).
 * @returns {string} The HTML string for the summary report email.
 * Sends an initial email to the client after they submit a revenue audit request.
 * This email provides a summary of their estimated leakage and includes a payment link
 * to unlock the full report.
 * @param {object} lead The lead object containing client and audit data.
 */
function sendInitialPaymentRequestEmail(lead) {
  const clientEmail = String(lead.email || '').trim();
  const bizName     = String(lead.business || 'your business').trim();
  const leakage     = Number(lead.totalLeakage || 0);
  const niche       = String(lead.niche || 'General').trim();
  const firstName   = lead.name ? lead.name.split(' ')[0] : 'there';
  const paymentLink = getGlobalPaymentLink();
  const paymentId   = lead.id || 'AUDIT-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'mmss');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px; background: #fff;">
      <h2 style="color: #F97316; margin-top: 0;">Audit Request Received ✅</h2>
      <p>Hi ${firstName}, we've identified <strong>$${leakage.toLocaleString()}/mo</strong> in revenue leakage for <strong>${bizName}</strong>.</p>
      
      <div style="background: #fff7ed; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; border: 1px solid #fed7aa;">
        <p style="margin: 0; color: #9a3412; font-size: 12px; font-weight: bold; text-transform: uppercase;">Potential Annual Recovery</p>
        <p style="margin: 5px 0; color: #dc2626; font-size: 36px; font-weight: 800;">$${(leakage * 12).toLocaleString()}</p>
        <a href="${paymentLink}" style="display: inline-block; background: #F97316; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 15px;">Unlock Full 20+ Page Report ($${SETTINGS.REPORT_PRICE})</a>
      </div>

      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
        <p style="margin: 0; color: #475569; font-size: 13px; font-weight: bold;">⚠️ IMPORTANT PAYMENT INSTRUCTIONS:</p>
        <p style="margin: 8px 0 0; color: #64748b; font-size: 13px; line-height: 1.5;">
          When paying via Wise, you <strong>must</strong> include the following ID in the "Reference" or "Message" field so we can identify your audit:<br>
          <span style="display: block; margin-top: 10px; font-family: monospace; font-size: 18px; color: #1e293b; font-weight: bold; background: #e2e8f0; padding: 8px; text-align: center; border-radius: 4px;">${paymentId}</span>
        </p>
      </div>

      <div style="margin: 20px 0; padding: 15px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
        <p style="margin: 0; color: #166534; font-size: 13px;"><strong>✨ Bonus Included:</strong> Your report will also include a custom 12-month ROI projection based on these fixes if requested today.</p>
      </div>

      <p style="font-size: 13px; color: #475569; line-height: 1.6;">Once payment is received, your high-fidelity Executive Diagnostic (PDF) including the 90-day recovery roadmap will be delivered to this email within 24 hours.</p>
      
      <p style="font-size: 12px; color: #94a3b8; border-top: 1px solid #eee; padding-top: 15px; margin-top: 20px;">BDL Revenue Intelligence Team · Reference: ${paymentId}</p>
    </div>`;

  MailApp.sendEmail({
    to: clientEmail,
    subject: `[ACTION REQUIRED] Unlock your Audit Report — ${bizName} (Ref: ${paymentId})`,
    htmlBody: html,
    name: 'BDL Revenue Intelligence'
  });
}

function buildSummaryReportEmailHtml(lead, note, template) {
  const leakage = Number(lead.totalLeakage || 0);
  const breakdown = (lead.leakageBreakdown || '').split(' | ').filter(Boolean);
  
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #08090C; font-family: Arial, sans-serif; color: #E8EAF0;">
      <tr>
        <td align="center" style="padding: 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto;">
            <tr>
              <td style="background: #0F1117; padding: 20px; border-radius: 12px; border: 1px solid #1E2230;">
                <h3 style="color: #F97316; font-size: 18px; margin: 0 0 15px; font-family: Arial, sans-serif;">📊 Revenue Audit Summary: ${esc(lead.business)}</h3>
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom: 1px solid #1E2230;">
                  <tr>
                    <td style="padding: 8px 0; font-size: 13px; color: #6B7280; font-family: Arial, sans-serif;">Monthly Revenue</td>
                    <td align="right" style="padding: 8px 0; font-size: 13px; font-weight: bold; color: #E8EAF0; font-family: Arial, sans-serif;">$${Number(lead.monthlyRevenue || 0).toLocaleString()}</td>
                  </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom: 1px solid #1E2230;">
                  <tr>
                    <td style="padding: 8px 0; font-size: 13px; color: #6B7280; font-family: Arial, sans-serif;">Estimated Leakage</td>
                    <td align="right" style="padding: 8px 0; font-size: 13px; font-weight: bold; color: #EF4444; font-family: Arial, sans-serif;">$${leakage.toLocaleString()}/mo</td>
                  </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding: 8px 0; font-size: 13px; color: #6B7280; font-family: Arial, sans-serif;">Annual Impact</td>
                    <td align="right" style="padding: 8px 0; font-size: 13px; font-weight: bold; color: #EF4444; font-family: Arial, sans-serif;">$${(leakage * 12).toLocaleString()}/yr</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr><td style="padding: 10px 0;"></td></tr>
            <tr>
              <td style="background: #0F1117; padding: 20px; border-radius: 12px; border: 1px solid #1E2230;">
                <h4 style="color: #F97316; font-size: 14px; margin: 0 0 12px; text-transform: uppercase; font-family: Arial, sans-serif;">🔍 High-Level Friction Points</h4>
                ${breakdown.map(item => `
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom: 1px solid #1E2230;">
                    <tr>
                      <td style="padding: 8px 0; font-size: 13px; color: #E8EAF0; font-family: Arial, sans-serif;">${esc(item)}</td>
                      <td align="right" style="padding: 8px 0; font-size: 11px; font-weight: 700; color: #F97316; text-transform: uppercase; font-family: Arial, sans-serif;">[Locked]</td>
                    </tr>
                  </table>
                `).join('')}
              </td>
            </tr>
            <tr><td style="padding: 10px 0;"></td></tr>
            ${note ? `<tr><td style="padding: 15px; border-left: 3px solid #F97316; background: #141720; color: #E8EAF0; font-size: 13px; line-height: 1.6; font-family: Arial, sans-serif;">${esc(note).split('\n').join('<br>')}</td></tr>` : ''}
            ${note ? `<tr><td style="padding: 10px 0;"></td></tr>` : ''}
            <tr>
              <td align="center" style="padding: 20px; background: rgba(249,115,22,0.1); border-radius: 12px; border: 1px dashed #F97316;">
                <p style="color: #E8EAF0; font-size: 14px; margin: 0 0 15px; font-family: Arial, sans-serif;">Your full <strong>Executive Revenue Diagnostic</strong> is ready.</p>
                <p style="color: #6B7280; font-size: 12px; margin: 0; font-family: Arial, sans-serif;">Includes: 90-day roadmap, industry benchmarks, and exact fix steps for all ${breakdown.length} areas.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

/**
 * Builds the HTML content for a full revenue audit report email.
 * This is typically used for paid reports and includes more detailed information.
 * @param {object} lead The lead object containing report data.
 * @param {string} note A personal note to include.
 * @param {object} template The template object (though not fully utilized here).
 * @returns {string} The HTML string for the full report email.
 */
function buildFullReportEmailHtml(lead, note, template) {
  const leakage = Number(lead.totalLeakage || 0);
  const annual = Number(lead.annualLeakage || 0);
  const niche = (lead.niche || 'General').toLowerCase();
  const bizName = lead.business || 'Your Business';
  const items = (lead.leakageBreakdown || '').split(' | ').filter(Boolean);
  const reportId = 'BDL-' + Utilities.formatDate(new Date(), "GMT", "yyyyMMdd") + '-' + (lead.niche || 'GEN').toUpperCase().slice(0, 3);
  
  // Re-introducing the complex leakage item mapping
  const leakHtml = items.map((item, i) => {
    const col = i === 0 ? '#EF4444' : i <= 2 ? '#F97316' : '#F59E0B';
    const share = Math.round(leakage / Math.max(1, items.length));
    return `
      <div style="border-left: 4px solid ${col}; background: #0F1117; padding: 15px; margin-bottom: 12px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
          <tr>
            <td align="left" style="font-weight: 700; color: #E8EAF0; font-size: 14px; font-family: Arial, sans-serif;">${esc(item)}</td>
            <td align="right" style="font-weight: 800; color: ${col}; font-size: 15px; font-family: Arial, sans-serif;">-$${share.toLocaleString()}/mo</td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="height: 5px; background: #1E2230; border-radius: 10px;">
          <tr>
            <td style="height: 5px; background: ${col}; width: ${100 - (i * 15)}%; border-radius: 10px;"></td>
            <td style="height: 5px; background: #1E2230; width: ${i * 15}%;"></td>
          </tr>
        </table>
      </div>`;
  }).join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #08090C; font-family: Arial, sans-serif; color: #E8EAF0;">
      <tr>
        <td align="center" style="padding: 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 680px; margin: 0 auto;">
            <tr>
              <td style="background: #F97316; padding: 12px 25px; text-align: center; color: #fff; font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;">
                BDL — REVENUE INTELLIGENCE · ID: ${reportId}
              </td>
            </tr>
            <tr>
              <td style="background: #0F1117; padding: 35px 30px; border-bottom: 4px solid #F97316;">
                <h1 style="font-size: 28px; margin: 0 0 5px; color: #fff; font-family: Arial, sans-serif;">${esc(bizName)}</h1>
                <p style="color: #6B7280; font-size: 14px; margin: 0;">Executive Revenue Diagnostic Report · ${esc(niche.toUpperCase())}</p>
                ${note ? `<div style="margin-top: 25px; border-left: 4px solid #F97316; background: #141720; padding: 20px; font-size: 14px; line-height: 1.7; color: #E8EAF0;">${esc(note).split('\n').join('<br>')}</div>` : ''} 
              </td>
            </tr>
            <tr>
              <td style="background: #141720; padding: 40px 30px; text-align: center; border-bottom: 1px solid #1E2230;">
                <p style="color: #6B7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px;">Identified Monthly Leakage</p>
                <p style="color: #EF4444; font-size: 64px; font-weight: 800; margin: 0; line-height: 1; letter-spacing: -2px;">$${leakage.toLocaleString()}</p>
                <p style="color: #6B7280; font-size: 14px; margin-top: 10px;">≈ <strong style="color: #E8EAF0;">$${annual.toLocaleString()} per year</strong></p>
              </td>
            </tr>
            <tr>
              <td style="padding: 30px;">
                <p style="color: #F97316; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 15px;">📉 Analysis of Friction Points</p>
                ${leakHtml}
              </td>
            </tr>
            <tr>
              <td style="background: #0F1117; padding: 30px; text-align: center; border-top: 1px solid #1E2230;">
                <p style="color: #9CA3AF; font-size: 12px; margin-bottom: 0;">Please find your comprehensive 90-day recovery roadmap and implementation steps in the <strong>attached PDF report</strong>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`; 
}

/**
 * Retrieves niche-specific calculation rules and plan details.
 * @param {string} niche The business niche (e.g., 'dental', 'realestate').
 * @returns {object} An object containing estimate percentage, breakdown items, and a 90-day plan.
 */
function getNicheCalculationRules(niche) {
  const key = String(niche || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const rules = {
    dental: {
      estimatePct: 0.11,
      breakdown: ['Appointment no-shows', 'Uncollected copays/fees', 'Unused inventory and supplies'],
      plan90: [
        { week: '1-2', action: 'Audit scheduling', detail: 'Implement appointment reminders and recall workflows to reduce no-shows.', priority: 'CRITICAL', quick: true, impact: '+$800/mo' },
        { week: '3-4', action: 'Reactivation Campaign', detail: 'Launch a lapsed patient reactivation campaign and measure conversion weekly.', priority: 'HIGH', quick: false, impact: '+$1,200/mo' },
        { week: '5-8', action: 'Software Audit', detail: 'Review software subscriptions and refine front desk follow-up processes.', priority: 'MEDIUM', quick: true, impact: '+$300/mo' }
      ]
    },
    realestate: {
      estimatePct: 0.08,
      breakdown: ['Missed lead follow-up', 'Low portal ROI', 'Inefficient offer conversion'],
      plan90: [
        { week: '1-2', action: '5-Touch Sequence', detail: 'Build a lead follow-up sequence and assign daily tasks to agents.', priority: 'CRITICAL', quick: true, impact: '+$2,500/mo' },
        { week: '3-4', action: 'Portal ROI Review', detail: 'Review portal performance and shift budget to highest-converting sources.', priority: 'HIGH', quick: false, impact: '+$1,000/mo' },
        { week: '5-8', action: 'Standardize Outreach', detail: 'Standardize open house follow-up and referral outreach.', priority: 'MEDIUM', quick: false, impact: '+$1,500/mo' }
      ]
    }, 
    healthcare: {
      estimatePct: 0.15,
      breakdown: ['Denied insurance claims', 'Patient no-shows', 'Underbilled services'],
      plan90: [
        { week: '1-2', action: 'Reminders & Claims', detail: 'Implement appointment reminders and verify insurance claim workflows.', priority: 'CRITICAL', quick: true, impact: '+$1,100/mo' },
        { week: '3-4', action: 'Referral Sequence', detail: 'Launch a referral follow-up sequence and reconnect overdue patients.', priority: 'HIGH', quick: false, impact: '+$900/mo' },
        { week: '5-8', action: 'Staff Optimization', detail: 'Optimize staff scheduling and review denied claims.', priority: 'MEDIUM', quick: false, impact: '+$600/mo' }
      ]
    }, 
    legal: {
      estimatePct: 0.18,
      breakdown: ['Untracked billable hours', 'Low realization rates', 'Administrative delays'],
      plan90: [
        { week: '1-2', action: 'Time Capture', detail: 'Launch time capture and intake improvements for new consultations.', priority: 'CRITICAL', quick: true, impact: '+$3,000/mo' },
        { week: '3-4', action: 'Task Delegation', detail: 'Delegate admin tasks and standardize client communication touchpoints.', priority: 'HIGH', quick: false, impact: '+$1,500/mo' },
        { week: '5-8', action: 'Pipeline Audit', detail: 'Review the case pipeline for delays and improve handoff consistency.', priority: 'MEDIUM', quick: false, impact: '+$2,000/mo' }
      ]
    }, 
    saas: {
      estimatePct: 0.10,
      breakdown: ['Churn and downgrades', 'Failed payments', 'Weak onboarding flow'],
      plan90: [
        { week: '1-2', action: 'Churn Guard', detail: 'Build churn risk segmentation and launch an activation sequence.', priority: 'CRITICAL', quick: false, impact: '+$1,500/mo' },
        { week: '3-4', action: 'Dunning Setup', detail: 'Implement failed payment recovery and usage-driven onboarding.', priority: 'HIGH', quick: true, impact: '+$800/mo' },
        { week: '5-8', action: 'Docs & Support', detail: 'Improve documentation and renewal engagement.', priority: 'MEDIUM', quick: false, impact: '+$500/mo' }
      ]
    }, 
    restaurant: {
      estimatePct: 0.16,
      breakdown: ['No-shows and cancellations', 'Food and labour waste', 'High delivery fees'],
      plan90: [
        { week: '1-2', action: 'Reservation Fix', detail: 'Introduce reservation confirmations and order-ahead options.', priority: 'CRITICAL', quick: true, impact: '+$1,200/mo' },
        { week: '3-4', action: 'Fee Analysis', detail: 'Track delivery platform ROI and reduce high-fee channels.', priority: 'HIGH', quick: true, impact: '+$600/mo' },
        { week: '5-8', action: 'Menu Optimization', detail: 'Optimize menus, inventory, and staffing.', priority: 'MEDIUM', quick: false, impact: '+$1,000/mo' }
      ]
    },
    general: { // Added 'general' niche
      estimatePct: 0.12,
      breakdown: ['Missed lead follow-up', 'Operational bottlenecks', 'Unoptimized service margins'],
      plan90: [
        { week: '1-2', action: 'Process Audit', detail: 'Review sales pipeline and identify top 3 manual bottlenecks.', priority: 'CRITICAL', quick: true, impact: '+$500/mo' },
        { week: '3-4', action: 'Standardize Outreach', detail: 'Build a lead follow-up sequence and automate repetitive intake tasks.', priority: 'HIGH', quick: false, impact: '+$1,200/mo' },
        { week: '5-8', action: 'Margin Optimization', detail: 'Analyze service profitability and optimize resource allocation.', priority: 'MEDIUM', quick: false, impact: '+$800/mo' }
      ]
    } 
  };
  return rules[key] || rules.dental;
}

/**
 * Calculates various leakage metrics and a health score for a given lead.
 * @param {object} lead The lead object containing financial and business data.
 * @returns {object} An object with calculated revenue, leakage, breakdown, score, grade, and rules.
 */
function calculateLeadLeakage(lead) {
  // Robust parsing to handle currency strings, commas, or empty values
  const n = (v) => {
    if (v === undefined || v === null || v === '') return NaN;
    const p = parseFloat(String(v).replace(/[$,]/g, ''));
    return isNaN(p) ? NaN : p;
  };

  let revenue = n(lead.monthlyRevenue);
  if (isNaN(revenue)) revenue = 0;

  const rules = getNicheCalculationRules(lead.niche);

  let monthlyLeak = n(lead.totalLeakage);
  // Default to industry benchmark percentage of revenue if specific leakage is missing
  if (isNaN(monthlyLeak) || (monthlyLeak === 0 && revenue > 0)) {
    monthlyLeak = Math.round(revenue * rules.estimatePct);
  }

  let annualLeak = n(lead.annualLeakage);
  if (isNaN(annualLeak) || annualLeak === 0) {
    annualLeak = Math.round(monthlyLeak * 12);
  }

  const breakdown = (lead.leakageBreakdown || rules.breakdown.join(' | ')).split(' | ').filter(Boolean);

  // Ratio calculation: use a conservative 0.15 (15%) if revenue is 0 to avoid zero-division and perfect scores on empty data
  const ratio = revenue > 0 ? monthlyLeak / revenue : 0.15;

  const score = Math.max(15, Math.min(85, 100 - Math.round(ratio * 120)));
  const grade = score < 50 ? 'Critical' : score < 70 ? 'Needs Improvement' : 'Healthy'; 

  return { revenue, monthlyLeak, annualLeak, breakdown, score, grade, rules };
}

/**
 * Builds the complete HTML content for the high-fidelity PDF report.
 * This includes executive summary, leakage breakdown, 90-day plan, and priority matrix.
 * @param {object} lead The lead object containing all necessary data for the report.
 * @param {string} note A personal note from the analyst to include in the report.
 */
function buildFullPdfReportHtml(lead, note) {
  const bizName = esc(lead.business || 'Your Business');
  const calc = calculateLeadLeakage(lead);
  const firstName = String(lead.name || 'there').split(' ')[0];
  const niche = (lead.niche || '').toLowerCase();
  const leakage = Number(lead.totalLeakage || 0);
  const annual = Number(lead.annualLeakage || 0);
  const revenue = Number(lead.monthlyRevenue || 0);
  const daily = Math.round(leakage / 30);
  const fixTop = Math.round(leakage * 0.6);
  const grRating = Number(lead.googleRating || 0);
  const grCount = Number(lead.googleReviews || 0);
  const items = (lead.leakageBreakdown || '').split(' | ').filter(Boolean);
  const reportId = 'BDL-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd') + '-' + (niche || 'GEN').toUpperCase().slice(0, 3);
  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM dd, yyyy'); 
  const leakRatio = revenue > 0 ? Math.round((leakage / revenue) * 100) : 0;

  // Health score calculation
  let health = 100;
  const lr = revenue > 0 ? leakage / revenue : 0.3;
  health -= Math.min(40, lr * 100);
  if (grRating > 0 && grRating < 4.0) health -= 15;
  if (grRating === 0) health -= 20;
  if (grCount < 50) health -= 8; 
  health = Math.max(0, Math.round(health));
  const hColor = health >= 75 ? '#10B981' : health >= 50 ? '#F59E0B' : health >= 30 ? '#F97316' : '#EF4444';
  const hGrade = health >= 75 ? 'Good' : health >= 50 ? 'Needs Attention' : health >= 30 ? 'Critical' : 'Emergency';

  // Niche-specific explanations
  const leakExplainMap = { // Renamed to avoid conflict with 'explains' variable
    dental: ['Empty slots are permanent lost revenue.', 'Unfollowed inquiries go to competitors.', 'Overdue patients churn without recall.', 'Idle staff time is a preventable cost.', 'Unused software is pure overhead.'],
    realestate: ['Leads go cold without 5+ touches.', 'Portal spend often exceeds ROI.', 'Admin tasks kill agent productivity.', 'Open house leads expire in 24 hours.'],
    healthcare: ['Unfilled slots are unrecoverable.', 'Denied claims are earned but uncollected.', 'Delayed referrals often never book.', 'Scheduling inefficiency causes overtime.'],
    legal: ['Unbilled hours are the most expensive leak.', 'Low conversion wasted attorney time.', 'Admin work by partners is a massive cost.', 'Delayed invoicing kills cash flow.'],
    saas: ['Compounding churn is the biggest threat.', 'Low trial activation wastes CAC.', 'Preventable tickets increase burn.', 'Manual work should be automated.'],
    restaurant: ['Food waste is 100% pure lost profit.', 'No-shows on busy nights are permanent losses.', 'Overstaffing slow periods is common waste.', 'Delivery fees can wipe out margins.']
  };
  const explains = leakExplain[niche] || leakExplain.dental;
 
  const styles = `
    @page { margin: 15mm 12mm; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; background: #fff; line-height: 1.5; }
    body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #111; background: #fff; line-height: 1.5; }
    .page-break { page-break-before: always; }
    /* Global */
    h1, h2, h3, h4, h5, h6 { margin: 0; padding: 0; }
    p, ul, li { margin: 0 0 8px; padding: 0; }
    ul { list-style-type: disc; margin-left: 20px; }

    /* Layout & Structure */ 
    .brand-bar { background: #F97316; color: #fff; padding: 12px 20px; display: flex; justify-content: space-between; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .hero { background: #1a1a2e; color: #fff; padding: 24px 20px 20px; margin-bottom: 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .hero-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
    .hero-title { font-size: 22px; font-weight: 800; color: #fff; margin: 0 0 4px; }
    .hero-title { font-size: 22px; font-weight: 800; color: #fff; margin: 0 0 4px; font-family: Arial, sans-serif; }
    .hero-meta { color: #9ca3af; font-size: 12px; margin: 0 0 2px; line-height: 1.5; }
    .score-badge { background: rgba(249,115,22,0.2); border: 1px solid rgba(249,115,22,0.4); border-radius: 8px; padding: 10px 14px; text-align: center; flex-shrink: 0; }
    .score-badge { background: rgba(249,115,22,0.2); border: 1px solid rgba(249,115,22,0.4); border-radius: 8px; padding: 10px 14px; text-align: center; }
    .score-label { color: #F97316; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin: 0 0 2px; }
    .score-value { color: #fff; font-size: 24px; font-weight: 800; margin: 0; line-height: 1; }
    .score-grade { font-size: 10px; font-weight: 600; margin: 2px 0 0; }
    .note-block { background: #fff8f0; border-left: 4px solid #F97316; border-radius: 0 8px 8px 0; padding: 16px 20px; margin: 20px 0; }
    .note-title { color: #F97316; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin: 0 0 6px; }
    .note-content { color: #1a1a1a; font-size: 13px; line-height: 1.7; margin: 0; white-space: pre-wrap; word-wrap: break-word; }

    /* Executive Summary */
    .summary-box { background: #fff8f0; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; }
    .summary-title { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #F97316; margin: 0 0 10px; font-weight: 700; }
    .stat-grid { display: flex; gap: 14px; flex-wrap: wrap; }
    .stat-item { flex: 1; min-width: 120px; text-align: center; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    .stat-table { width: 100%; border-collapse: separate; border-spacing: 10px 0; }
    .stat-item { text-align: center; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    .stat-value { font-size: 26px; font-weight: 800; margin: 0 0 2px; line-height: 1; }
    .stat-label { color: #6b7280; font-size: 10px; text-transform: uppercase; font-weight: 600; margin: 0; }
    .stat-red { color: #dc2626; }
    .stat-green { color: #16a34a; }

    /* Leakage Breakdown */
    .section-title { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #F97316; margin: 0 0 10px; font-weight: 700; }
    .leak-item { margin-bottom: 14px; border: 1px solid #e5e7eb; border-left: 4px solid; border-radius: 0 8px 8px 0; padding: 0; overflow: hidden; }
    .leak-header { background: #f9fafb; padding: 12px 16px; }
    .leak-header-content { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
    .leak-header { background: #f9fafb; padding: 12px 16px; width: 100%; }
    .leak-table { width: 100%; border-collapse: collapse; }
    .leak-name { font-size: 13px; font-weight: 700; color: #111; }
    .leak-value { font-size: 15px; font-weight: 800; }
    .leak-severity { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px; display: inline-block; }
    .sev-critical { background: rgba(239,68,68,.1); color: #EF4444; }
    .sev-high { background: rgba(249,115,22,.1); color: #F97316; }
    .sev-medium { background: rgba(245,158,11,.1); color: #F59E0B; }
    .leak-bar-bg { height: 5px; background: #e5e7eb; border-radius: 3px; margin-bottom: 8px; }
    .leak-bar-fill { height: 100%; border-radius: 3px; }
    .leak-impact { color: #6b7280; font-size: 11px; margin: 0; }
    .leak-explanation-box { background: #fff; padding: 10px 16px; border-top: 1px solid #e5e7eb; }
    .leak-explanation { color: #374151; font-size: 12px; line-height: 1.6; margin: 0 0 6px; }
    .leak-priority-action { color: #6b7280; font-size: 11px; margin: 0; font-style: italic; }

    /* Reputation Analysis */
    .rep-grid { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .rep-item { flex: 1; min-width: 160px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
    .rep-table { width: 100%; border-collapse: separate; border-spacing: 10px 0; margin-bottom: 16px; }
    .rep-item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
    .rep-label { color: #6b7280; font-size: 10px; text-transform: uppercase; font-weight: 600; margin: 0 0 6px; }
    .rep-value { font-size: 28px; font-weight: 800; margin: 0 0 4px; }
    .rep-desc { color: #374151; font-size: 11px; margin: 0; }
    .rep-target { color: #6b7280; font-size: 10px; margin: 4px 0 0; }
    .rep-green { color: #16a34a; }
    .rep-orange { color: #d97706; }
    .rep-red { color: #dc2626; }

    /* How to Improve */
    .improve-item { margin-bottom: 14px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .improve-header { background: #fff8f0; padding: 10px 14px; border-bottom: 1px solid #fed7aa; }
    .improve-area { color: #92400e; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; margin: 0; } 
    .improve-body { background: #fff; padding: 12px 14px; }
    .improve-how { color: #374151; font-size: 12px; line-height: 1.7; margin: 0 0 8px; }
    .improve-benchmark { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 6px 10px; color: #166534; font-size: 11px; margin: 0; }

    /* 90-Day Plan */
    .plan-week-box { margin-bottom: 16px; }
    .plan-week-header { background: #F97316; border-radius: 8px 8px 0 0; padding: 12px 16px; display: flex; align-items: center; gap: 10px; }
    .plan-week-icon { width: 26px; height: 26px; background: rgba(255,255,255,.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0; }
    .plan-week-title { font-size: 13px; font-weight: 700; color: #fff; flex: 1; margin: 0; } 
    .plan-week-header { background: #F97316; border-radius: 8px 8px 0 0; padding: 12px 16px; width: 100%; }
    .plan-week-icon { width: 26px; height: 26px; background: rgba(255,255,255,.3); border-radius: 50%; text-align: center; line-height: 26px; font-size: 12px; font-weight: 700; color: #fff; }
    .plan-week-title { font-size: 13px; font-weight: 700; color: #fff; margin: 0; } 
    .plan-week-potential { font-size: 11px; color: rgba(255,255,255,.85); margin: 0; font-weight: 600; }
    .plan-actions-body { background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 14px; }
    .plan-action-item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-bottom: 10px; background: #fff; }
    .plan-action-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
    .plan-action-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .plan-action-title { font-size: 13px; font-weight: 700; color: #111; margin: 0; }
    .plan-action-tags { display: flex; gap: 5px; flex-shrink: 0; }
    .plan-action-tags { text-align: right; }
    .plan-action-tag { font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 20px; text-transform: uppercase; }
    .tag-critical { background: rgba(220,38,38,.08); color: #dc2626; }
    .tag-high { background: rgba(234,88,12,.08); color: #ea580c; }
    .tag-medium { background: rgba(217,119,6,.08); color: #d97706; }
    .tag-quickwin { background: rgba(16,163,74,.1); color: #16a34a; }
    .plan-action-detail { color: #374151; font-size: 12px; line-height: 1.6; margin: 0 0 8px; }
    .plan-action-impact-box { display: flex; gap: 10px; align-items: center; }
    .plan-action-impact { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 4px 10px; color: #166534; font-size: 11px; font-weight: 600; margin: 0; }

    /* Priority Matrix */
    .matrix-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
    .matrix-cell { background: #fff; border: 1px solid; border-radius: 8px; padding: 12px; }
    .matrix-table { width: 100%; border-collapse: separate; border-spacing: 10px 0; margin-bottom: 16px; }
    .matrix-cell { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; vertical-align: top; }
    .matrix-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; margin: 0 0 8px; }
    .matrix-item { font-size: 11px; color: #374151; margin: 0 0 4px; }

    /* Decision Summary */
    .decision-box { background: #fff8f0; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .cost-of-inaction-box { background: #fff; border: 1px solid #fecaca; border-radius: 8px; padding: 14px; margin-bottom: 12px; text-align: center; }
    .cost-label { color: #6b7280; font-size: 11px; margin: 0 0 10px; font-weight: 600; }
    .cost-grid { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; }
    .cost-item { text-align: center; }
    .cost-table { width: 100%; border-collapse: collapse; }
    .cost-value { color: #dc2626; font-size: 18px; font-weight: 800; margin: 0; }
    .cost-period { color: #6b7280; font-size: 9px; text-transform: uppercase; margin: 2px 0 0; }
    .outcome-grid { display: flex; gap: 10px; flex-wrap: wrap; }
    .outcome-item { flex: 1; min-width: 180px; background: #fff; border: 1px solid; border-radius: 8px; padding: 14px; text-align: center; }
    .outcome-table { width: 100%; border-collapse: separate; border-spacing: 10px 0; }
    .outcome-item { background: #fff; border: 1px solid; border-radius: 8px; padding: 14px; text-align: center; }
    .outcome-icon { font-size: 20px; margin: 0 0 4px; }
    .outcome-title { font-size: 12px; font-weight: 700; color: #111; margin: 0 0 3px; }
    .outcome-value { font-size: 18px; font-weight: 800; margin: 0 0 3px; }
    .outcome-desc { color: #6b7280; font-size: 11px; margin: 0; }

    /* Footer */
    .footer { border-top: 2px solid #F97316; padding-top: 14px; text-align: center; }
    .footer-brand { color: #F97316; font-size: 12px; font-weight: 700; margin: 0 0 4px; }
    .footer-details { color: #9ca3af; font-size: 10px; line-height: 1.6; margin: 0; }
  `;

  // Build Dynamic Content  
  const leakHtml = items.map((item, i) => {
    const col = i === 0 ? '#EF4444' : i <= 2 ? '#F97316' : '#F59E0B';
    const share = Math.round(leakage / Math.max(1, items.length));
    const explain = explains[i] || 'This area requires immediate process attention.';
    return `
      <div class="leak-item" style="border-left-color: ${col}">
        <div style="background:#f9fafb; padding:12px 16px;">
          <div style="display:flex; justify-content:space-between;">
            <strong>${esc(item)}</strong>
            <span style="color:${col}; font-weight:800;">-$${share.toLocaleString()}/mo</span>
          </div>
          <table style="width:100%;"><tr>
            <td><strong>${esc(item)}</strong></td>
            <td style="text-align:right;"><span style="color:${col}; font-weight:800;">-$${share.toLocaleString()}/mo</span></td>
          </tr></table>
        </div>
        <div style="background:#fff; padding:10px 16px; border-top:1px solid #e5e7eb;">
          <p style="margin:0; font-size:11px;"><strong>Why it matters:</strong> ${explain}</p>
        </div>
      </div>`;
  }).join('');

  const matrixHtml = `
    <div class="matrix-grid">
      <div class="matrix-cell" style="border-color: #bbf7d0">
    <table style="width:100%; border-collapse:separate; border-spacing:10px 0;"><tr>
      <td width="50%" class="matrix-cell" style="border-color: #bbf7d0; vertical-align:top;">
        <p style="color:#16a34a; font-weight:700; margin:0 0 8px;">🟢 DO FIRST</p>
        ${items.slice(0, 2).map(i => `<p style="margin:2px 0;">→ ${esc(i)}</p>`).join('')}
      </div>
      <div class="matrix-cell" style="border-color: #fed7aa">
      </td>
      <td width="50%" class="matrix-cell" style="border-color: #fed7aa; vertical-align:top;">
        <p style="color:#ea580c; font-weight:700; margin:0 0 8px;">🟠 PLAN FOR</p>
        ${items.slice(2, 4).map(i => `<p style="margin:2px 0;">→ ${esc(i)}</p>`).join('')}
      </td>
    </tr></table>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>${styles}</style></head>
    <style>
      body { font-family: sans-serif; color: #111; line-height: 1.5; padding: 40px; }
      .hdr { border-bottom: 4px solid #F97316; padding-bottom: 20px; margin-bottom: 30px; }
      .stat-box { background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 20px; }
      .leak-val { color: #dc2626; font-size: 36px; font-weight: bold; }
      .plan-section { margin-top: 40px; }
      .action-item { border-left: 4px solid #F97316; background: #fff8f0; padding: 15px; margin-bottom: 15px; }
    </style></head>
    <body>
      <div class="brand-bar">
        <span>BDL — REVENUE INTELLIGENCE</span>
        <span>ID: ${reportId}</span>
      <div class="hdr">
        <p style="color: #F97316; font-weight: bold; margin: 0;">BDL REVENUE INTELLIGENCE</p>
        <h1 style="margin: 5px 0;">Executive Revenue Diagnostic</h1>
        <p style="color: #666; margin: 0;">Report ID: ${reportId} | Issued: ${dateStr}</p>
      </div>
      <h2>Analysis for ${bizName}</h2>
      <div class="stat-box">
        <p class="stat-label">Estimated Monthly Leakage</p>
        <p style="margin: 0; text-transform: uppercase; font-size: 12px; color: #666;">Estimated Monthly Leakage</p>
        <div class="leak-val">$${calc.monthlyLeak.toLocaleString()}</div>
        <p class="stat-annual">Annual Impact: $${calc.annualLeak.toLocaleString()}</p>

      <div class="hero">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h1 style="margin:0;">${bizName}</h1>
            <p style="color:#9ca3af; margin:4px 0;">Executive Revenue Diagnostic · ${dateStr}</p>
          </div>
          <div class="score-badge">
            <div style="font-size:9px; font-weight:700; color:#F97316;">HEALTH SCORE</div>
            <div style="font-size:24px; font-weight:800;">${health}</div>
            <div style="font-size:10px; color:${hColor}">${hGrade}</div>
          </div>
        </div>
        <p style="margin-top:20px; color:#e5e7eb;">Hi ${esc(firstName)}, we have analyzed your data and identified significant opportunities to recapture leaking revenue.</p>
        ${note ? `<div style="background:rgba(249,115,22,0.1); border-left:3px solid #F97316; padding:12px; margin-top:15px; font-style:italic;">"${esc(note)}"</div>` : ''}
        <p style="margin: 0; color: #666;">Annual Impact: $${calc.annualLeak.toLocaleString()}</p>
      </div>

      <div class="summary-box">
        <h2 style="margin-top:0; color:#F97316; font-size:14px;">EXECUTIVE SUMMARY</h2>
        <div class="stat-grid">
          <div class="stat-item"><div class="stat-val">$${leakage.toLocaleString()}</div><div class="stat-label">Monthly Leakage</div></div>
          <div class="stat-item"><div class="stat-val">$${annual.toLocaleString()}</div><div class="stat-label">Annual Impact</div></div>
          <div class="stat-item" style="border-color:#bbf7d0"><div class="stat-val" style="color:#16a34a">$${fixTop.toLocaleString()}</div><div class="stat-label">Recoverable/mo</div></div>
          <div class="stat-item"><div class="stat-val">$${daily}</div><div class="stat-label">Cost Per Day</div></div>
        </div>
      </div>

      <h2 style="color:#F97316; font-size:14px;">📉 LEAKAGE BREAKDOWN</h2>
      ${leakHtml}

      <div class="page-break"></div>

      <h2 style="color:#F97316; font-size:14px;">📅 90-DAY RECOVERY ROADMAP</h2>
      <div style="margin-bottom:20px;">
      ${note ? `<div style="background: #f0f7ff; padding: 15px; border-radius: 8px; margin-bottom: 30px;"><strong>Analyst Note:</strong><br>${esc(note)}</div>` : ''}
      <h3>Identified Friction Points</h3>
      <ul>${calc.breakdown.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      <div class="plan-section">
        <h3>90-Day Recovery Roadmap</h3>
        ${buildPdfPlanActions(lead)}
      </div>

      <h2 style="color:#F97316; font-size:14px;">🎯 PRIORITY MATRIX</h2>
      ${matrixHtml}

      <div class="footer">
        <p>BDL Revenue Intelligence · Confidential Report ID: ${reportId}</p>
        <p>All estimates based on submitted data and verified industry benchmarks.</p>
      </div>
    </body></html>`;
}

/**
 * Builds the HTML content for the 90-day action plan section within the PDF report.
 * It groups actions by week and formats them with priority and impact details.
 * @param {object} lead The lead object containing the 90-day plan.
 */
function buildPdfPlanActions(lead) {
  const rules = getNicheCalculationRules(lead.niche);
  const planSteps = rules.plan90 || [];
  
  return planSteps.map(item => `
    <div class="action-item">
      <div class="action-hdr">
      <div style="display: flex; justify-content: space-between;">
        <strong>Week ${item.week}: ${esc(item.action)}</strong>
        <span class="action-impact">${item.impact}</span>
        <span style="color: #10B981; font-weight: bold;">${item.impact}</span>
      </div>
      <p class="action-detail">${esc(item.detail)}</p>
      <span class="action-priority">Priority: ${item.priority}</span>
      <p style="margin: 5px 0; font-size: 13px; color: #444;">${esc(item.detail)}</p>
      <span style="font-size: 11px; background: #eee; padding: 2px 8px; border-radius: 4px;">Priority: ${item.priority}</span>
    </div>
  `).join('');
}

/**
 * Retrieves niche-specific email templates and plan details.
 * This function is used to populate dynamic content in emails.
 * @param {object} lead The lead object, used to determine the niche.
 * @returns {object} A template object containing subject, tips, and a 90-day plan specific to the lead's niche.
 */
function getTemplateForLead(lead) {
  const niche = (lead.niche || '').toLowerCase();
  const templates = {
    dental: { 
      subject: 'Dental Practice Revenue Audit — {bizName}',
      tips: [
        'Automate SMS 48h/2h reminders: Reduces no-shows by 65%',
        'Assign 10 recall calls/day: Captures overdue hygiene revenue',
        '2-hour callback rule: Increases patient booking by 40%',
        'Supply audit: Cancels unused tool/software overhead'
      ], 
      plan90: [
        {week: '1-2', priority: 'CRITICAL', action: 'Deploy SMS reminder system', detail: 'Integrate Weave or Solutionreach with your PMS.', impact: '+$2,500/mo', quick: true},
        {week: '3-4', priority: 'HIGH', action: 'Establish recall patient schedule', detail: 'Designate a Recall Coordinator role.', impact: '+$4,000/mo', quick: false},
        {week: '5-12', priority: 'MEDIUM', action: 'Front desk callback training', detail: 'Scripting for higher inquiry-to-booking conversion.', impact: '+$3,000/mo', quick: false}
      ] 
    },
    realestate: { 
      subject: 'Real Estate Agency Revenue Audit — {bizName}',
      tips: [
        'Min. 5-touch lead system: 90% of deals happen after touch 4',
        'Portal ROI Review: Cut Zillow/Realtor spend if CPL > $50',
        'Admin delegation: Move non-selling tasks to VAs or assistants',
        '24-hour Open House loop: Double conversion with immediate follow-up'
      ], 
      plan90: [
        {week: '1-2', priority: 'CRITICAL', action: 'Lead Response Automation', detail: 'Set up auto-responders for portals.', impact: '+$5,000/mo', quick: true},
        {week: '3-8', priority: 'HIGH', action: 'CRM Workflow Audit', detail: 'Clean database and set automated drip sequences.', impact: '+$8,000/mo', quick: false},
        {week: '9-12', priority: 'MEDIUM', action: 'Referral Engine Launch', detail: 'Systematize requests from past clients.', impact: '+$6,000/mo', quick: false}
      ] 
    },
    saas: { 
      subject: 'SaaS Business Revenue Audit — {bizName}',
      tips: [
        'Proactive churn health score: Flag inactive users at day 14',
        '48-hour activation sequence: Drives users to core value faster',
        'Dunning optimization: Automated retry logic for failed cards',
        'Knowledge base investment: Reduces avoidable support costs'
      ], 
      plan90: [
        {week: '1-2', priority: 'CRITICAL', action: 'Failed Payment Recovery', detail: 'Optimize dunning sequence and email copy.', impact: '+$2,000/mo', quick: true},
        {week: '3-4', priority: 'HIGH', action: 'Onboarding activation audit', detail: 'Identify and remove friction in trial flow.', impact: '+$10,000/mo', quick: false},
        {week: '5-12', priority: 'MEDIUM', action: 'Expansion Revenue Program', detail: 'Automated upsells based on usage tiers.', impact: '+$5,000/mo', quick: false}
      ] 
    },
    restaurant: { 
      subject: 'Restaurant Profitability Audit — {bizName}',
      tips: [
        'Daily waste log: Identifies top 3 items to order less of',
        'Reservation SMS: Reduces empty tables on busy nights',
        'Delivery Platform ROI: Shifting 20% to direct saves $2k+/mo',
        'Demand-based scheduling: Eliminates overstaffing slow hours'
      ], 
      plan90: [
        {week: '1-2', priority: 'CRITICAL', action: 'Reservation Confirmation', detail: 'Send SMS check-in 24h before booking.', impact: '+$3,000/mo', quick: true},
        {week: '3-8', priority: 'HIGH', action: 'Direct Ordering Shift', detail: 'Promote 5% discount for web vs platform orders.', impact: '+$4,500/mo', quick: false},
        {week: '9-12', priority: 'MEDIUM', action: 'Labor Optimization', detail: 'Staffing adjustment based on last 4 weeks data.', impact: '+$2,500/mo', quick: false}
      ] 
    },
    healthcare: {
      subject: 'Healthcare Practice Revenue Audit — {bizName}',
      tips: [
        'Pre-visit insurance verification: Slashes claim rejections',
        '4-hour referral callback: Prevents patients choosing rivals',
        'Staff schedule templates: Stops unneeded overtime cost',
        'Digital intake: Speeds up billing and reduces data errors'
      ],
      plan90: [
        {week: '1-2', priority: 'CRITICAL', action: 'Claim Denial Audit', detail: 'Identify and fix top 3 denial reasons.', impact: '+$5,000/mo', quick: true},
        {week: '3-8', priority: 'HIGH', action: 'Referral Pipeline Tool', detail: 'Centralize all incoming referrals for tracking.', impact: '+$6,000/mo', quick: false},
        {week: '9-12', priority: 'MEDIUM', action: 'Patient Retention Automations', detail: 'Recall system for recurring patients.', impact: '+$4,000/mo', quick: false}
      ]
    },
    legal: {
      subject: 'Law Firm Billable Revenue Audit — {bizName}',
      tips: [
        'Daily time tracking: Captures 8-12 hours/week writing off',
        'Consultation-to-case process: Doubles conversion speed',
        'Admin delegation: Attorneys focus only on billable work',
        'Tiered collections: Personal calls for balances >$1,000'
      ],
      plan90: [
        {week: '1-2', priority: 'CRITICAL', action: 'Daily Billing Policy', detail: 'Mandatory daily time entry for all attorneys.', impact: '+$12,000/mo', quick: true},
        {week: '3-8', priority: 'HIGH', action: 'Consultation Follow-up', detail: 'Systematic 3-touch sequence for non-converts.', impact: '+$8,000/mo', quick: false},
        {week: '9-12', priority: 'MEDIUM', action: 'Paralegal Delegation Plan', detail: 'Move $30/hr tasks off $300/hr desks.', impact: '+$10,000/mo', quick: false}
      ]
    }
  };
  const template = templates[niche] || templates.dental;
  // Replace placeholders in subject
  template.subject = template.subject.replace('{bizName}', lead.business || 'your business');
  return template;
}

/**
 * Generates a PDF report for a lead and returns it as a base64 encoded string.
 * This is typically used for API endpoints that need to provide a downloadable PDF.
 * @param {object} lead The lead object for whom the PDF is generated.
 * @param {string} note A personal note to include in the report.
 */
function getLeadPdf(lead, note) {
  try {
    // Generates the PDF using the existing high-fidelity template logic
    const html = buildFullPdfReportHtml(lead, note);
    const blob = Utilities.newBlob(html, 'text/html', 'report.html').getAs('application/pdf');
    return { 
      success: true, 
      base64: Utilities.base64Encode(blob.getBytes()), 
      filename: (lead.business || 'Revenue_Audit').replace(/[^a-z0-9]/gi, '_') + '.pdf' 
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Exports the 'Calculator Leads' and 'Verified Payments' sheets as CSV files 
 * to a 'BDL_Backups' folder in Google Drive.
 * This function should be scheduled via a daily time-driven trigger.
 */
function dailyBackupToDrive() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const folderName = "BDL_Backups";
    let folder;
    const folders = DriveApp.getFoldersByName(folderName);
    
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }

    const sheetsToBackup = [SHEETS.CALC_LEADS, SHEETS.VERIFIED];
    const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

    sheetsToBackup.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return;

      const data = sheet.getDataRange().getValues();
      const csvContent = data.map(row => 
        row.map(cell => {
          let str = String(cell || '');
          if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
            str = "\"" + str.replace(/"/g, "\"\"") + "\"";
          }
          return str;
        }).join(",")
      ).join("\n");

      const fileName = `${sheetName}_Backup_${dateStr}.csv`;
      folder.createFile(fileName, csvContent, MimeType.CSV);
    });
    console.log("Daily backup successfully created in folder: " + folderName);
  } catch (e) {
    console.error("Daily backup failed: " + e.toString());
  }
}

function updateCalculatorLead(identifier, changes) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CALC_LEADS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  const emailCol = headers.indexOf('email');
  const isEmail = String(identifier).includes('@');
  for (let i = 1; i < data.length; i++) {
    const matched = (isEmail && String(data[i][emailCol]).toLowerCase() === String(identifier).toLowerCase()) || (!isEmail && String(data[i][idCol]).trim() === String(identifier));
    if (matched) {
      Object.keys(changes).forEach(key => {
        const col = headers.indexOf(key);
        if (col !== -1) sheet.getRange(i+1, col+1).setValue(changes[key]);
      });
      return { success: true };
    }
  }
  return { error: 'Not found' };
}