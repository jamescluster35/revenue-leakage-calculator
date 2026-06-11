/**
 * Unit Tests for BDL Revenue Audit Backend
 *
 * IMPORTANT: Run these tests on a COPY of your spreadsheet.
 * These tests will create/delete sheets, modify data, and send emails.
 */

// --- Test Helpers ---

/**
 * Clears all content from a specified sheet.
 * @param {string} sheetName The name of the sheet to clear.
 */
function clearSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    sheet.clearContents();
    sheet.clearFormats();
  }
}

/**
 * Creates a test sheet with given headers, clearing it if it already exists.
 * @param {string} sheetName The name of the sheet to create/prepare.
 * @param {Array<string>} headers An array of header names.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} The prepared sheet.
 */
function createTestSheet(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clearContents();
    sheet.clearFormats();
  }
  if (headers && headers.length > 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}

/**
 * Retrieves a lead from 'Calculator Leads' by ID.
 * @param {string} id The ID of the lead.
 * @returns {object|null} The lead object or null if not found.
 */
function getLeadById(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CALC_LEADS);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;
  const headers = data[0];
  const idCol = headers.indexOf('id');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      const lead = {};
      headers.forEach((h, j) => lead[h] = data[i][j]);
      return lead;
    }
  }
  return null;
}

/**
 * Retrieves a lead from 'Calculator Leads' by email.
 * @param {string} email The email of the lead.
 * @returns {object|null} The lead object or null if not found.
 */
function getLeadByEmail(email) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CALC_LEADS);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;
  const headers = data[0];
  const emailCol = headers.indexOf('email');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][emailCol]).toLowerCase() === String(email).toLowerCase()) {
      const lead = {};
      headers.forEach((h, j) => lead[h] = data[i][j]);
      return lead;
    }
  }
  return null;
}

/**
 * Asserts a condition, logging success or failure.
 * @param {boolean} condition The condition to assert.
 * @param {string} message The message to log.
 */
function assert(condition, message) {
  if (condition) {
    Logger.log("✅ PASS: " + message);
  } else {
    Logger.log("❌ FAIL: " + message);
    throw new Error("Test failed: " + message);
  }
}

// --- Test Functions ---

/**
 * Tests the authentication and configuration retrieval functions.
 */
function testAuthFunctions() {
  Logger.log("--- Running testAuthFunctions ---");
  const configSheet = createTestSheet(SHEETS.CONFIG, []);
  configSheet.getRange('A1').setValue('test_password');
  configSheet.getRange('A2').setValue('https://wise.com/test-link');
  configSheet.getRange('A3').setValue('test_webhook_secret');

  assert(getAdminPassword() === 'test_password', "getAdminPassword should retrieve correct password.");
  assert(getGlobalPaymentLink() === 'https://wise.com/test-link', "getGlobalPaymentLink should retrieve correct link.");
  assert(getWebhookSecret() === 'test_webhook_secret', "getWebhookSecret should retrieve correct secret.");

  // Clean up
  clearSheet(SHEETS.CONFIG);
  Logger.log("--- Finished testAuthFunctions ---");
}

/**
 * Tests saving a new calculator lead.
 */
function testSaveCalculatorLead_NewLead() {
  Logger.log("--- Running testSaveCalculatorLead_NewLead ---");
  createTestSheet(SHEETS.CALC_LEADS, ['id', 'date', 'name', 'email', 'business', 'niche', 'paidReport', 'totalLeakage']);

  const testLead = {
    date: new Date().toLocaleDateString(),
    name: 'Test User',
    email: 'test@example.com',
    business: 'Test Business',
    niche: 'dental',
    paidReport: 'Requested',
    totalLeakage: 1234
  };

  const result = saveCalculatorLead(testLead);
  assert(result.success === true, "saveCalculatorLead should succeed for new lead.");

  const savedLead = getLeadByEmail('test@example.com');
  assert(savedLead !== null, "New lead should be found in sheet.");
  assert(savedLead.email === 'test@example.com', "Saved lead email should match.");
  assert(savedLead.id.startsWith('BDL-DEN-'), "Lead ID should be generated and start correctly.");

  // Manual verification: Check your inbox for the initial payment request email.
  Logger.log("MANUAL CHECK: Verify an email was sent to test@example.com with payment link and ID: " + savedLead.id);

  // Clean up
  clearSheet(SHEETS.CALC_LEADS);
  Logger.log("--- Finished testSaveCalculatorLead_NewLead ---");
}

/**
 * Tests updating an existing calculator lead.
 */
function testSaveCalculatorLead_UpdateLead() {
  Logger.log("--- Running testSaveCalculatorLead_UpdateLead ---");
  const sheet = createTestSheet(SHEETS.CALC_LEADS, ['id', 'date', 'name', 'email', 'business', 'niche', 'paidReport', 'totalLeakage']);

  const initialLead = {
    id: 'BDL-DEN-123',
    date: '01/01/2023',
    name: 'Initial User',
    email: 'update@example.com',
    business: 'Old Business',
    niche: 'dental',
    paidReport: 'Requested',
    totalLeakage: 1000
  };
  saveCalculatorLead(initialLead); // Save initial lead

  const updatedLeadData = {
    email: 'update@example.com', // Use email to identify
    business: 'New Business Name',
    totalLeakage: 2500,
    paidReport: 'Paid'
  };

  const result = saveCalculatorLead(updatedLeadData); // This should update, not add
  assert(result.success === true, "saveCalculatorLead should succeed for updating lead.");

  const leadsInSheet = sheet.getDataRange().getValues().slice(1);
  assert(leadsInSheet.length === 1, "There should still be only one lead in the sheet after update.");

  const updatedLead = getLeadByEmail('update@example.com');
  assert(updatedLead.business === 'New Business Name', "Lead business name should be updated.");
  assert(updatedLead.paidReport === 'Paid', "Lead paidReport status should be updated.");

  // Clean up
  clearSheet(SHEETS.CALC_LEADS);
  Logger.log("--- Finished testSaveCalculatorLead_UpdateLead ---");
}

/**
 * Tests marking a payment as paid and automatic report generation.
 */
function testMarkPaymentPaid() {
  Logger.log("--- Running testMarkPaymentPaid ---");
  const calcLeadsSheet = createTestSheet(SHEETS.CALC_LEADS, ['id', 'date', 'name', 'email', 'business', 'niche', 'paidReport', 'totalLeakage']);
  createTestSheet(SHEETS.VERIFIED, ['orderId', 'email', 'business', 'niche', 'leakage', 'amount', 'date', 'status']);

  const testLead = {
    id: 'BDL-TEST-001',
    date: new Date().toLocaleDateString(),
    name: 'Paid Tester',
    email: 'paid_test@example.com',
    business: 'Paid Test Co.',
    niche: 'saas',
    paidReport: 'Requested',
    totalLeakage: 5000
  };
  saveCalculatorLead(testLead);

  const paymentChanges = {
    paidReport: 'Paid',
    paymentReference: 'WISE-REF-12345'
  };

  const result = markPaymentPaid(testLead.id, paymentChanges);
  assert(result.success === true, "markPaymentPaid should succeed.");

  const updatedLead = getLeadById(testLead.id);
  assert(updatedLead.paidReport === 'Paid', "Lead status should be 'Paid'.");
  assert(updatedLead.paymentReference === 'WISE-REF-12345', "Payment reference should be updated.");

  const verifiedPaymentsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.VERIFIED);
  const verifiedData = verifiedPaymentsSheet.getDataRange().getValues();
  assert(verifiedData.length === 2, "One payment record should be added to Verified Payments sheet.");
  assert(verifiedData[1][0] === 'WISE-REF-12345', "Verified payment reference should match.");

  // Manual verification: Check your inbox for the full PDF report.
  Logger.log("MANUAL CHECK: Verify a full PDF report was sent to paid_test@example.com.");

  // Clean up
  clearSheet(SHEETS.CALC_LEADS);
  clearSheet(SHEETS.VERIFIED);
  Logger.log("--- Finished testMarkPaymentPaid ---");
}

/**
 * Tests the daily backup function.
 */
function testDailyBackupToDrive() {
  Logger.log("--- Running testDailyBackupToDrive ---");
  const calcLeadsSheet = createTestSheet(SHEETS.CALC_LEADS, ['id', 'email', 'business']);
  calcLeadsSheet.appendRow(['ID1', 'a@b.com', 'Biz A']);
  const verifiedSheet = createTestSheet(SHEETS.VERIFIED, ['orderId', 'email', 'status']);
  verifiedSheet.appendRow(['ORD1', 'c@d.com', 'Paid']);

  dailyBackupToDrive();

  // Manual verification: Check your Google Drive for a folder named 'BDL_Backups'
  // containing two CSV files with today's date.
  Logger.log("MANUAL CHECK: Verify 'BDL_Backups' folder in Drive contains two CSV files.");

  // Clean up
  clearSheet(SHEETS.CALC_LEADS);
  clearSheet(SHEETS.VERIFIED);
  // Note: Deleting Drive files programmatically is more complex and often not needed for tests.
  // You'll need to manually delete the 'BDL_Backups' folder from your Drive.
  Logger.log("--- Finished testDailyBackupToDrive ---");
}

/**
 * Tests updating a lead in a generic sheet.
 */
function testUpdateLead() {
  Logger.log("--- Running testUpdateLead ---");
  const leadsSheet = createTestSheet(SHEETS.LEADS, ['id', 'name', 'status']);
  leadsSheet.appendRow(['L1', 'Lead One', 'New']);

  const result = updateLead('L1', { name: 'Lead Updated', status: 'Contacted' }, SHEETS.LEADS);
  assert(result.success === true, "updateLead should succeed.");

  const updatedRow = leadsSheet.getDataRange().getValues()[1];
  assert(updatedRow[1] === 'Lead Updated', "Lead name should be updated.");
  assert(updatedRow[2] === 'Contacted', "Lead status should be updated.");

  // Clean up
  clearSheet(SHEETS.LEADS);
  Logger.log("--- Finished testUpdateLead ---");
}

/**
 * Tests deleting a calculator lead.
 */
function testDeleteCalculatorLead() {
  Logger.log("--- Running testDeleteCalculatorLead ---");
  const calcLeadsSheet = createTestSheet(SHEETS.CALC_LEADS, ['id', 'email', 'business']);
  calcLeadsSheet.appendRow(['DEL1', 'del@test.com', 'Delete Me']);
  calcLeadsSheet.appendRow(['KEEP1', 'keep@test.com', 'Keep Me']);

  const result = deleteCalculatorLead('DEL1');
  assert(result.success === true, "deleteCalculatorLead should succeed.");

  const remainingLeads = calcLeadsSheet.getDataRange().getValues().slice(1);
  assert(remainingLeads.length === 1, "One lead should be deleted.");
  assert(remainingLeads[0][0] === 'KEEP1', "Correct lead should remain.");

  // Clean up
  clearSheet(SHEETS.CALC_LEADS);
  Logger.log("--- Finished testDeleteCalculatorLead ---");
}

/**
 * Tests moving a lead between sheets.
 */
function testMoveLead() {
  Logger.log("--- Running testMoveLead ---");
  const leadsSheet = createTestSheet(SHEETS.LEADS, ['id', 'name', 'status']);
  leadsSheet.appendRow(['M1', 'Move Me', 'New']);
  const archivedSheet = createTestSheet(SHEETS.ARCHIVED, ['id', 'name', 'status']); // Ensure target sheet exists

  const result = moveLead('M1', SHEETS.LEADS, SHEETS.ARCHIVED, { status: 'Archived' });
  assert(result.success === true, "moveLead should succeed.");

  const originalLeads = leadsSheet.getDataRange().getValues().slice(1);
  assert(originalLeads.length === 0, "Lead should be removed from source sheet.");

  const archivedLeads = archivedSheet.getDataRange().getValues().slice(1);
  assert(archivedLeads.length === 1, "Lead should be added to destination sheet.");
  assert(archivedLeads[0][0] === 'M1', "Moved lead ID should match.");
  assert(archivedLeads[0][2] === 'Archived', "Moved lead status should be updated.");

  // Clean up
  clearSheet(SHEETS.LEADS);
  clearSheet(SHEETS.ARCHIVED);
  Logger.log("--- Finished testMoveLead ---");
}

/**
 * Tests handleRequest with an unauthorized action.
 */
function testHandleRequest_AuthFailure() {
  Logger.log("--- Running testHandleRequest_AuthFailure ---");
  const configSheet = createTestSheet(SHEETS.CONFIG, []);
  configSheet.getRange('A1').setValue('correct_password');

  const mockEvent = {
    postData: {
      contents: JSON.stringify({ action: 'getAll', key: 'wrong_password' }),
      type: 'application/json'
    }
  };

  const response = handleRequest(mockEvent);
  const result = JSON.parse(response.getContentText());
  assert(result.success === false, "Unauthorized request should fail.");
  assert(result.error === 'Unauthorized: Access Denied', "Error message should indicate unauthorized access.");

  // Clean up
  clearSheet(SHEETS.CONFIG);
  Logger.log("--- Finished testHandleRequest_AuthFailure ---");
}

/**
 * Tests handleRequest with a successful saveCalculatorLead action.
 */
function testHandleRequest_SaveLead() {
  Logger.log("--- Running testHandleRequest_SaveLead ---");
  createTestSheet(SHEETS.CALC_LEADS, ['id', 'email', 'business', 'paidReport']);

  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        action: 'saveCalculatorLead',
        lead: { email: 'hr_test@example.com', business: 'HR Test Co.', paidReport: 'Requested' }
      }),
      type: 'application/json'
    }
  };

  const response = handleRequest(mockEvent);
  const result = JSON.parse(response.getContentText());
  assert(result.success === true, "handleRequest for saveCalculatorLead should succeed.");

  const savedLead = getLeadByEmail('hr_test@example.com');
  assert(savedLead !== null, "Lead should be saved via handleRequest.");

  // Clean up
  clearSheet(SHEETS.CALC_LEADS);
  Logger.log("--- Finished testHandleRequest_SaveLead ---");
}

/**
 * Tests handleRequest with a successful markPaymentPaid action.
 */
function testHandleRequest_MarkPaid() {
  Logger.log("--- Running testHandleRequest_MarkPaid ---");
  const configSheet = createTestSheet(SHEETS.CONFIG, []);
  configSheet.getRange('A1').setValue('test_password');
  const calcLeadsSheet = createTestSheet(SHEETS.CALC_LEADS, ['id', 'email', 'business', 'paidReport']);
  calcLeadsSheet.appendRow(['PAYID1', 'paid_hr@example.com', 'Paid HR Co.', 'Requested']);
  createTestSheet(SHEETS.VERIFIED, ['orderId', 'email', 'status']);

  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        action: 'markPaymentPaid',
        key: 'test_password',
        id: 'PAYID1',
        changes: { paidReport: 'Paid', paymentReference: 'HR-REF-001' }
      }),
      type: 'application/json'
    }
  };

  const response = handleRequest(mockEvent);
  const result = JSON.parse(response.getContentText());
  assert(result.success === true, "handleRequest for markPaymentPaid should succeed.");

  const updatedLead = getLeadById('PAYID1');
  assert(updatedLead.paidReport === 'Paid', "Lead status should be 'Paid' after handleRequest.");

  // Clean up
  clearSheet(SHEETS.CONFIG);
  clearSheet(SHEETS.CALC_LEADS);
  clearSheet(SHEETS.VERIFIED);
  Logger.log("--- Finished testHandleRequest_MarkPaid ---");
}

/**
 * Runs all defined tests.
 */
function runAllTests() {
  Logger.log("=== Starting All Tests ===");
  try {
    testAuthFunctions();
    testSaveCalculatorLead_NewLead();
    testSaveCalculatorLead_UpdateLead();
    testMarkPaymentPaid();
    testDailyBackupToDrive();
    testUpdateLead();
    testDeleteCalculatorLead();
    testMoveLead();
    testHandleRequest_AuthFailure();
    testHandleRequest_SaveLead();
    testHandleRequest_MarkPaid();
    Logger.log("=== All Tests Passed! ===");
  } catch (e) {
    Logger.log("!!! One or more tests FAILED: " + e.message);
  }
}