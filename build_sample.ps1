$core = Get-Content -Path "Core_Logic.gs" -Raw
$templates = Get-Content -Path "Email_PDF_Templates.gs" -Raw

$htmlTop = @"
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Sample Report</title>
</head>
<body>
<script>
"@

$htmlBottom = @"

const mockLead = {
  name: "John Doe", 
  business: "Apex Real Estate", 
  email: "john@apex.com", 
  phone: "555-0123", 
  website: "apex.com", 
  niche: "realestate", 
  monthlyRevenue: 50000, 
  margin: 20, 
  volume: 100, 
  price: 500, 
  conversion: 25, 
  lifetime: 2, 
  totalLeakage: 12500, 
  leakageBreakdown: "Missed lead follow-up | Low portal ROI | Inefficient offer conversion"
}; 

// Mock Utilities and MailApp to prevent errors when evaluating the .gs files
const Utilities = { formatDate: () => "0000" };
const MailApp = { sendEmail: () => {} };
const Session = { getScriptTimeZone: () => "GMT" };
const SETTINGS = { REPORT_PRICE: 47 };
function esc(str) { return String(str).replace(/[&<>'"]/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[match])); }

document.write(buildFullPdfReportHtml(mockLead, "This is a custom note added by the analyst."));
</script>
</body>
</html>
"@

$result = $htmlTop + "`n" + $core + "`n" + $templates + "`n" + $htmlBottom
Set-Content -Path "sample_report.html" -Value $result
