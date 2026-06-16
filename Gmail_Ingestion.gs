/**
 * BDL REVENUE CRM BACKEND
 * Gmail Ingestion Feed & Sent Outreach Log Sync
 */

/**
 * Searches the jamescluster35@gmail.com inbox for unprocessed campaign emails.
 * Filters threads matching the search query stored in Config sheet A5.
 */
function getGmailInboxFeed() {
  try {
    const query = getGmailSearchQuery();
    const threads = GmailApp.search(query, 0, 15);
    const feed = [];
    
    threads.forEach(t => {
      // Skip if labeled BDL-Processed already
      const labels = t.getLabels().map(l => l.getName());
      if (labels.includes('BDL-Processed')) return;
      
      const messages = t.getMessages();
      if (messages.length === 0) return;
      
      const lastMsg = messages[messages.length - 1];
      const sender = lastMsg.getFrom();
      const recipient = lastMsg.getTo();
      const date = lastMsg.getDate();
      const subject = t.getFirstMessageSubject();
      const snippet = lastMsg.getPlainBody().substring(0, 180);
      
      feed.push({
        threadId: t.getId(),
        subject: subject,
        sender: sender,
        recipient: recipient,
        date: date.toISOString(),
        snippet: snippet
      });
    });
    return { success: true, feed: feed };
  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * Parses the thread contents, links it to an existing lead (flagging them as Warm)
 * or creates a new lead automatically, and marks the thread as processed.
 */
function processGmailThread(threadId) {
  try {
    const thread = GmailApp.getThreadById(threadId);
    if (!thread) return { error: 'Thread not found' };
    
    const messages = thread.getMessages();
    if (messages.length === 0) return { error: 'No messages in thread' };
    
    const lastMsg = messages[messages.length - 1];
    const fromField = lastMsg.getFrom(); // "Sender Name <email@domain.com>"
    
    // Parse email out of From header
    let email = "";
    const emailMatch = fromField.match(/<([^>]+)>/);
    if (emailMatch) email = emailMatch[1].trim().toLowerCase();
    else email = fromField.trim().toLowerCase();
    
    let name = "";
    const nameMatch = fromField.match(/^([^<]+)/);
    if (nameMatch) name = nameMatch[1].replace(/['"]/g, '').trim();
    else name = email.split('@')[0];

    const snippet = lastMsg.getPlainBody().trim();
    
    // Find matching lead in Leads sheet tab
    const leadSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.LEADS);
    const data = leadSheet.getDataRange().getValues();
    const headers = data[0];
    const emailCol = headers.indexOf('email');
    const statusCol = headers.indexOf('status');
    const logCol = headers.indexOf('outreachLog');
    const lastContactCol = headers.indexOf('lastContacted');
    const followUpCol = headers.indexOf('followUpCount');
    
    let leadRow = -1;
    let existingLead = null;
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][emailCol]).trim().toLowerCase() === email) {
        leadRow = i + 1;
        existingLead = data[i];
        break;
      }
    }
    
    const replyLogEntry = {
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      type: 'Email Reply',
      sender: 'Prospect',
      notes: `📥 Reply Received: "${snippet.substring(0, 250)}${snippet.length > 250 ? '...' : ''}"`
    };
    
    if (leadRow > 0 && existingLead) {
      // Lead exists -> flag as Warm and update log
      leadSheet.getRange(leadRow, statusCol + 1).setValue('Warm');
      leadSheet.getRange(leadRow, lastContactCol + 1).setValue(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
      
      let logs = [];
      try { logs = JSON.parse(existingLead[logCol] || '[]'); } catch(e) {}
      logs.push(replyLogEntry);
      leadSheet.getRange(leadRow, logCol + 1).setValue(JSON.stringify(logs));
      
      const currentCount = Number(existingLead[followUpCol] || 0);
      leadSheet.getRange(leadRow, followUpCol + 1).setValue(currentCount + 1);
    } else {
      // Lead doesn't exist -> auto-ingest as new Warm lead
      const id = 'BDL-' + Math.random().toString(36).substr(2, 6).toUpperCase();
      const num = data.length;
      
      const newLead = headers.map(h => {
        if (h === 'id') return id;
        if (h === 'num') return num;
        if (h === 'contact') return name;
        if (h === 'email') return email;
        if (h === 'status') return 'Warm';
        if (h === 'lastContacted') return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        if (h === 'followUpCount') return 1;
        if (h === 'outreachLog') return JSON.stringify([replyLogEntry]);
        if (h === 'company') {
          const domain = email.split('@')[1] || '';
          const domainName = domain.split('.')[0] || '';
          return domainName.charAt(0).toUpperCase() + domainName.slice(1);
        }
        return '';
      });
      leadSheet.appendRow(newLead);
    }
    
    // Tag thread as processed in Gmail
    const processedLabel = getOrCreateGmailLabel('BDL-Processed');
    thread.addLabel(processedLabel);
    
    return { success: true, parsedEmail: email };
  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * Scans sent folders for outreach emails sent to active leads.
 * Updates followUpCount and logs sent details in outreachLog.
 */
function syncOutreachLogsFromGmail() {
  try {
    const leadSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.LEADS);
    if (!leadSheet) return { error: 'Leads tab not found' };
    
    const data = leadSheet.getDataRange().getValues();
    const headers = data[0];
    const emailCol = headers.indexOf('email');
    const logCol = headers.indexOf('outreachLog');
    const followUpCol = headers.indexOf('followUpCount');
    const lastContactCol = headers.indexOf('lastContacted');
    
    let syncCount = 0;
    
    for (let i = 1; i < data.length; i++) {
      const email = String(data[i][emailCol]).trim().toLowerCase();
      if (!email || !email.includes('@')) continue;
      
      const threads = GmailApp.search(`to:${email}`, 0, 10);
      if (threads.length === 0) continue;
      
      let logs = [];
      try { logs = JSON.parse(data[i][logCol] || '[]'); } catch(e) {}
      
      let initialLength = logs.length;
      let followUpCount = 0;
      let lastContactDate = null;
      
      threads.forEach(t => {
        t.getMessages().forEach(m => {
          const from = m.getFrom();
          const to = m.getTo();
          
          if (to.toLowerCase().includes(email)) {
            followUpCount++;
            const mDate = m.getDate();
            if (!lastContactDate || mDate > lastContactDate) lastContactDate = mDate;
            
            const subject = m.getSubject();
            const formattedDate = mDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            
            const isDuplicate = logs.some(l => l.notes && l.notes.includes(subject) && l.date.includes(formattedDate));
            if (!isDuplicate) {
              logs.push({
                date: mDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                type: 'Email Sent',
                sender: from,
                notes: `📤 Outreach Sent: "${subject}"`
              });
            }
          }
        });
      });
      
      if (logs.length > initialLength || followUpCount !== Number(data[i][followUpCol])) {
        leadSheet.getRange(i + 1, logCol + 1).setValue(JSON.stringify(logs));
        leadSheet.getRange(i + 1, followUpCol + 1).setValue(followUpCount);
        if (lastContactDate) {
          leadSheet.getRange(i + 1, lastContactCol + 1).setValue(lastContactDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
        }
        syncCount++;
      }
    }
    return { success: true, syncedLeadsCount: syncCount };
  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * Background runner to sync both replies and logs.
 */
function syncCampaignMailsAndReplies() {
  const feedRes = getGmailInboxFeed();
  if (feedRes.error) return;
  
  const feed = feedRes.feed || [];
  feed.forEach(item => {
    processGmailThread(item.threadId);
  });
  
  syncOutreachLogsFromGmail();
}

/**
 * Registers/re-creates the time-driven trigger to run ingestion check every hour automatically.
 */
function setupGmailTriggers() {
  try {
    const triggerName = 'syncCampaignMailsAndReplies';
    const triggers = ScriptApp.getProjectTriggers();
    for (let trigger of triggers) {
      if (trigger.getHandlerFunction() === triggerName) {
        ScriptApp.deleteTrigger(trigger);
      }
    }
    ScriptApp.newTrigger(triggerName)
      .timeBased()
      .everyHours(1)
      .create();
    return { success: true, message: "Ingestion parser trigger configured hourly." };
  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * Helper to retrieve Gmail search query from sheet cell A5.
 */
function getGmailSearchQuery() {
  const sheet = getConfigSheet();
  if (!sheet) return "label:BDL-Leads";
  const val = String(sheet.getRange('A5').getValue()).trim();
  return val || "label:BDL-Leads";
}

/**
 * Helper to get or create Gmail label.
 */
function getOrCreateGmailLabel(name) {
  let label = GmailApp.getUserLabelByName(name);
  if (!label) label = GmailApp.createLabel(name);
  return label;
}

/**
 * Gets the current Gmail Ingestion settings (search query).
 */
function getIngestionSettings() {
  try {
    const q = getGmailSearchQuery();
    return { success: true, searchQuery: q };
  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * Saves the Gmail Ingestion search query settings to Config sheet cell A5.
 */
function saveIngestionSettings(searchQuery) {
  try {
    const sheet = getConfigSheet();
    if (!sheet) return { error: 'Config sheet not found' };
    sheet.getRange('A5').setValue(String(searchQuery || '').trim());
    return { success: true };
  } catch (e) {
    return { error: e.toString() };
  }
}
