/**
 * BDL REVENUE AUDIT - BACKEND TEST SUITE
 * Run 'runAllBackendTests' from the Apps Script editor to verify logic.
 */

function runAllBackendTests() {
  const DEFAULT_TEST_RESULTS_HEADERS = ['Timestamp', 'Test Name', 'Status', 'Details'];
  const resultSheet = getOrCreateSheet('Test Results', DEFAULT_TEST_RESULTS_HEADERS);
  resultSheet.setFrozenRows(1);

  const testCases = [
    testEscaping,
    testNicheRuleRetrieval,
    testLeakageCalculationLogic,
    testGenerateAndSendReportEmptyLead,
    testLeakageBenchmarkDefaulting,
    testPdfGenerationForAllNiches,
    testGetOrCreateSheetAppendsHeaders
  ];

  const timestamp = new Date();
  const results = [];

  testCases.forEach(test => {
    try {
      test();
      results.push([timestamp, test.name, '✅ PASSED', 'Logic verified successfully.']);
    } catch (e) {
      results.push([timestamp, test.name, '❌ FAILED', e.message]);
    }
  });

  if (results.length > 0) {
    resultSheet.getRange(resultSheet.getLastRow() + 1, 1, results.length, results[0].length).setValues(results);
  }

  const passed = results.filter(r => r[2].includes('PASSED')).length;
  console.log(`--- TEST COMPLETE: ${passed}/${testCases.length} PASSED. Results recorded in 'Test Results' sheet. ---`);
}

function testEscaping() {
  const input = '& < > "';
  const expected = '&amp; &lt; &gt; &quot;';
  if (esc(input) !== expected) throw new Error(`Escaping failed. Expected ${expected}, got ${esc(input)}`);
}

function testNicheRuleRetrieval() {
  const niches = ['dental', 'realestate', 'healthcare', 'legal', 'saas', 'restaurant', 'general'];
  niches.forEach(n => {
    const rules = getNicheCalculationRules(n);
    if (!rules || !rules.plan90 || rules.plan90.length !== 3) {
      throw new Error(`Rules for niche ${n} are incorrect or missing 3-step plan.`);
    }
  });
}

function testLeakageCalculationLogic() {
  const lead = {
    monthlyRevenue: 10000,
    niche: 'dental',
    totalLeakage: 0 // Force calculation from revenue
  };
  
  const result = calculateLeadLeakage(lead);
  
  // Expected: 10000 * 0.11 = 1100
  if (result.monthlyLeak !== 1100) throw new Error(`Leak calculation failed. Expected 1100, got ${result.monthlyLeak}`);
  if (result.annualLeak !== 13200) throw new Error(`Annual projection failed. Expected 13200, got ${result.annualLeak}`);
  if (result.score === undefined) throw new Error("Health score generation missing.");
}

function testGenerateAndSendReportEmptyLead() {
  const lead = {};
  const toEmail = "test@example.com";
  // The function should catch errors internally and return a structured response rather than crashing.
  const result = generateAndSendReport(lead, toEmail, "Test Note", null, null);
  
  if (!result || (result.success === undefined && result.error === undefined)) {
    throw new Error("generateAndSendReport did not return a standard result object for an empty lead.");
  }
}

/**
 * Verifies that the engine correctly falls back to benchmarks when data is missing or formatted.
 */
function testLeakageBenchmarkDefaulting() {
  const lead = {
    monthlyRevenue: "$20,000", // Formatted string
    niche: 'dental',
    totalLeakage: "" // Missing
  };
  
  const result = calculateLeadLeakage(lead);
  
  // Expected: 20000 * 0.11 = 2200
  if (result.revenue !== 20000) throw new Error("Currency parsing failed in leakage calculation.");
  if (result.monthlyLeak !== 2200) throw new Error("Industry benchmark fallback failed.");
  if (result.annualLeak !== 26400) throw new Error("Annual benchmark calculation failed.");
}

/**
 * Verifies that PDF generation works for all defined niches without errors.
 */
function testPdfGenerationForAllNiches() {
  const niches = ['dental', 'realestate', 'healthcare', 'legal', 'saas', 'restaurant', 'general'];
  const mockLead = {
    id: 'TEST-PDF-123',
    business: 'Test Business Inc.',
    name: 'John Doe',
    monthlyRevenue: 50000,
    totalLeakage: 5000,
    googleRating: 4.5,
    googleReviews: 100
  };
  niches.forEach(n => {
    mockLead.niche = n;
    const html = buildFullPdfReportHtml(mockLead, `Test note for ${n} niche.`);
    const pdfBlob = createPdfAttachment(html, `Test_${n}_Report.pdf`);
    if (!pdfBlob || pdfBlob.getName() !== `Test_${n}_Report.pdf`) {
      throw new Error(`PDF generation failed for niche: ${n}`);
    }
  });
}

/**
 * Verifies that getOrCreateSheet correctly identifies missing headers 
 * and appends them to the end of the header row without affecting existing data.
 */
function testGetOrCreateSheetAppendsHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tempSheetName = 'TMP_TEST_HEADERS_' + Math.random().toString(36).substr(2, 5);
  const initialHeaders = ['id', 'name'];
  const initialData = ['123', 'Test User'];
  
  try {
    // Create sheet manually with partial headers and data
    const sheet = ss.insertSheet(tempSheetName);
    sheet.appendRow(initialHeaders);
    sheet.appendRow(initialData);
    
    // Call getOrCreateSheet with extended headers
    const extendedHeaders = ['id', 'name', 'email', 'phone'];
    getOrCreateSheet(tempSheetName, extendedHeaders);
    
    // Verify results
    const updatedHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const updatedRow = sheet.getRange(2, 1, 1, 2).getValues()[0];
    
    if (updatedHeaders.length !== 4) throw new Error("Header length mismatch. Expected 4, got " + updatedHeaders.length);
    if (updatedHeaders[2] !== 'email' || updatedHeaders[3] !== 'phone') throw new Error("Missing headers not appended correctly.");
    if (String(updatedRow[0]) !== '123' || updatedRow[1] !== 'Test User') throw new Error("Existing data was overwritten.");
    
  } finally {
    const sheetToDelete = ss.getSheetByName(tempSheetName);
    if (sheetToDelete) ss.deleteSheet(sheetToDelete);
  }
}