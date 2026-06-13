with open('admin.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Remove the localStorage check in admin.html
old_js = """  var wiseLink = localStorage.getItem('bdl_wise_link')||'';
  if(!wiseLink){showToast('Please save your payment link in Delivery Workflow tab first',true);return;}"""

new_js = """  var wiseLink = ''; // Will fall back to Config sheet on backend"""

html = html.replace(old_js, new_js)

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(html)


with open('Code.gs', 'r', encoding='utf-8') as f:
    code = f.read()

old_code = """function sendPaymentRequestEmail(lead, toEmail, wiseLink) {
  try {
    const bizName = lead.business || 'Your Business';"""

new_code = """function sendPaymentRequestEmail(lead, toEmail, wiseLink) {
  try {
    wiseLink = wiseLink || getGlobalPaymentLink();
    const bizName = lead.business || 'Your Business';"""

code = code.replace(old_code, new_code)

with open('Code.gs', 'w', encoding='utf-8') as f:
    f.write(code)
