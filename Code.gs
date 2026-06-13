/**
 * BDL REVENUE AUDIT BACKEND
 * Entry Point & Router
 */ 

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet() ? SpreadsheetApp.getActiveSpreadsheet().getId() : "";

const SHEETS = {
  LEADS: "Leads",
  LOGS: "Logs",
  TRACKER: "Tracker",
  CALC_LEADS: "Calculator Leads",
  CONFIG: "Config",
  ARCHIVED: "Archived",
  DELETED: "Deleted",
  CLIENTS: "Clients",
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
    'getLeadPdf': (data) => getLeadPdf(data.lead, data.note, data.pdfType),
    
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

// ── CRM Tab Operations ────────────────────────────────

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
