/**
 * BDL REVENUE AUDIT BACKEND
 * Entry Point & Router
 */ 

const SPREADSHEET_ID = "1SYLuPbPT-hljH5EgY2UafLtOHuFO3isro9RJNlXPrqA";
function getSpreadsheet() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

const SHEETS = {
  LEADS: "Leads",
  LOGS: "Logs",
  TRACKER: "Tracker",
  CALC_LEADS: "Calculator Leads",
  CONFIG: "Config",
  ARCHIVED: "Archived",
  DELETED: "Deleted",
  CLIENTS: "Clients",
  VERIFIED: "Verified Payments",
  TEMPLATES: "Templates",
  SENDERS: "Senders",
  CONNECTED_ACCOUNTS: "Connected Accounts"
};
const DEFAULT_TEMPLATE_HEADERS = ['id', 'name', 'niche', 'type', 'subject', 'body', 'createdAt'];
const DEFAULT_SENDER_HEADERS = ['id', 'name'];
const DEFAULT_CALC_LEAD_HEADERS = ['id','date','timestamp','visitorTime','lastActiveStep','name','jobTitle','email','phone','business','niche','street','city','state','zip','country','website','monthlyRevenue','employees','googleRating','googleReviews','totalLeakage','annualLeakage','leakageBreakdown','platforms','paidReport','reportRequestDate','contacted','notes','paymentReference','calculationInputs','userAgent','timeOnPage','firebaseUid'];
const DEFAULT_VERIFIED_HEADERS = ['Reference', 'Email', 'Business', 'Niche', 'Leakage', 'Amount', 'Date', 'Status'];

const DEFAULT_TRACKER_HEADERS = ['Tracker ID', 'Data'];
const SETTINGS = {
  REPORT_PRICE: 47,
  ADMIN_EMAIL: "jamescluster35@gmail.com",
  ADMIN_DASHBOARD_URL: "https://bdl.dataconnectmail.com/admin_portal_bdl.html",
  WALKTHROUGH_LINK: "https://bluedatalabs.com/video-walkthrough"
};
 
/**
 * Retrieves the admin password from the 'Config' sheet.
 * The password is expected to be in cell A1 of the 'Config' sheet.
 * @returns {string} The admin password or "SHEET_NOT_FOUND" if the sheet does not exist.
 */
/**
 * Helper to retrieve the Config sheet case-insensitively.
 */
function getConfigSheet() {
  const ss = getSpreadsheet();
  if (!ss) return null;
  const sheet = ss.getSheetByName(SHEETS.CONFIG);
  if (sheet) return sheet;
  const sheets = ss.getSheets();
  for (let s of sheets) {
    if (s.getName().toLowerCase() === SHEETS.CONFIG.toLowerCase()) {
      return s;
    }
  }
  return null;
}

/**
 * Retrieves the admin password from the 'Config' sheet.
 * The password is expected to be in cell A1 of the 'Config' sheet.
 * @returns {string} The admin password or "SHEET_NOT_FOUND" if the sheet does not exist.
 */
function getAdminPassword() {
  const sheet = getConfigSheet();
  if (!sheet) return "SHEET_NOT_FOUND";
  return String(sheet.getRange('A1').getValue()).trim();
}

/**
 * Retrieves the global payment link (Wise/Stripe/LemonSqueezy) from 'Config' sheet cell A2.
 */
function getGlobalPaymentLink() {
  const sheet = getConfigSheet();
  if (!sheet) return "https://wise.com/pay/your-default-link"; // Fallback
  return String(sheet.getRange('A2').getValue()).trim();
}

/**
 * Retrieves the webhook signing secret from 'Config' sheet cell A3.
 */
function getWebhookSecret() {
  const sheet = getConfigSheet();
  if (!sheet) return "";
  return String(sheet.getRange('A3').getValue()).trim();
}

/**
 * Entry point for HTTP GET requests. Delegates to handleRequest.
 * @param {GoogleAppsScript.Events.DoGet} e The event object for a GET request.
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function doGet(e) {
  const event = e || {};
  if (event.parameter && event.parameter.code && event.parameter.state) {
    return handleOAuthCallback(event);
  }
  return handleRequest(e);
}
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
    'generateAndSendReport', 'sendFollowUpEmails', 'sendPaymentRequestEmail', 'getLeadPdf', 'saveLeadPdfToDrive', 'dailyBackupToDrive',
    'setupRemindersTrigger', 'sendFollowUpReminders', 'runCalculatorEmailDripCampaign',
    'getSenders', 'saveSenders', 'getGmailInboxFeed', 'processGmailThread', 'syncOutreachLogsFromGmail', 'setupGmailTriggers',
    'getIngestionSettings', 'saveIngestionSettings',
    'getConnectedAccounts', 'generateAuthUrl', 'deleteConnectedAccount', 'saveOAuthCredentials', 'getOAuthCredentials',
    'sendTestReceipt', 'sendCalculatorLink'
  ];

  if (protectedActions.includes(action) && authKey !== getAdminPassword()) {
    if (action) logAttempt(event, authKey);
    return jsonResponse({ success: false, error: 'Unauthorized: Access Denied' });
  }

  const router = {
    // CRM Actions
    'getAll': getAll,
    'addLead': (data) => addLead(data.lead),
    'updateLead': (data) => updateLead(data.id, data.changes, data.tab || SHEETS.LEADS),
    'moveLead': (data) => moveLead(data.id, data.fromTab, data.toTab, data.changes || {}),
    'deleteLead': (data) => moveLead(data.id, data.fromTab, SHEETS.DELETED, {}),
    'archiveLead': (data) => moveLead(data.id, SHEETS.LEADS, SHEETS.ARCHIVED, {}),
    'promoteClient': (data) => moveLead(data.id, SHEETS.LEADS, SHEETS.CLIENTS, {}),
    'restoreLead': (data) => moveLead(data.id, data.fromTab, SHEETS.LEADS, { status: 'New' }),
    
    // Calculator Actions
    'saveCalculatorLead': (data) => saveCalculatorLead(data.lead),
    'calculateLeakage': (data) => calculateDetailedLeakage(data),
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
    'getLeadPdf': (data) => getLeadPdf(data.lead, data.note, data.pdfType),
    'saveLeadPdfToDrive': (data) => saveLeadPdfToDrive(data.leadId, data.pdfType, data.note),
    
    // Tracker Actions
    'getTrackerData': (data) => getTracker(data.trackerId, data.email),
    'saveTrackerData': (data) => saveTracker(data.trackerId, data.tracker, data.email),

    // Template Actions
    'getTemplates':    getTemplates,
    'saveTemplate':    (data) => saveTemplate(data.template),
    'deleteTemplate':  (data) => deleteTemplate(data.id),

    // Senders Actions
    'getSenders':      getSenders,
    'saveSenders':      (data) => saveSenders(data.senders),

    'getGmailInboxFeed': getGmailInboxFeed,
    'processGmailThread': (data) => processGmailThread(data),
    'syncOutreachLogsFromGmail': (data) => syncOutreachLogsFromGmail(),
    'setupGmailTriggers': setupGmailTriggers,
    'getIngestionSettings': getIngestionSettings,
    'saveIngestionSettings': (data) => saveIngestionSettings(data.searchQuery),
    
    // Connected accounts endpoint actions
    'getConnectedAccounts': getConnectedAccounts,
    'generateAuthUrl': (data) => generateAuthUrl(data),
    'deleteConnectedAccount': (data) => deleteConnectedAccount(data),
    'saveOAuthCredentials': (data) => saveOAuthCredentials(data.clientId, data.clientSecret),
    'getOAuthCredentials': getOAuthCredentials,
    'sendTestReceipt': (data) => { sendPaymentReceiptEmail(data.lead); return { success: true }; },
    'sendCalculatorLink': (data) => sendCalculatorLinkToLead(data.threadId),

    // Admin Actions
    'dailyBackupToDrive': dailyBackupToDrive,
    'inspectSpreadsheet': inspectSpreadsheet,
    'setupRemindersTrigger': setupRemindersTrigger,
    'sendFollowUpReminders': (data) => sendFollowUpReminders(),
    'runCalculatorEmailDripCampaign': (data) => runCalculatorEmailDripCampaign(),
    'getRawSheetData': getRawSheetData,
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
function getTracker(trackerId, submittedEmail) {
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

  if (!lead) return { error: 'Tracker not found' };

  // ── EMAIL VERIFICATION GATE ──────────────────────────
  // If an email is provided, verify it matches the lead on record.
  // This prevents anyone who guesses a tracker ID from seeing another client's data.
  if (trackerId && submittedEmail) {
    const inputEmail = String(submittedEmail).trim().toLowerCase();
    const leadEmail = String(lead.email || '').trim().toLowerCase();
    if (inputEmail !== leadEmail) {
      return { error: 'Tracker not found' }; // Generic error — don't reveal the ID is valid
    }
  }
  // ─────────────────────────────────────────────────────

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
    Logger.log("Tracker notification error: " + e.toString());
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
 
  return { success: true, lead: lead, tracker: tracker };
}

// ── CRM Tab Operations ────────────────────────────────

/**
 * Saves or updates tracker progress for a specific tracker ID.
 * If the tracker ID exists, its data is updated; otherwise, a new entry is appended.
 * @param {string} trackerId The ID of the tracker.
 * @param {object} tracker The tracker data object to save.
 * @param {string} submittedEmail The email address used to verify the request.
 */
function saveTracker(trackerId, tracker, submittedEmail) {
  // First, verify the email belongs to the trackerId
  const leadSheet = getOrCreateSheet(SHEETS.CALC_LEADS, DEFAULT_CALC_LEAD_HEADERS);
  const leads = leadSheet.getDataRange().getValues();
  const headers = leads.shift();
  let lead = null;
  for (let row of leads) {
    if (row[0] == trackerId) {
      lead = {};
      headers.forEach((h, i) => lead[h] = row[i]);
      break;
    }
  }

  if (!lead) return { error: 'Tracker not found' };

  if (submittedEmail) {
    const inputEmail = String(submittedEmail).trim().toLowerCase();
    const leadEmail = String(lead.email || '').trim().toLowerCase();
    if (inputEmail !== leadEmail) {
      return { error: 'Tracker not found' };
    }
  } else {
    return { error: 'Email verification required' };
  }

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

    const sheet = getOrCreateSheet(SHEETS.VERIFIED, DEFAULT_VERIFIED_HEADERS);

    const lsAttr = data.data?.attributes;
    const custom = lsAttr?.custom_data || {};

    const orderId   = data.data?.id || data.orderId || 'WH-' + Date.now();
    const email     = lsAttr?.user_email || data.email || '';
    const amount    = lsAttr?.total_formatted || lsAttr?.total || SETTINGS.REPORT_PRICE;
    const status    = String(lsAttr?.status || data.status || 'paid').toLowerCase();
    const business  = custom.business || '';
    const niche     = custom.niche || '';
    const leakage   = custom.leakage || '';
    const date      = new Date();

    // 1. Record payment in the Verified sheet
    sheet.appendRow([orderId, email, business, niche, leakage, amount, date, status]);

    if (email && email.includes('@')) {
      // 2. Link payment to lead (using lead_id if Lemon Squeezy custom_data is set, else email)
      const identifier = custom.lead_id || email;
      
      updateCalculatorLead(identifier, { 
        paidReport: 'Paid', 
        paymentReference: orderId,
        notes: 'Payment verified via webhook (' + status + ')'
      });

      // 3. Trigger immediate delivery if payment is successful
      if (status === 'paid' || status === 'completed') {
        const lead = getLeadByIdentifier(identifier);
        if (lead) {
          lead.paidReport = 'Paid'; // Force local status for PDF logic
          sendPaymentReceiptEmail(lead);
          generateAndSendReport(lead, email, "Payment verified. Your Executive Revenue Diagnostic is attached.", null, null);
        } else {
          Logger.log("Webhook Warning: Payment recorded but lead not found for identifier: " + identifier);
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
    MailApp.sendEmail({ to: toEmail, subject: email1.subject, htmlBody: email1.html, name: 'BDL Revenue Intelligence' });
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
  const niche = (lead.niche || 'General').toLowerCase();
  const rules = getNicheCalculationRules(niche); // Use getNicheCalculationRules
  const quickWins = (rules.plan90 || []).filter(function(p){ return p.quick; });
  const quickWinsHtml = quickWins.map(function(item){ // Build HTML for quick wins
    return `
      <tr>
        <td style="background-color: #0F1117; border: 1px solid #1E2230; padding: 16px; border-radius: 8px;">
          <div style="font-size: 14px; font-weight: bold; color: #E8EAF0; margin-bottom: 4px;">✓ ${esc(item.action)}</div>
          <div style="font-size: 12px; color: #6B7280; line-height: 1.4;">${esc(item.detail)}</div>
        </td>
      </tr>
      <tr><td style="height: 10px; font-size: 0; line-height: 0;">&nbsp;</td></tr>`;
  }).join('');

  return {
    subject: 'Week 1: 3 Quick Wins for ' + bizName,
    html: `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #08090C; font-family: Arial, sans-serif; color: #E8EAF0;">
        <tr>
          <td align="center" style="padding: 20px 10px;">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; margin: 0 auto;">
              <tr>
                <td style="background-color: #141720; padding: 30px; border-radius: 12px; border: 1px solid #1E2230;">
                  <h1 style="color: #F97316; font-size: 22px; margin: 0 0 15px;">Hi ${firstName}, here are your Quick Wins for ${bizName}!</h1>
                  <p style="font-size: 14px; line-height: 1.6; color: #E8EAF0; margin-bottom: 25px;">
                    Based on your verified diagnostic, these are the highest-impact actions you can take in the first 1-2 weeks to start recovering revenue:
                  </p>
                  
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">${quickWinsHtml}</table>

                  <div style="background-color: #0F1117; border: 1px solid #1E2230; border-radius: 10px; padding: 15px; margin: 20px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size: 12px; color: #E8EAF0; font-weight: bold;">
                          <span style="color: #10B981;">✓</span> ANALYST VERIFIED
                        </td>
                        <td align="right" style="font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: 1px;">
                          ID: ${lead.id || 'N/A'}
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="font-size: 11px; color: #6B7280; padding-top: 4px;">
                          Benchmarks: ${esc(niche.charAt(0).toUpperCase() + niche.slice(1))} Operations Engine
                        </td>
                      </tr>
                    </table>
                  </div>

                  <p style="color: #9CA3AF; font-size: 12px; line-height: 1.6; margin-top: 20px;">
                    For your full 90-day roadmap and detailed implementation steps, please refer to your Executive Revenue Diagnostic PDF.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`
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
    wiseLink = wiseLink || getGlobalPaymentLink();
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
          <p style="margin: 0 0 20px; font-size: 13px; color: #9CA3AF; line-height: 1.6;">
            1. Click the button below to pay via Wise.<br>
            2. Choose <strong>local transfer</strong> to pay fee-free (e.g. ACH in US, SEPA in Europe).<br>
            3. Include Reference ID: <strong>${reportId}</strong> in the payment note.<br>
            4. Your full diagnostic PDF will be delivered within 24 hours.
          </p>
          <a href="${wiseLink}" style="display: block; background: #F97316; color: #fff; text-align: center; padding: 16px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">Unlock Report — $47 USD →</a>
          <p style="margin: 12px 0 0; font-size: 11px; color: #9CA3AF; text-align: center; font-style: italic; line-height: 1.4;">
            * Note: Payments are securely processed via Wise under our parent finance name: <strong>M Haresh Kumar</strong>. Wise supports standard fee-free local transfers (ACH, SEPA, etc.) to minimize transaction costs.
          </p>
        </div>

        <p style="font-size: 12px; color: #6B7280; text-align: center; margin: 0;">One-time secure payment. Professional Analyst support included.</p>
      </div>
      <p style="text-align: center; font-size: 11px; color: #4B5563; margin-top: 20px;">BDL Revenue Intelligence • Confidential for ${bizName}</p>
    </div>`;

    const attachments = [
      createPdfAttachment(buildTeaserPdfReportHtml(lead, null), 'Teaser_Report.pdf'),
      createPdfAttachment(buildPaymentPdfHtml(lead), 'Invoice.pdf')
    ];

    MailApp.sendEmail({
      to: toEmail,
      subject: `[ACTION REQUIRED] Unlock your Audit Report - ${bizName} (Ref: ${reportId})`,
      htmlBody: html,
      name: 'BDL Revenue Intelligence',
      attachments: attachments
    });
    return { success: true };
  } catch(err) { return { error: err.message }; }
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
 * Exports the 'Calculator Leads' and 'Verified Payments' sheets as CSV files 
 * to a 'BDL_Backups' folder in Google Drive.
 * This function should be scheduled via a daily time-driven trigger.
 */
function dailyBackupToDrive() {
  try {
    const ss = getSpreadsheet();
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

function inspectSpreadsheet() {
  const ss = getSpreadsheet();
  if (!ss) return { success: false, error: 'No active spreadsheet found' };
  
  const activeTabs = [
    SHEETS.CALC_LEADS,
    SHEETS.DELETED,
    SHEETS.VERIFIED,
    SHEETS.TRACKER,
    SHEETS.LOGS,
    SHEETS.CONFIG,
    SHEETS.CONNECTED_ACCOUNTS
  ];
  
  const legacyTabs = [
    SHEETS.LEADS,
    SHEETS.ARCHIVED,
    SHEETS.CLIENTS
  ];
  
  const sheets = ss.getSheets();
  const sheetNames = sheets.map(s => s.getName());
  
  const results = {
    alignedTabs: [],
    createdTabs: [],
    unwantedTabs: [],
    legacyTabsFound: []
  };

  // 1. Align active tabs
  const calcHeaders = DEFAULT_CALC_LEAD_HEADERS;
  const verifiedHeaders = DEFAULT_VERIFIED_HEADERS;
  const trackerHeaders = DEFAULT_TRACKER_HEADERS;
  const logsHeaders = ['Timestamp', 'Action', 'Key Attempted', 'Method'];
  const connectedAccountsHeaders = ['Email', 'Status', 'RefreshToken', 'AddedAt'];

  const tabConfigs = [
    { name: SHEETS.CALC_LEADS, headers: calcHeaders },
    { name: SHEETS.DELETED, headers: calcHeaders },
    { name: SHEETS.VERIFIED, headers: verifiedHeaders },
    { name: SHEETS.TRACKER, headers: trackerHeaders },
    { name: SHEETS.LOGS, headers: logsHeaders },
    { name: SHEETS.CONNECTED_ACCOUNTS, headers: connectedAccountsHeaders }
  ];

  tabConfigs.forEach(conf => {
    let sheet = ss.getSheetByName(conf.name);
    if (!sheet) {
      sheet = ss.insertSheet(conf.name);
      if (conf.headers && conf.headers.length > 0) {
        sheet.getRange(1, 1, 1, conf.headers.length).setValues([conf.headers]);
        sheet.setFrozenRows(1);
      }
      results.createdTabs.push(conf.name);
    } else {
      let missingHeaders = [];
      if (conf.headers && conf.headers.length > 0) {
        const existingHeaders = sheet.getLastColumn() > 0 
          ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim())
          : [];
        missingHeaders = conf.headers.filter(h => !existingHeaders.includes(h));
        if (missingHeaders.length > 0) {
          sheet.getRange(1, existingHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
        }
      }
      results.alignedTabs.push({ name: conf.name, added: missingHeaders });
    }
  });

  // Ensure Config sheet exists
  let configSheet = ss.getSheetByName(SHEETS.CONFIG);
  if (!configSheet) {
    configSheet = ss.insertSheet(SHEETS.CONFIG);
    results.createdTabs.push(SHEETS.CONFIG);
  }

  // 2. Identify unwanted tabs
  const standardTabs = [
    ...activeTabs,
    "Test Results",
    "CRM Schema Report"
  ];

  sheetNames.forEach(name => {
    if (!standardTabs.includes(name)) {
      if (legacyTabs.includes(name)) {
        results.legacyTabsFound.push(name);
      } else {
        results.unwantedTabs.push(name);
      }
    }
  });

  // 3. Write a summary report in the spreadsheet
  let reportSheet = ss.getSheetByName("CRM Schema Report");
  if (!reportSheet) {
    reportSheet = ss.insertSheet("CRM Schema Report");
  }
  reportSheet.clear();
  reportSheet.setFrozenRows(1);
  reportSheet.getRange(1, 1, 1, 3).setValues([["Category", "Details", "Action Taken / Status"]]).setFontWeight("bold");

  const reportRows = [];
  reportRows.push(["Active Tabs Aligned", results.alignedTabs.map(t => `${t.name} (added: ${t.added.join(', ') || 'none'})`).join('\n'), "Verified & Aligned"]);
  if (results.createdTabs.length > 0) {
    reportRows.push(["Missing Active Tabs Created", results.createdTabs.join(', '), "Created successfully"]);
  } else {
    reportRows.push(["Missing Active Tabs Created", "None", "All active tabs are present"]);
  }
  if (results.legacyTabsFound.length > 0) {
    reportRows.push(["Legacy CRM Tabs Found", results.legacyTabsFound.join(', '), "Legacy (unwanted) tabs from old system. You can delete these manually if you do not need their history."]);
  }
  if (results.unwantedTabs.length > 0) {
    reportRows.push(["Unwanted / Unknown Tabs Found", results.unwantedTabs.join(', '), "Unknown tab. Verify if you want to keep or delete these."]);
  }

  reportSheet.getRange(2, 1, reportRows.length, 3).setValues(reportRows);
  reportSheet.autoResizeColumns(1, 3);

  return {
    success: true,
    message: "Inspection & alignment complete. A detailed report tab 'CRM Schema Report' has been added/updated in your spreadsheet.",
    details: results
  };
}

/**
 * Daily Follow-Up Reminders
 * Scans the Leads sheet for follow-up dates that are today or in the past
 * and posts alerts to Google Chat webhook and emails the user.
 */
function sendFollowUpReminders() {
  try {
    const leads = getTabData(SHEETS.LEADS);
    if (!leads || leads.length === 0) {
      Logger.log("No leads found in Leads sheet.");
      return { success: true, message: "No leads found" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueLeads = leads.filter(lead => {
      if (!lead.followUpDate) return false;
      const fDate = new Date(lead.followUpDate);
      if (isNaN(fDate.getTime())) return false;
      fDate.setHours(0, 0, 0, 0);
      
      // Keep active stages, and those that are due/overdue
      return fDate <= today && lead.status !== 'Closed' && lead.status !== 'Cold';
    });

    if (overdueLeads.length === 0) {
      Logger.log("No overdue follow-up leads today.");
      return { success: true, message: "No overdue leads" };
    }

    // Build Chat notification and Email HTML
    let chatMsg = `⏰ *Daily CRM Follow-up Reminders (${overdueLeads.length} Lead(s) Due)*\n\n`;
    let emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #08090C; color: #E8EAF0; border-radius: 16px;">
      <div style="text-align: center; padding: 20px 0;">
        <div style="color: #F97316; font-size: 12px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">BDL CRM REMINDERS</div>
      </div>
      <div style="background: #0F1117; border: 1px solid #1E2230; border-radius: 12px; padding: 32px;">
        <h2 style="color: #fff; margin-top: 0; font-size: 22px;">Daily Follow-up Reminders</h2>
        <p style="color: #9CA3AF; line-height: 1.6; font-size: 14px;">The following leads are due or overdue for a follow-up action today:</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;">
    `;

    overdueLeads.forEach((lead, index) => {
      const contact = lead.contact || lead.name || 'Unknown Contact';
      const company = lead.company || lead.business || 'Unknown Company';
      const dateStr = lead.followUpDate;
      const notes = lead.notes || 'No notes available';
      const status = lead.status || 'New';
      const niche = lead.niche || '—';

      chatMsg += `• *${index + 1}. ${contact}* (${company})\n` +
                 `  - *Niche:* ${niche} | *Status:* ${status}\n` +
                 `  - *Due Date:* ${dateStr}\n` +
                 `  - *Notes:* ${notes}\n\n`;

      emailHtml += `
        <tr>
          <td style="background-color: #141720; border: 1px solid #1E2230; padding: 20px; border-radius: 10px; margin-bottom: 15px; display: block;">
            <div style="font-size: 16px; font-weight: bold; color: #F97316; margin-bottom: 4px;">${index + 1}. ${esc(contact)}</div>
            <div style="font-size: 14px; color: #E8EAF0; margin-bottom: 8px;"><strong>Company:</strong> ${esc(company)}</div>
            <div style="font-size: 13px; color: #9CA3AF; margin-bottom: 4px;"><strong>Niche:</strong> ${esc(niche)} | <strong>Status:</strong> ${esc(status)}</div>
            <div style="font-size: 13px; color: #9CA3AF; margin-bottom: 8px;"><strong>Due Date:</strong> ${esc(dateStr)}</div>
            <div style="font-size: 13px; color: #9CA3AF; border-top: 1px solid #1E2230; padding-top: 8px;"><strong>Notes:</strong> ${esc(notes)}</div>
          </td>
        </tr>
        <tr><td style="height: 12px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
      `;
    });

    emailHtml += `
        </table>
        <div style="margin-top: 24px; text-align: center;">
          <a href="${SETTINGS.ADMIN_DASHBOARD_URL}" style="display: inline-block; background: #F97316; color: #fff; text-align: center; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">Open CRM Admin Portal →</a>
        </div>
      </div>
      <p style="text-align: center; font-size: 11px; color: #4B5563; margin-top: 20px;">BDL Revenue Intelligence • Automated Reminder</p>
    </div>
    `;

    // Send email to admin
    const adminEmail = SETTINGS.ADMIN_EMAIL;
    MailApp.sendEmail({
      to: adminEmail,
      subject: `⏰ Daily Follow-up Reminders: ${overdueLeads.length} Lead(s) Due`,
      htmlBody: emailHtml,
      name: 'BDL CRM Reminders'
    });

    // Send Chat webhook notification
    sendWebhookNotification(chatMsg);

    // Run automated email drip campaigns for public calculator leads
    try {
      runCalculatorEmailDripCampaign();
    } catch (dripErr) {
      Logger.log("Error in daily drip campaign execution: " + dripErr.toString());
    }

    return { success: true, message: `Follow-up reminders sent for ${overdueLeads.length} leads` };
  } catch (e) {
    Logger.log("Error in sendFollowUpReminders: " + e.toString());
    return { error: e.toString() };
  }
}

/**
 * Registers/re-creates the daily time-driven trigger at 9 AM.
 */
function setupRemindersTrigger() {
  try {
    const triggerName = 'sendFollowUpReminders';
    const triggers = ScriptApp.getProjectTriggers();
    for (let trigger of triggers) {
      if (trigger.getHandlerFunction() === triggerName) {
        ScriptApp.deleteTrigger(trigger);
      }
    }
    ScriptApp.newTrigger(triggerName)
      .timeBased()
      .everyDays(1)
      .atHour(9)
      .create();
    Logger.log("Trigger created for sendFollowUpReminders at 9 AM daily.");
    return { success: true, message: "Trigger created for 9 AM daily" };
  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * Retrieves the list of campaign sender profiles from Senders sheet tab.
 * Seeds default profiles if empty.
 */
function getSenders() {
  const sheet = getOrCreateSheet(SHEETS.SENDERS, DEFAULT_SENDER_HEADERS);
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    const defaultSenders = [
      ['send-1', 'Skinner Donald'],
      ['send-2', 'Michael Brauns'],
      ['send-3', 'Lyle Morgan'],
      ['send-4', 'Dan Peretti'],
      ['send-5', 'Kate Campbell'],
      ['send-6', 'Matthew Young']
    ];
    defaultSenders.forEach(s => sheet.appendRow(s));
    return { success: true, senders: defaultSenders.map(s => ({ id: s[0], name: s[1] })) };
  }
  const headers = rows[0];
  const idCol = headers.indexOf('id');
  const nameCol = headers.indexOf('name');
  const senders = rows.slice(1).map(row => ({
    id: String(row[idCol] || ''),
    name: String(row[nameCol !== -1 ? nameCol : 1] || '')
  })).filter(s => s.id && s.id !== '');
  return { success: true, senders: senders };
}

/**
 * Saves/overwrites the list of campaign sender profiles.
 */
function saveSenders(sendersList) {
  const sheet = getOrCreateSheet(SHEETS.SENDERS, DEFAULT_SENDER_HEADERS);
  sheet.clear();
  sheet.getRange(1, 1, 1, DEFAULT_SENDER_HEADERS.length).setValues([DEFAULT_SENDER_HEADERS]);
  sheet.setFrozenRows(1);
  if (sendersList && sendersList.length > 0) {
    sendersList.forEach(s => {
      const id = s.id || 'send-' + Math.random().toString(36).substr(2, 6);
      sheet.appendRow([id, s.name]);
    });
  }
  return { success: true };
}

function getRawSheetData() {
  const ss = getSpreadsheet();
  const sheets = ss.getSheets();
  const res = {};
  sheets.forEach(s => {
    const name = s.getName();
    const range = s.getDataRange();
    const values = range.getValues();
    res[name] = {
      rows: values.length,
      headers: values[0] || [],
      sample: values.slice(1, 3)
    };
  });
  return res;
}

// ── Connected Accounts Actions & Helpers ──

function saveOAuthCredentials(clientId, clientSecret) {
  try {
    const sheet = getConfigSheet();
    if (!sheet) return { error: 'Config sheet not found' };
    sheet.getRange('A6').setValue(String(clientId || '').trim());
    sheet.getRange('A7').setValue(String(clientSecret || '').trim());
    return { success: true };
  } catch (e) {
    return { error: e.toString() };
  }
}

function getOAuthCredentials() {
  try {
    const sheet = getConfigSheet();
    if (!sheet) return { error: 'Config sheet not found' };
    const clientId = String(sheet.getRange('A6').getValue()).trim();
    const clientSecret = String(sheet.getRange('A7').getValue()).trim();
    return {
      success: true,
      clientId: clientId,
      hasClientSecret: clientSecret.length > 0
    };
  } catch (e) {
    return { error: e.toString() };
  }
}

function getConnectedAccounts() {
  try {
    const list = getConnectedAccountsList();
    const sanitizedList = list.map(acct => ({
      email: acct.email,
      status: acct.status,
      addedAt: acct.addedAt
    }));
    return { success: true, accounts: sanitizedList };
  } catch (e) {
    return { error: e.toString() };
  }
}

function generateAuthUrl(data) {
  try {
    const email = data.email;
    if (!email) return { error: 'Missing email' };
    
    const sheet = getConfigSheet();
    const clientId = sheet ? String(sheet.getRange('A6').getValue()).trim() : '';
    if (!clientId) {
      return { error: 'Google Client ID is not configured in CRM settings.' };
    }
    
    const redirectUri = ScriptApp.getService().getUrl();
    const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify');
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${encodeURIComponent(email)}`;
      
    return { success: true, authUrl: authUrl };
  } catch (e) {
    return { error: e.toString() };
  }
}

function deleteConnectedAccount(data) {
  try {
    const email = data.email;
    if (!email) return { error: 'Missing email' };
    
    const sheet = getOrCreateSheet(SHEETS.CONNECTED_ACCOUNTS, ['Email', 'Status', 'RefreshToken', 'AddedAt']);
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    const emailCol = headers.indexOf('Email');
    
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][emailCol]).trim().toLowerCase() === email.toLowerCase()) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { error: 'Email account not found.' };
  } catch (e) {
    return { error: e.toString() };
  }
}

function getConnectedAccountsList() {
  const sheet = getOrCreateSheet(SHEETS.CONNECTED_ACCOUNTS, ['Email', 'Status', 'RefreshToken', 'AddedAt']);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf('Email');
  const statusCol = headers.indexOf('Status');
  const tokenCol = headers.indexOf('RefreshToken');
  const dateCol = headers.indexOf('AddedAt');
  
  const accounts = [];
  for (let i = 1; i < data.length; i++) {
    const email = String(data[i][emailCol]).trim();
    if (email) {
      accounts.push({
        email: email,
        status: String(data[i][statusCol] || ''),
        refreshToken: String(data[i][tokenCol] || ''),
        addedAt: String(data[i][dateCol] || '')
      });
    }
  }
  return accounts;
}

function updateConnectedAccountStatus(email, status) {
  const sheet = getOrCreateSheet(SHEETS.CONNECTED_ACCOUNTS, ['Email', 'Status', 'RefreshToken', 'AddedAt']);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf('Email');
  const statusCol = headers.indexOf('Status');
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][emailCol]).trim().toLowerCase() === email.toLowerCase()) {
      sheet.getRange(i + 1, statusCol + 1).setValue(status);
      break;
    }
  }
}

function handleOAuthCallback(e) {
  const code = e.parameter.code;
  const email = e.parameter.state;
  
  const sheet = getConfigSheet();
  const clientId = sheet ? String(sheet.getRange('A6').getValue()).trim() : '';
  const clientSecret = sheet ? String(sheet.getRange('A7').getValue()).trim() : '';
  
  if (!clientId || !clientSecret) {
    return HtmlService.createHtmlOutput(`
      <html>
        <body style="background-color: #08090C; color: #EF4444; font-family: Arial; text-align: center; padding: 50px;">
          <h2>Configuration Error</h2>
          <p>Google Client ID and Client Secret must be configured in your CRM Settings first.</p>
        </body>
      </html>
    `);
  }
  
  const redirectUri = ScriptApp.getService().getUrl();
  const payload = {
    code: code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  };
  
  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    payload: payload,
    muteHttpExceptions: true
  });
  
  const resCode = response.getResponseCode();
  const resText = response.getContentText();
  
  if (resCode !== 200) {
    return HtmlService.createHtmlOutput(`
      <html>
        <body style="background-color: #08090C; color: #EF4444; font-family: Arial; text-align: center; padding: 50px;">
          <h2>OAuth Token Exchange Failed</h2>
          <p>${resText}</p>
        </body>
      </html>
    `);
  }
  
  const tokenData = JSON.parse(resText);
  const refreshToken = tokenData.refresh_token;
  
  if (!refreshToken) {
    return HtmlService.createHtmlOutput(`
      <html>
        <body style="background-color: #08090C; color: #F59E0B; font-family: Arial; text-align: center; padding: 50px;">
          <h2>Authentication Succeeded (No Refresh Token)</h2>
          <p>We received an access token but not a refresh token. To fix this:</p>
          <p>1. Go to your Google Account permissions, remove access for your OAuth App, and try again.</p>
          <p>2. Ensure prompt=consent is used.</p>
        </body>
      </html>
    `);
  }
  
  const connSheet = getOrCreateSheet(SHEETS.CONNECTED_ACCOUNTS, ['Email', 'Status', 'RefreshToken', 'AddedAt']);
  const data = connSheet.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf('Email');
  const statusCol = headers.indexOf('Status');
  const tokenCol = headers.indexOf('RefreshToken');
  const dateCol = headers.indexOf('AddedAt');
  
  let foundRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][emailCol]).trim().toLowerCase() === email.toLowerCase()) {
      foundRow = i + 1;
      break;
    }
  }
  
  if (foundRow > 0) {
    connSheet.getRange(foundRow, statusCol + 1).setValue('Connected');
    connSheet.getRange(foundRow, tokenCol + 1).setValue(refreshToken);
    connSheet.getRange(foundRow, dateCol + 1).setValue(new Date().toISOString());
  } else {
    connSheet.appendRow([email, 'Connected', refreshToken, new Date().toISOString()]);
  }
  
  return HtmlService.createHtmlOutput(`
    <html>
      <head>
        <title>Authentication Successful</title>
        <style>
          body {
            background-color: #08090C;
            color: #E8EAF0;
            font-family: Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .card {
            background-color: #141720;
            border: 1px solid #1E2230;
            padding: 40px;
            border-radius: 12px;
            text-align: center;
            max-width: 450px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          }
          h1 { color: #10B981; margin-top: 0; }
          p { color: #9CA3AF; line-height: 1.6; font-size: 14px; }
          .email { color: #F97316; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✓ Success!</h1>
          <p>Your email account <span class="email">${email}</span> has been successfully connected to BDL CRM.</p>
          <p>You can close this window now and refresh your Campaign Integrations page.</p>
        </div>
      </body>
    </html>
  `);
}

/**
 * Runs the automated follow-up email drip campaign daily.
 * Scans all leads in 'Calculator Leads' and sends follow-up emails on Day 2 and Day 5.
 */
function runCalculatorEmailDripCampaign() {
  try {
    const leads = getTabData(SHEETS.CALC_LEADS);
    if (!leads || leads.length === 0) {
      Logger.log("No calculator leads found.");
      return { success: true, message: "No calculator leads found" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let processedCount = 0;

    leads.forEach(lead => {
      if (!lead.timestamp || !lead.email) return;
      
      const email = String(lead.email).trim();
      const notes = String(lead.notes || '');

      const ts = new Date(lead.timestamp);
      if (isNaN(ts.getTime())) return;
      ts.setHours(0, 0, 0, 0);

      // Skip paid or delivered leads
      const paidStatus = String(lead.paidReport || '').toLowerCase();
      if (paidStatus === 'paid' || paidStatus === 'delivered') return;

      const daysElapsed = Math.floor((today.getTime() - ts.getTime()) / (1000 * 60 * 60 * 24));
      
      // Day 2 Drip
      if (daysElapsed === 2 && !notes.includes('[Day 2 Follow-up Sent]')) {
        const mailSent = sendDripEmail(lead, 2);
        if (mailSent) {
          const updatedNotes = notes ? notes + ' \n[Day 2 Follow-up Sent]' : '[Day 2 Follow-up Sent]';
          updateLead(lead.id, { notes: updatedNotes }, SHEETS.CALC_LEADS);
          processedCount++;
          Logger.log(`Day 2 follow-up sent to ${email} (Lead ID: ${lead.id})`);
        }
      }
      // Day 5 Drip
      else if (daysElapsed === 5 && !notes.includes('[Day 5 Follow-up Sent]')) {
        const mailSent = sendDripEmail(lead, 5);
        if (mailSent) {
          const updatedNotes = notes ? notes + ' \n[Day 5 Follow-up Sent]' : '[Day 5 Follow-up Sent]';
          updateLead(lead.id, { notes: updatedNotes }, SHEETS.CALC_LEADS);
          processedCount++;
          Logger.log(`Day 5 follow-up sent to ${email} (Lead ID: ${lead.id})`);
        }
      }
    });

    return { success: true, processed: processedCount };
  } catch (err) {
    Logger.log("Error in runCalculatorEmailDripCampaign: " + err.toString());
    return { error: err.message };
  }
}

/**
 * Sends a drip email to the lead based on the day number.
 */
function sendDripEmail(lead, dayNum) {
  try {
    const bizName = esc(lead.business || 'Your Business');
    const firstName = esc(String(lead.name || 'there').split(' ')[0]);
    const niche = (lead.niche || 'General').toLowerCase();
    
    const totalLeakage = parseFloat(String(lead.totalLeakage || 0).replace(/[$,]/g, '')) || 0;
    const dailyLoss = Math.round(totalLeakage / 30);
    const recoverable = Math.round(totalLeakage * 0.7);

    let subject = '';
    let bodyHtml = '';

    if (dayNum === 2) {
      subject = `Don't let $${dailyLoss.toLocaleString()}/day slip away`;
      bodyHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #08090C; font-family: Arial, sans-serif; color: #E8EAF0;">
        <tr>
          <td align="center" style="padding: 20px 10px;">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; margin: 0 auto;">
              <tr>
                <td style="background-color: #141720; padding: 30px; border-radius: 12px; border: 1px solid #1E2230;">
                  <h2 style="color: #F97316; font-size: 20px; margin: 0 0 15px;">Hi ${firstName},</h2>
                  <p style="font-size: 14px; line-height: 1.6; color: #E8EAF0; margin-bottom: 20px;">
                    Every single day your operations run without these adjustments, your business is losing approximately <strong>$${dailyLoss.toLocaleString()} per day</strong>. 
                  </p>
                  <p style="font-size: 14px; line-height: 1.6; color: #E8EAF0; margin-bottom: 20px;">
                    That's money directly leaving your bottom line. Over the next quarter, this adds up to <strong>$${(dailyLoss * 90).toLocaleString()}</strong> in unrecovered leakage.
                  </p>
                  <p style="font-size: 14px; line-height: 1.6; color: #E8EAF0; margin-bottom: 25px;">
                    We want to help you plug these gaps. Watch our free 5-minute video walkthrough explaining exactly how to recover up to <strong>$${recoverable.toLocaleString()} per month</strong> using the copy-paste templates in your report.
                  </p>
                  
                  <div style="text-align: center; margin-bottom: 25px;">
                    <a href="${SETTINGS.WALKTHROUGH_LINK || 'https://bluedatalabs.com/video-walkthrough'}" style="display: inline-block; background-color: #F97316; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 14px; text-transform: uppercase;">Watch Walkthrough Video</a>
                  </div>

                  <p style="color: #9CA3AF; font-size: 12px; line-height: 1.6; margin: 0;">
                    Best regards,<br>
                    <strong>BDL Revenue Intelligence Team</strong><br>
                    <a href="mailto:hello@bluedatalabs.com" style="color: #F97316; text-decoration: none;">hello@bluedatalabs.com</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
    } else if (dayNum === 5) {
      subject = `How other ${niche}s recovered $50K+/mo`;
      bodyHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #08090C; font-family: Arial, sans-serif; color: #E8EAF0;">
        <tr>
          <td align="center" style="padding: 20px 10px;">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; margin: 0 auto;">
              <tr>
                <td style="background-color: #141720; padding: 30px; border-radius: 12px; border: 1px solid #1E2230;">
                  <h2 style="color: #F97316; font-size: 20px; margin: 0 0 15px;">Hi ${firstName},</h2>
                  <p style="font-size: 14px; line-height: 1.6; color: #E8EAF0; margin-bottom: 20px;">
                    Most business owners in the <strong>${esc(niche.charAt(0).toUpperCase() + niche.slice(1))}</strong> sector are skeptical when they first see their leakage numbers. 
                  </p>
                  <p style="font-size: 14px; line-height: 1.6; color: #E8EAF0; margin-bottom: 20px;">
                    But the numbers don't lie. Within 90 days of implementing their revenue recovery plan, similar businesses have plugged their operational leaks and recovered between $10,000 and $50,000+ per month.
                  </p>
                  <p style="font-size: 14px; line-height: 1.6; color: #E8EAF0; margin-bottom: 25px;">
                    Whether it's scheduling optimization, claim rejection audits, or automated follow-up drips, we make recovery simple. Watch our quick video walkthrough to see how.
                  </p>
                  
                  <div style="text-align: center; margin-bottom: 25px;">
                    <a href="${SETTINGS.WALKTHROUGH_LINK || 'https://bluedatalabs.com/video-walkthrough'}" style="display: inline-block; background-color: #F97316; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 14px; text-transform: uppercase;">Watch Walkthrough Video</a>
                  </div>

                  <p style="color: #9CA3AF; font-size: 12px; line-height: 1.6; margin: 0;">
                    Best regards,<br>
                    <strong>BDL Revenue Intelligence Team</strong><br>
                    <a href="mailto:hello@bluedatalabs.com" style="color: #F97316; text-decoration: none;">hello@bluedatalabs.com</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
    }

    if (subject && bodyHtml) {
      MailApp.sendEmail({
        to: lead.email,
        subject: subject,
        htmlBody: bodyHtml,
        name: 'BDL Revenue Intelligence'
      });
      return true;
    }
    return false;
  } catch (e) {
    Logger.log(`Failed to send drip email to ${lead.email}: ${e.toString()}`);
    return false;
  }
}

