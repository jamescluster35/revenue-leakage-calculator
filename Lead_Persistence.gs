/**
 * BDL REVENUE AUDIT BACKEND
 * Lead Persistence & GSheet Interactions
 */

function getAll() {
  return {
    leads:    getTabData(SHEETS.LEADS),
    archived: getTabData(SHEETS.ARCHIVED),
    deleted:  getTabData(SHEETS.DELETED),
    clients:  getTabData(SHEETS.CLIENTS),
  }
}

function getTabData(tabName) {
  const sheet = getSpreadsheet().getSheetByName(tabName)
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

function addLead(lead) {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.LEADS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => {
    if (h === 'outreachLog' || h === 'contacts') return JSON.stringify(lead[h] || []);
    if (h === 'pitchSent') return lead[h] ? 'TRUE' : 'FALSE';
    return lead[h] !== undefined ? lead[h] : '';
  });
  sheet.appendRow(row);
  return { success: true }
}

function updateLead(id, changes, tabName) {
  const sheet = getSpreadsheet().getSheetByName(tabName)
  if (!sheet) return { error: 'Tab not found: ' + tabName }
  const data = sheet.getDataRange().getValues()
  const headers = data[0]
  const idCol = headers.indexOf('id')
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

function moveLead(id, fromTab, toTab, changes) {
  const ss = getSpreadsheet()
  const fromSheet = ss.getSheetByName(fromTab)
  const toSheet = ss.getSheetByName(toTab)
  if (!fromSheet || !toSheet) return { error: 'Tab mapping error' }
  const fromData = fromSheet.getDataRange().getValues()
  const fromHeaders = fromData[0]
  const toHeaders = toSheet.getRange(1, 1, 1, toSheet.getLastColumn()).getValues()[0]
  const idCol = fromHeaders.indexOf('id')
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

function saveCalculatorLead(lead) {
  const sheet = getOrCreateSheet(SHEETS.CALC_LEADS, DEFAULT_CALC_LEAD_HEADERS);
  if (!lead.id) lead.id = 'BDL-' + Math.random().toString(36).substr(2, 6).toUpperCase(); 

  // Spam & Rate Limit Protection
  if (lead.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email.trim())) {
      return { error: 'Invalid email address.' };
    }
    if (!isValidEmailDomain(lead.email)) {
      return { error: 'Email domain is invalid or does not have mail servers.' };
    }
    if (lead.business && lead.business.trim().length < 2) {
      return { error: 'Invalid business name.' };
    }
    const emailKey = 'rl_' + String(lead.email).toLowerCase().replace(/[^a-z0-9]/g, '_');
    const cache = CacheService.getScriptCache();
    const lastTime = cache.get(emailKey);
    if (lastTime) {
      const elapsed = Date.now() - Number(lastTime);
      if (elapsed < 30000) { // 30s throttle
        return { error: 'Rate limit exceeded. Please wait a few seconds before resubmitting.' };
      }
    }
    cache.put(emailKey, String(Date.now()), 60); // Store for 1 minute
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  const emailCol = headers.indexOf('email');
  if (idCol === -1 || emailCol === -1) return { error: 'Headers missing' };

  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (lead.id && String(data[i][idCol]||'').trim() === String(lead.id)) { rowIndex = i + 1; break; }
  }

  const rowValues = headers.map(h => {
    let val = lead[h] !== undefined ? lead[h] : '';
    if (h === 'phone') return "'" + String(val);
    return val;
  });

  if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  else sheet.appendRow(rowValues);

  if (lead.email) {
    const isRequested = lead.paidReport === 'Requested';
    
    // 1. Email notification to Admin
    sendAdminNotificationEmail(lead, isRequested);
    
    // 2. Google Chat notification
    let msg = "";
    if (isRequested) {
      msg = `🔥 *New Audit Request Received*\n` +
            `*Business:* ${lead.business || '—'}\n` +
            `*Niche:* ${lead.niche || '—'}\n` +
            `*Contact:* ${lead.name || '—'} (${lead.email})\n` +
            (lead.jobTitle ? `*Job Title:* ${lead.jobTitle}\n` : '') +
            `*Phone:* ${lead.phone || '—'}\n` +
            `*Est. Leakage:* $${Number(lead.totalLeakage || 0).toLocaleString()}/mo`;
    } else {
      msg = `📊 *New Calculator Submission*\n` +
            `*Business:* ${lead.business || '—'} (${lead.niche || '—'})\n` +
            `*Est. Leakage:* $${Number(lead.totalLeakage || 0).toLocaleString()}/mo`;
    }
    sendWebhookNotification(msg);
  }

  if (lead.email && lead.paidReport === 'Requested') { lead.paidReport = 'Payment Pending'; sendConfirmationEmail(lead); }
  return { success: true };
}

function getCalculatorLeads() {
  const sheet = getOrCreateSheet(SHEETS.CALC_LEADS, DEFAULT_CALC_LEAD_HEADERS);
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { success: true, leads: [] };
  const headers = rows[0];
  const leads = rows.slice(1).map(row => {
    const lead = {};
    DEFAULT_CALC_LEAD_HEADERS.forEach(h => {
      const colIndex = headers.indexOf(h);
      lead[h] = colIndex !== -1 ? row[colIndex] || '' : '';
    });
    return lead;
  });
  return { success: true, leads: leads.reverse() };
}

function getDeletedLeads() {
  const sheet = getOrCreateSheet(SHEETS.DELETED, DEFAULT_CALC_LEAD_HEADERS);
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { success: true, leads: [] };
  const headers = rows[0];
  const leads = rows.slice(1).map(row => {
    const lead = {};
    DEFAULT_CALC_LEAD_HEADERS.forEach(h => {
      const colIndex = headers.indexOf(h);
      lead[h] = colIndex !== -1 ? row[colIndex] || '' : '';
    });
    return lead;
  });
  return { success: true, leads: leads.reverse() };
}

function markPaymentPaid(identifier, changes) {
  const sheet = getOrCreateSheet(SHEETS.CALC_LEADS, DEFAULT_CALC_LEAD_HEADERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
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
      const lead = headers.reduce((obj, h, j) => { obj[h] = data[i][j]; return obj; }, {});
      lead.paidReport = 'Paid';
      sendPaymentReceiptEmail(lead);
      const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      getOrCreateSheet(SHEETS.VERIFIED, DEFAULT_VERIFIED_HEADERS).appendRow([changes.paymentReference || lead.id, lead.email, lead.business, lead.niche, lead.totalLeakage, SETTINGS.REPORT_PRICE, date, 'Paid']);
      generateAndSendReport(lead, lead.email, "Payment verified. Your Executive Revenue Diagnostic is attached.", "", null);
      return { success: true };
    }
  }
  return { error: 'Lead not found' };
}

function deleteCalculatorLead(identifier) {
  const sheet = getOrCreateSheet(SHEETS.CALC_LEADS, DEFAULT_CALC_LEAD_HEADERS);
  const delSheet = getOrCreateSheet(SHEETS.DELETED, DEFAULT_CALC_LEAD_HEADERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id'), emailCol = headers.indexOf('email');
  const lookupValue = String(identifier || '').trim();
  const isEmail = lookupValue.includes('@');

  for (let i = 1; i < data.length; i++) {
    const matched = (isEmail && String(data[i][emailCol]).toLowerCase() === lookupValue.toLowerCase()) || (!isEmail && String(data[i][idCol]).trim() === lookupValue);
    if (matched) {
      delSheet.appendRow(data[i]);
      sheet.deleteRow(i + 1); 
      return { success: true }; 
    }
  }
  return { error: 'Lead not found' };
}

/**
 * Updates a calculator lead using either ID or Email as an identifier.
 */
function updateCalculatorLead(identifier, changes) {
  const sheet = getOrCreateSheet(SHEETS.CALC_LEADS, DEFAULT_CALC_LEAD_HEADERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  const emailCol = headers.indexOf('email');
  const lookup = String(identifier || '').trim().toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const rowId = String(data[i][idCol] || '').trim().toLowerCase();
    const rowEmail = String(data[i][emailCol] || '').trim().toLowerCase();
    if (rowId === lookup || rowEmail === lookup) {
      Object.keys(changes).forEach(key => {
        const col = headers.indexOf(key);
        if (col !== -1) sheet.getRange(i + 1, col + 1).setValue(changes[key]);
      });
      return { success: true };
    }
  }
  return { error: 'Lead not found' };
}

/**
 * Retrieves a full lead object by ID or Email.
 */
function getLeadByIdentifier(identifier) {
  const sheet = getOrCreateSheet(SHEETS.CALC_LEADS, DEFAULT_CALC_LEAD_HEADERS);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;
  const headers = data[0];
  const idCol = headers.indexOf('id');
  const emailCol = headers.indexOf('email');
  const lookup = String(identifier || '').trim().toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const rowId = String(data[i][idCol] || '').trim().toLowerCase();
    const rowEmail = String(data[i][emailCol] || '').trim().toLowerCase();
    if (rowId === lookup || rowEmail === lookup) {
      return headers.reduce((obj, h, j) => { obj[h] = data[i][j]; return obj; }, {});
    }
  }
  return null;
}

// ── Templates CRUD ─────────────────────────────────────────────────────────

function getTemplates() {
  const sheet = getOrCreateSheet(SHEETS.TEMPLATES, DEFAULT_TEMPLATE_HEADERS);
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { success: true, templates: [] };
  const headers = rows[0];
  const templates = rows.slice(1).map(row => {
    const t = {};
    headers.forEach((h, i) => { t[h] = row[i] === undefined ? '' : String(row[i]); });
    return t;
  }).filter(t => t.id && t.id !== '');
  return { success: true, templates };
}

function saveTemplate(template) {
  const sheet = getOrCreateSheet(SHEETS.TEMPLATES, DEFAULT_TEMPLATE_HEADERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');

  // Generate id if new
  if (!template.id) {
    template.id = 'tpl-' + Date.now().toString(36);
    template.createdAt = new Date().toISOString();
  }

  const rowValues = DEFAULT_TEMPLATE_HEADERS.map(h => template[h] !== undefined ? template[h] : '');

  // Check if exists → update in place
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(template.id)) {
      sheet.getRange(i + 1, 1, 1, rowValues.length).setValues([rowValues]);
      return { success: true, id: template.id };
    }
  }

  // New row
  sheet.appendRow(rowValues);
  return { success: true, id: template.id };
}

function deleteTemplate(id) {
  const sheet = getOrCreateSheet(SHEETS.TEMPLATES, DEFAULT_TEMPLATE_HEADERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Template not found: ' + id };
}