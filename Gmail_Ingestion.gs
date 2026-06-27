/**
 * BDL REVENUE CRM BACKEND
 * Gmail Ingestion Feed & Sent Outreach Log Sync
 */

/**
 * Searches connected accounts' inboxes (or fallback to the owner's inbox)
 * for unprocessed campaign emails matching the query.
 */
function getGmailInboxFeed() {
  try {
    const connectedAccounts = getConnectedAccountsList();
    const activeAccounts = connectedAccounts.filter(a => a.status === 'Connected');
    
    if (activeAccounts.length === 0) {
      // Fallback to legacy GmailApp scanning for script owner
      return getGmailInboxFeedLegacy();
    }
    
    let combinedFeed = [];
    activeAccounts.forEach(account => {
      try {
        const accessToken = getGmailApiClient(account.email);
        if (!accessToken) return;
        const res = getGmailInboxFeedForAccount(account.email, accessToken);
        if (res.feed) {
          combinedFeed = combinedFeed.concat(res.feed);
        }
      } catch (err) {
        Logger.log('Error fetching feed for ' + account.email + ': ' + err.toString());
      }
    });
    
    // Sort combinedFeed by date descending (newest replies first)
    combinedFeed.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return { success: true, feed: combinedFeed };
  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * Fetch feed for a specific connected account via Gmail REST API.
 */
function getGmailInboxFeedForAccount(email, accessToken) {
  const query = getGmailSearchQuery();
  const searchUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/threads?q=' + encodeURIComponent(query) + '&maxResults=15';
  const response = UrlFetchApp.fetch(searchUrl, {
    headers: { 'Authorization': 'Bearer ' + accessToken },
    muteHttpExceptions: true
  });
  
  if (response.getResponseCode() !== 200) {
    return { error: 'Failed to search threads for ' + email + ': ' + response.getContentText() };
  }
  
  const threadList = JSON.parse(response.getContentText()).threads || [];
  const feed = [];
  
  if (threadList.length === 0) return { feed: [] };
  
  const processedLabelId = getOrCreateGmailRestLabel(accessToken, 'BDL-Processed');
  
  for (let t of threadList) {
    const threadUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/threads/' + t.id;
    const threadRes = UrlFetchApp.fetch(threadUrl, {
      headers: { 'Authorization': 'Bearer ' + accessToken },
      muteHttpExceptions: true
    });
    if (threadRes.getResponseCode() !== 200) continue;
    const threadData = JSON.parse(threadRes.getContentText());
    
    const messages = threadData.messages || [];
    if (messages.length === 0) continue;
    
    // Check if BDL-Processed label is on the thread (check messages or thread labelIds)
    let isProcessed = false;
    messages.forEach(m => {
      if ((m.labelIds || []).includes(processedLabelId)) {
        isProcessed = true;
      }
    });
    if (isProcessed) continue;
    
    const lastMsg = messages[messages.length - 1];
    
    let sender = "";
    let recipient = "";
    let subject = "";
    let dateStr = "";
    
    const headers = lastMsg.payload?.headers || [];
    headers.forEach(h => {
      const name = h.name.toLowerCase();
      if (name === 'from') sender = h.value;
      if (name === 'to') recipient = h.value;
      if (name === 'subject') subject = h.value;
      if (name === 'date') dateStr = h.value;
    });
    
    if (!subject) {
      const firstHeaders = messages[0].payload?.headers || [];
      firstHeaders.forEach(h => {
        if (h.name.toLowerCase() === 'subject') subject = h.value;
      });
    }
    
    const snippet = lastMsg.snippet || "";
    const date = dateStr ? new Date(dateStr) : new Date();
    
    const prospect = getProspectFromThread(messages, subject, snippet);
    const feedSender = prospect ? (prospect.name ? `"${prospect.name}" <${prospect.email}>` : prospect.email) : sender;
    const feedRecipient = prospect ? email : recipient;
    
    feed.push({
      threadId: t.id + '::' + email, // Key with email context
      subject: subject,
      sender: feedSender,
      recipient: feedRecipient,
      date: date.toISOString(),
      snippet: snippet
    });
  }
  return { feed: feed };
}

/**
 * Searches the jamescluster35@gmail.com inbox for unprocessed campaign emails. (Legacy)
 */
function getGmailInboxFeedLegacy() {
  const query = getGmailSearchQuery();
  const threads = GmailApp.search(query, 0, 15);
  const feed = [];
  
  threads.forEach(t => {
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
    
    const prospect = getProspectFromThread(messages, subject, snippet);
    const feedSender = prospect ? (prospect.name ? `"${prospect.name}" <${prospect.email}>` : prospect.email) : sender;
    const feedRecipient = prospect ? Session.getEffectiveUser().getEmail() : recipient;

    feed.push({
      threadId: t.getId(), // No :: context
      subject: subject,
      sender: feedSender,
      recipient: feedRecipient,
      date: date.toISOString(),
      snippet: snippet
    });
  });
  return { success: true, feed: feed };
}

/**
 * Parses the thread contents, links it to an existing lead (flagging them as Warm)
 * or creates a new lead automatically, and marks the thread as processed.
 */
function processGmailThread(data) {
  try {
    let threadId = "";
    if (typeof data === 'string') {
      threadId = data;
    } else if (data && data.threadId) {
      threadId = data.threadId;
    }
    
    if (!threadId) return { error: 'Missing threadId' };
    
    const parts = threadId.split('::');
    const targetThreadId = parts[0];
    const accountEmail = parts[1];
    
    if (!accountEmail) {
      // Fallback to legacy GmailApp for script owner
      return processGmailThreadLegacy(targetThreadId);
    }
    
    const accessToken = getGmailApiClient(accountEmail);
    if (!accessToken) {
      return { error: 'Could not get authorization for account: ' + accountEmail };
    }
    
    return processGmailThreadRest(targetThreadId, accountEmail, accessToken);
  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * Process a thread via Gmail REST API.
 */
function processGmailThreadRest(threadId, accountEmail, accessToken) {
  const threadUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/threads/' + threadId;
  const response = UrlFetchApp.fetch(threadUrl, {
    headers: { 'Authorization': 'Bearer ' + accessToken },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) {
    return { error: 'Thread not found on ' + accountEmail + ': ' + response.getContentText() };
  }
  const threadData = JSON.parse(response.getContentText());
  const messages = threadData.messages || [];
  if (messages.length === 0) return { error: 'No messages in thread' };
  
  const lastMsg = messages[messages.length - 1];
  
  let fromField = "";
  let subject = "";
  const headers = lastMsg.payload?.headers || [];
  headers.forEach(h => {
    if (h.name.toLowerCase() === 'from') fromField = h.value;
    if (h.name.toLowerCase() === 'subject') subject = h.value;
  });
  
  if (!subject) {
    const firstHeaders = messages[0].payload?.headers || [];
    firstHeaders.forEach(h => {
      if (h.name.toLowerCase() === 'subject') subject = h.value;
    });
  }
  
  let snippet = lastMsg.snippet || "";
  
  let email = "";
  let name = "";
  
  const prospect = getProspectFromThread(messages, subject, snippet);
  if (prospect) {
    email = prospect.email;
    name = prospect.name;
  }
  
  if (!email) {
    return { error: 'Could not resolve prospect email from thread' };
  }
  
  const leadSheet = getSpreadsheet().getSheetByName(SHEETS.LEADS);
  const data = leadSheet.getDataRange().getValues();
  const leadHeaders = data[0];
  const emailCol = leadHeaders.indexOf('email');
  const statusCol = leadHeaders.indexOf('status');
  const logCol = leadHeaders.indexOf('outreachLog');
  const lastContactCol = leadHeaders.indexOf('lastContacted');
  const followUpCol = leadHeaders.indexOf('followUpCount');
  
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
    notes: `📥 Reply Received via ${accountEmail}: "${snippet.substring(0, 250)}${snippet.length > 250 ? '...' : ''}"`
  };
  
  if (leadRow > 0 && existingLead) {
    leadSheet.getRange(leadRow, statusCol + 1).setValue('Warm');
    leadSheet.getRange(leadRow, lastContactCol + 1).setValue(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    
    let logs = [];
    try { logs = JSON.parse(existingLead[logCol] || '[]'); } catch(e) {}
    logs.push(replyLogEntry);
    leadSheet.getRange(leadRow, logCol + 1).setValue(JSON.stringify(logs));
    
    const currentCount = Number(existingLead[followUpCol] || 0);
    leadSheet.getRange(leadRow, followUpCol + 1).setValue(currentCount + 1);
  } else {
    const id = 'BDL-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    const num = data.length;
    
    const newLead = leadHeaders.map(h => {
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
  
  // Tag thread as processed by adding the BDL-Processed label
  const processedLabelId = getOrCreateGmailRestLabel(accessToken, 'BDL-Processed');
  const modifyUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/threads/' + threadId + '/modify';
  const modifyRes = UrlFetchApp.fetch(modifyUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({ addLabelIds: [processedLabelId] }),
    muteHttpExceptions: true
  });
  
  if (modifyRes.getResponseCode() !== 200) {
    Logger.log('Warning: Failed to add processed label to thread ' + threadId + ': ' + modifyRes.getContentText());
  }
  
  return { success: true, parsedEmail: email };
}

/**
 * Legacy local thread processor using GmailApp.
 */
function processGmailThreadLegacy(threadId) {
  const thread = GmailApp.getThreadById(threadId);
  if (!thread) return { error: 'Thread not found' };
  
  const messages = thread.getMessages();
  if (messages.length === 0) return { error: 'No messages in thread' };
  
  const lastMsg = messages[messages.length - 1];
  const fromField = lastMsg.getFrom();
  const subject = thread.getFirstMessageSubject() || "";
  const snippet = lastMsg.getPlainBody().trim();
  
  let email = "";
  let name = "";
  
  const prospect = getProspectFromThread(messages, subject, snippet);
  if (prospect) {
    email = prospect.email;
    name = prospect.name;
  }
  
  if (!email) {
    return { error: 'Could not resolve prospect email from thread' };
  }
  
  const leadSheet = getSpreadsheet().getSheetByName(SHEETS.LEADS);
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
    leadSheet.getRange(leadRow, statusCol + 1).setValue('Warm');
    leadSheet.getRange(leadRow, lastContactCol + 1).setValue(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    
    let logs = [];
    try { logs = JSON.parse(existingLead[logCol] || '[]'); } catch(e) {}
    logs.push(replyLogEntry);
    leadSheet.getRange(leadRow, logCol + 1).setValue(JSON.stringify(logs));
    
    const currentCount = Number(existingLead[followUpCol] || 0);
    leadSheet.getRange(leadRow, followUpCol + 1).setValue(currentCount + 1);
  } else {
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
  
  const processedLabel = getOrCreateGmailLabel('BDL-Processed');
  thread.addLabel(processedLabel);
  
  return { success: true, parsedEmail: email };
}

/**
 * Iterates connected accounts (or fallback to script owner)
 * and syncs sent outreach emails to CRM logs.
 */
function syncOutreachLogsFromGmail() {
  try {
    const connectedAccounts = getConnectedAccountsList();
    const activeAccounts = connectedAccounts.filter(a => a.status === 'Connected');
    
    if (activeAccounts.length === 0) {
      return syncOutreachLogsFromGmailLegacy();
    }
    
    let totalSynced = 0;
    activeAccounts.forEach(account => {
      try {
        const accessToken = getGmailApiClient(account.email);
        if (!accessToken) return;
        
        const syncRes = syncOutreachLogsForAccount(account.email, accessToken);
        if (syncRes.success) {
          totalSynced += syncRes.syncedCount;
        }
      } catch (err) {
        Logger.log('Error syncing outreach logs for ' + account.email + ': ' + err.toString());
      }
    });
    
    return { success: true, syncedLeadsCount: totalSynced };
  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * Fetch sent messages for a connected account in the last 30 days and link them.
 */
function syncOutreachLogsForAccount(email, accessToken) {
  const date30DaysAgo = new Date();
  date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);
  const yyyy = date30DaysAgo.getFullYear();
  const mm = String(date30DaysAgo.getMonth() + 1).padStart(2, '0');
  const dd = String(date30DaysAgo.getDate()).padStart(2, '0');
  
  const query = `after:${yyyy}/${mm}/${dd}`;
  const searchUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=' + encodeURIComponent(query) + '&maxResults=200';
  const response = UrlFetchApp.fetch(searchUrl, {
    headers: { 'Authorization': 'Bearer ' + accessToken },
    muteHttpExceptions: true
  });
  
  if (response.getResponseCode() !== 200) {
    return { error: 'Failed to search sent messages for ' + email + ': ' + response.getContentText() };
  }
  
  const messagesList = JSON.parse(response.getContentText()).messages || [];
  if (messagesList.length === 0) return { success: true, syncedCount: 0 };
  
  const leadSheet = getSpreadsheet().getSheetByName(SHEETS.LEADS);
  if (!leadSheet) return { error: 'Leads tab not found' };
  const data = leadSheet.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf('email');
  const logCol = headers.indexOf('outreachLog');
  const followUpCol = headers.indexOf('followUpCount');
  const lastContactCol = headers.indexOf('lastContacted');
  
  const leadMap = {};
  for (let i = 1; i < data.length; i++) {
    const leadEmail = String(data[i][emailCol]).trim().toLowerCase();
    if (leadEmail && leadEmail.includes('@')) {
      leadMap[leadEmail] = {
        row: i + 1,
        outreachLog: data[i][logCol],
        followUpCount: Number(data[i][followUpCol] || 0),
        lastContacted: data[i][lastContactCol],
        updated: false
      };
    }
  }
  
  for (let mSummary of messagesList) {
    const msgUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + mSummary.id + '?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date';
    const msgRes = UrlFetchApp.fetch(msgUrl, {
      headers: { 'Authorization': 'Bearer ' + accessToken },
      muteHttpExceptions: true
    });
    if (msgRes.getResponseCode() !== 200) continue;
    const msgData = JSON.parse(msgRes.getContentText());
    
    let from = "";
    let to = "";
    let subject = "";
    let dateStr = "";
    
    const headersList = msgData.payload?.headers || [];
    headersList.forEach(h => {
      const name = h.name.toLowerCase();
      if (name === 'from') from = h.value;
      if (name === 'to') to = h.value;
      if (name === 'subject') subject = h.value;
      if (name === 'date') dateStr = h.value;
    });
    
    if (!to) continue;
    
    const fromEmailMatch = from.match(/<([^>]+)>/) || [null, from];
    const fromEmail = (fromEmailMatch[1] || from).trim().toLowerCase();
    if (fromEmail !== email.toLowerCase()) {
      continue; // Not sent by this connected account
    }
    
    const emailsFound = extractEmails(to);
    emailsFound.forEach(recipientEmail => {
      const lead = leadMap[recipientEmail];
      if (lead) {
        let logs = [];
        try { logs = JSON.parse(lead.outreachLog || '[]'); } catch(e) {}
        
        const mDate = dateStr ? new Date(dateStr) : new Date();
        const formattedDate = mDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        const isDuplicate = logs.some(l => l.notes && l.notes.includes(subject) && l.date.includes(formattedDate));
        if (!isDuplicate) {
          logs.push({
            date: mDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            type: 'Email Sent',
            sender: from,
            notes: `📤 Outreach Sent from ${email}: "${subject}"`
          });
          lead.outreachLog = JSON.stringify(logs);
          lead.followUpCount = lead.followUpCount + 1;
          
          const lastContactDate = lead.lastContacted ? new Date(lead.lastContacted) : null;
          if (!lastContactDate || mDate > lastContactDate) {
            lead.lastContacted = mDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          }
          lead.updated = true;
        }
      }
    });
  }
  
  let syncCount = 0;
  Object.keys(leadMap).forEach(recipientEmail => {
    const lead = leadMap[recipientEmail];
    if (lead.updated) {
      leadSheet.getRange(lead.row, logCol + 1).setValue(lead.outreachLog);
      leadSheet.getRange(lead.row, followUpCol + 1).setValue(lead.followUpCount);
      leadSheet.getRange(lead.row, lastContactCol + 1).setValue(lead.lastContacted);
      syncCount++;
    }
  });
  
  return { success: true, syncedCount: syncCount };
}

/**
 * Legacy local inbox sync. (Fallback)
 */
function syncOutreachLogsFromGmailLegacy() {
  const leadSheet = getSpreadsheet().getSheetByName(SHEETS.LEADS);
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
}

/**
 * Background runner to sync both replies and logs.
 */
function syncCampaignMailsAndReplies() {
  const connectedAccounts = getConnectedAccountsList();
  const activeAccounts = connectedAccounts.filter(a => a.status === 'Connected');
  
  if (activeAccounts.length === 0) {
    // Legacy sync trigger execution
    const feedRes = getGmailInboxFeedLegacy();
    if (feedRes.success && feedRes.feed) {
      feedRes.feed.forEach(item => {
        processGmailThreadLegacy(item.threadId);
      });
    }
    syncOutreachLogsFromGmailLegacy();
    return;
  }
  
  activeAccounts.forEach(account => {
    try {
      const accessToken = getGmailApiClient(account.email);
      if (!accessToken) return;
      
      const feedRes = getGmailInboxFeedForAccount(account.email, accessToken);
      if (feedRes.feed && feedRes.feed.length > 0) {
        feedRes.feed.forEach(item => {
          // Splitting :: key is handled in processGmailThread, but we call Rest directly for convenience here
          const parts = item.threadId.split('::');
          processGmailThreadRest(parts[0], account.email, accessToken);
        });
      }
      
      syncOutreachLogsForAccount(account.email, accessToken);
    } catch (err) {
      Logger.log('Cron Ingest Error for ' + account.email + ': ' + err.toString());
      updateConnectedAccountStatus(account.email, 'Error: ' + err.message.substring(0, 100));
    }
  });
}

/**
 * Exchanging refresh token for access token.
 */
function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const payload = {
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token'
  };
  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    payload: payload,
    muteHttpExceptions: true
  });
  
  const resCode = response.getResponseCode();
  const resText = response.getContentText();
  
  if (resCode === 200) {
    return JSON.parse(resText).access_token;
  }
  throw new Error('Failed to refresh access token: ' + resText);
}

/**
 * Fetch and return a valid Gmail API client access token.
 */
function getGmailApiClient(email) {
  const connList = getConnectedAccountsList();
  const account = connList.find(a => a.email.toLowerCase() === email.toLowerCase());
  if (!account || !account.refreshToken) return null;
  
  const configSheet = getConfigSheet();
  const clientId = configSheet ? String(configSheet.getRange('A6').getValue()).trim() : '';
  const clientSecret = configSheet ? String(configSheet.getRange('A7').getValue()).trim() : '';
  
  if (!clientId || !clientSecret) return null;
  
  return refreshAccessToken(account.refreshToken, clientId, clientSecret);
}

/**
 * Get or create label in Gmail REST API.
 */
function getOrCreateGmailRestLabel(accessToken, labelName) {
  const listRes = UrlFetchApp.fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    headers: { 'Authorization': 'Bearer ' + accessToken },
    muteHttpExceptions: true
  });
  if (listRes.getResponseCode() !== 200) {
    throw new Error('Failed to list Gmail labels: ' + listRes.getContentText());
  }
  const data = JSON.parse(listRes.getContentText());
  const found = (data.labels || []).find(l => l.name.toLowerCase() === labelName.toLowerCase());
  if (found) return found.id;
  
  const createRes = UrlFetchApp.fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show'
    }),
    muteHttpExceptions: true
  });
  
  if (createRes.getResponseCode() !== 200) {
    throw new Error('Failed to create Gmail label BDL-Processed: ' + createRes.getContentText());
  }
  return JSON.parse(createRes.getContentText()).id;
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
 * Helper to get or create Gmail label. (Local/Legacy)
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

/**
 * Retrieves all connected account emails and the script owner's email
 * to filter out campaign senders.
 */
function getCampaignEmails() {
  const emails = [];
  try {
    const list = getConnectedAccountsList();
    if (list && Array.isArray(list)) {
      list.forEach(a => {
        if (a.email) emails.push(a.email.toLowerCase().trim());
      });
    }
  } catch(e) {
    Logger.log("Error fetching connected accounts for campaign filter: " + e.toString());
  }
  
  try {
    const ownerEmail = Session.getEffectiveUser().getEmail();
    if (ownerEmail) {
      const lowerOwner = ownerEmail.toLowerCase().trim();
      if (!emails.includes(lowerOwner)) emails.push(lowerOwner);
    }
  } catch(e) {
    Logger.log("Error getting effective user email: " + e.toString());
  }
  
  return emails;
}

/**
 * Resolves the prospect's name and email from a thread's messages,
 * ignoring all campaign email addresses.
 */
function getProspectFromThread(messages, subject, snippet) {
  let email = "";
  let name = "";
  
  const campaignEmails = getCampaignEmails();
  
  // 1. First check if it's a forwarded thread and parse the original sender from the snippet
  const isForwarded = String(subject || '').toLowerCase().startsWith("fwd:") || String(snippet || '').includes("---------- Forwarded message");
  if (isForwarded) {
    const fromMatch = String(snippet || '').match(/From:\s*([^<\r\n]+)(?:<([^>]+)>)?/i);
    if (fromMatch) {
      if (fromMatch[2]) {
        email = fromMatch[2].trim().toLowerCase();
        name = fromMatch[1].replace(/['"]/g, '').trim();
      } else {
        email = fromMatch[1].trim().toLowerCase();
        name = email.split('@')[0];
      }
    }
  }
  
  // If we resolved a valid non-campaign email from the forward header, return it
  if (email && !campaignEmails.includes(email)) {
    return { email: email, name: name };
  }
  
  // 2. Loop through all messages in the thread (newest first) to find a non-campaign sender
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    let fromField = "";
    
    if (msg.payload && msg.payload.headers) {
      // REST API format
      const headers = msg.payload.headers;
      headers.forEach(h => {
        if (h.name.toLowerCase() === 'from') fromField = h.value;
      });
    } else if (typeof msg.getFrom === 'function') {
      // Legacy GmailApp format
      fromField = msg.getFrom();
    }
    
    if (fromField) {
      let msgEmail = "";
      const emailMatch = fromField.match(/<([^>]+)>/);
      if (emailMatch) msgEmail = emailMatch[1].trim().toLowerCase();
      else msgEmail = fromField.trim().toLowerCase();
      
      if (msgEmail && !campaignEmails.includes(msgEmail)) {
        let msgName = "";
        const nameMatch = fromField.match(/^([^<]+)/);
        if (nameMatch) msgName = nameMatch[1].replace(/['"]/g, '').trim();
        else msgName = msgEmail.split('@')[0];
        
        return { email: msgEmail, name: msgName };
      }
    }
  }
  
  // 3. Fallback: If all messages are from campaign accounts, get the recipient of the first message
  if (messages.length > 0) {
    const firstMsg = messages[0];
    let toField = "";
    
    if (firstMsg.payload && firstMsg.payload.headers) {
      const headers = firstMsg.payload.headers;
      headers.forEach(h => {
        if (h.name.toLowerCase() === 'to') toField = h.value;
      });
    } else if (typeof firstMsg.getTo === 'function') {
      toField = firstMsg.getTo();
    }
    
    if (toField) {
      let msgEmail = "";
      const emailMatch = toField.match(/<([^>]+)>/);
      if (emailMatch) msgEmail = emailMatch[1].trim().toLowerCase();
      else msgEmail = toField.trim().toLowerCase();
      
      if (msgEmail && !campaignEmails.includes(msgEmail)) {
        let msgName = "";
        const nameMatch = toField.match(/^([^<]+)/);
        if (nameMatch) msgName = nameMatch[1].replace(/['"]/g, '').trim();
        else msgName = msgEmail.split('@')[0];
        
        return { email: msgEmail, name: msgName };
      }
    }
  }
  
  return null;
}

/**
 * Simple email extractor helper.
 */
function extractEmails(text) {
  const emails = [];
  const regex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    emails.push(match[1].toLowerCase().trim());
  }
  return emails;
}

/**
 * Sends a calculator link reply to a prospect's email thread, including the handoff to James.
 */
function sendCalculatorLinkToLead(threadId) {
  try {
    if (!threadId) return { error: 'Missing threadId' };
    
    const parts = threadId.split('::');
    const targetThreadId = parts[0];
    const accountEmail = parts[1];
    
    if (!accountEmail) {
      return { error: 'Direct Gmail Integration is required for this action' };
    }
    
    const accessToken = getGmailApiClient(accountEmail);
    if (!accessToken) {
      return { error: 'Could not get authorization for account: ' + accountEmail };
    }
    
    // Fetch thread details to get original headers and sender details
    const threadUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/threads/' + targetThreadId;
    const response = UrlFetchApp.fetch(threadUrl, {
      headers: { 'Authorization': 'Bearer ' + accessToken },
      muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) {
      return { error: 'Thread not found on ' + accountEmail + ': ' + response.getContentText() };
    }
    
    const threadData = JSON.parse(response.getContentText());
    const messages = threadData.messages || [];
    if (messages.length === 0) return { error: 'No messages in thread' };
    
    const lastMsg = messages[messages.length - 1];
    
    // Find Headers
    let originalFrom = "";
    let originalSubject = "";
    let messageId = "";
    const headers = lastMsg.payload?.headers || [];
    headers.forEach(h => {
      const name = h.name.toLowerCase();
      if (name === 'from') originalFrom = h.value;
      if (name === 'subject') originalSubject = h.value;
      if (name === 'message-id') messageId = h.value;
    });
    
    if (!originalSubject) {
      const firstHeaders = messages[0].payload?.headers || [];
      firstHeaders.forEach(h => {
        if (h.name.toLowerCase() === 'subject') originalSubject = h.value;
      });
    }
    
    // Resolve the prospect's email and name from the thread messages
    const prospect = getProspectFromThread(messages, originalSubject, lastMsg.snippet || "");
    if (!prospect || !prospect.email) {
      return { error: 'Could not resolve prospect email from thread messages' };
    }
    const prospectEmail = prospect.email;
    const prospectName = prospect.name;
    
    // Capitalize first name
    let firstName = prospectName.split(' ')[0];
    if (firstName) {
      firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
    } else {
      firstName = "there";
    }
    
    // Look up the active sender name and title from our AccountMap
    const AccountMap = {
      "emmajohnson.114584@gmail.com": { Name: "Emma Johnson", Title: "Hospitality Revenue Consultant" },
      "franktoczek.data@gmail.com": { Name: "Frank Toczek", Title: "Hotel Operations Consultant" },
      "kevinamanda.dataoutreach@gmail.com": { Name: "Kevin Amanda", Title: "Hospitality Advisor" },
      "martinseidel.dataoutreach@gmail.com": { Name: "Martin Seidel", Title: "Independent Lodging Consultant" },
      "lylemorgan884@gmail.com": { Name: "Lyle Morgan", Title: "Direct Booking Advisor" },
      "lylemorgan.data@gmail.com": { Name: "Lyle Morgan", Title: "Direct Booking Advisor" },
      "skinnerdonald.data@gmail.com": { Name: "Skinner Donald", Title: "Hospitality Consultant" },
      "michaelbrauns.dataoutreach@gmail.com": { Name: "Michael Brauns", Title: "Hotel Revenue Strategist" },
      "oestenchristian.dataoutreach@gmail.com": { Name: "Oesten Christian", Title: "Hospitality Operations Consultant" },
      "matthewyoung.data@gmail.com": { Name: "Matthew Young", Title: "Lodging Strategy Advisor" },
      "katecampbell.data@gmail.com": { Name: "Kate Campbell", Title: "Hospitality Consultant" },
      "barrygisser.dataoutreach@gmail.com": { Name: "Barry Gisser", Title: "Revenue Operations Advisor" },
      "williams.dataoutreach@gmail.com": { Name: "William", Title: "Hospitality Advisor" },
      "danperetti.data@gmail.com": { Name: "Dan Peretti", Title: "Hotel Consultant" },
      "jennifer.brooks@bluedatalabs.com": { Name: "Jennifer Brooks", Title: "Senior Hospitality Consultant" }
    };
    
    const sender = AccountMap[accountEmail.toLowerCase().trim()] || { Name: "Hospitality Team", Title: "Revenue Operations Specialist" };
    
    // Construct the subject for reply (Re:)
    let replySubject = originalSubject;
    if (replySubject && !replySubject.toLowerCase().startsWith("re:")) {
      replySubject = "Re: " + replySubject;
    }
    
    // Construct the HTML reply body with a beautifully styled button
    const replyHtml = 
      `<div style="font-family: Arial, sans-serif; max-width: 600px; color: #1E293B; font-size: 14px; line-height: 1.6;">` +
        `<p>Hi ${firstName},</p>` +
        `<p>Here is the link to run your estimated numbers against industry benchmarks:</p>` +
        `<div style="margin: 24px 0;">` +
          `<a href="https://audit.bluedatalabs.com" style="display: inline-block; background-color: #F97316; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px rgba(249,115,22,0.2);">` +
            `Run Your Revenue Audit →` +
          `</a>` +
        `</div>` +
        `<p>My colleague, James, will follow up with you directly to help review the estimates. You can also reach him at <a href="mailto:jamescluster35@gmail.com" style="color: #F97316; text-decoration: none;">jamescluster35@gmail.com</a>.</p>` +
        `<p style="margin-top: 24px;">Best regards,</p>` +
        `<p style="margin: 0; font-weight: bold;">${sender.Name}</p>` +
        `<p style="margin: 0; color: #64748B; font-size: 13px;">${sender.Title}</p>` +
      `</div>`;
    
    // Construct MIME message
    let mimeParts = [];
    const formattedTo = prospectName ? `"${prospectName.replace(/"/g, '\\"')}" <${prospectEmail}>` : prospectEmail;
    mimeParts.push("To: " + formattedTo);
    mimeParts.push("Subject: " + replySubject);
    mimeParts.push("MIME-Version: 1.0");
    mimeParts.push("Content-Type: text/html; charset=UTF-8");
    if (messageId) {
      mimeParts.push("In-Reply-To: " + messageId);
      mimeParts.push("References: " + messageId);
    }
    mimeParts.push(""); // Empty line separating headers from body
    mimeParts.push(replyHtml);
    
    const mimeString = mimeParts.join("\r\n");
    // Encode MIME message base64url
    const raw = Utilities.base64EncodeWebSafe(Utilities.newBlob(mimeString).getBytes());
    
    // Send message via Gmail API
    const sendUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
    const sendRes = UrlFetchApp.fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        raw: raw,
        threadId: targetThreadId
      }),
      muteHttpExceptions: true
    });
    
    if (sendRes.getResponseCode() !== 200) {
      return { error: 'Failed to send reply email: ' + sendRes.getContentText() };
    }
    
    // Tag the thread as processed by adding the BDL-Processed label
    const processedLabelId = getOrCreateGmailRestLabel(accessToken, 'BDL-Processed');
    const modifyUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/threads/' + targetThreadId + '/modify';
    const modifyRes = UrlFetchApp.fetch(modifyUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({ addLabelIds: [processedLabelId] }),
      muteHttpExceptions: true
    });
    
    // Link lead in CRM sheet (mark as Warm / create log entry)
    processGmailThreadRest(targetThreadId, accountEmail, accessToken);
    
    return { success: true };
  } catch (err) {
    return { error: err.toString() };
  }
}
