import re

with open('Email_PDF_Templates.gs', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace "20+ page" in the first template
text = text.replace('Your full, unredacted 20+ page report', 'Your full, unredacted executive report')

# Replace "20+ page" in the second template (if any)
text = text.replace('Your 20+ page diagnostic PDF', 'Your executive diagnostic PDF')

# Add the receipt block to sendPaymentReceiptEmail
old_receipt_paragraph = '<p>This email confirms that we have successfully received your payment of <strong>$${amount}</strong> for the Executive Revenue Diagnostic.</p>'

new_receipt_block = """<p>This email confirms that we have successfully received your payment for the Executive Revenue Diagnostic.</p>
      <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1E293B; font-size: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Transaction Receipt</h3>
        <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 14px; color: #475569;">
          <tr>
            <td><strong>Item:</strong></td>
            <td align="right">Executive Revenue Diagnostic</td>
          </tr>
          <tr>
            <td><strong>Date:</strong></td>
            <td align="right">${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM dd, yyyy')}</td>
          </tr>
          <tr>
            <td><strong>Amount Paid:</strong></td>
            <td align="right"><strong>$${amount}</strong></td>
          </tr>
          <tr>
            <td><strong>Status:</strong></td>
            <td align="right"><span style="color: #10B981; font-weight: bold;">PAID</span></td>
          </tr>
        </table>
      </div>"""

text = text.replace(old_receipt_paragraph, new_receipt_block)

with open('Email_PDF_Templates.gs', 'w', encoding='utf-8') as f:
    f.write(text)
