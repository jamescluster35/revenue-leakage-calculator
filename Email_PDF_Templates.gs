/**
 * BDL REVENUE AUDIT BACKEND
 * HTML Templates & Report Generation
 */

function getRecommendedFix(niche, toolTag) {
  const k = String(niche || '').trim().toLowerCase();
  const hasTool = toolTag === 'existing_tool_underused';
  
  const recommendations = {
    restaurant: {
      has: {
        title: "🛠️ Recommended Fix: System Optimization",
        desc: "Your restaurant already utilizes reservation, POS, or management software but suffers from an <strong>Optimization Gap</strong>. We recommend auditing and enabling underused features in your existing tools.",
        action: "Activate credit card holds and automated SMS confirmations in OpenTable/Resy to eliminate no-show losses, and enable prep waste logs in your POS system."
      },
      no: {
        title: "🚀 Recommended Fix: Starter Platform Setup",
        desc: "Your restaurant has a <strong>Technology Gap</strong>. To stop leakage, we recommend adopting industry-standard systems.",
        action: "Deploy a reservation tool like Tock/Resy (which supports card holds to eliminate no-shows) and set up Toast POS with integrated waste tracking."
      }
    },
    dental: {
      has: {
        title: "🛠️ Recommended Fix: System Optimization",
        desc: "Your practice has scheduling software but is suffering from an <strong>Optimization Gap</strong>. We recommend configuring advanced features you are already paying for.",
        action: "Set up multi-channel patient recall rules in NexHealth/Solutionreach and run a 10-patient/day reactivation coordinator routine."
      },
      no: {
        title: "🚀 Recommended Fix: Starter Platform Setup",
        desc: "Your practice has a <strong>Technology Gap</strong>. To scale bookings and reduce empty chairs, we recommend implementing dedicated scheduling software.",
        action: "Adopt patient engagement software (like NexHealth or Solutionreach) to automate 48h/2h patient text reminders and hygiene recall."
      }
    },
    realestate: {
      has: {
        title: "🛠️ Recommended Fix: System Optimization",
        desc: "Your agency has a CRM but suffers from an <strong>Optimization Gap</strong>. We recommend configuring workflows within your current stack.",
        action: "Configure automated 7-touch drip campaigns (Call/Text/Email) in kvCORE/Follow Up Boss so new portal leads don't decay."
      },
      no: {
        title: "🚀 Recommended Fix: Starter Platform Setup",
        desc: "Your agency has a <strong>Technology Gap</strong>. To prevent lost commission, we recommend setting up a CRM.",
        action: "Adopt kvCORE or Follow Up Boss to centralize portal leads and auto-assign them to agents for immediate outreach."
      }
    },
    healthcare: {
      has: {
        title: "🛠️ Recommended Fix: System Optimization",
        desc: "Your clinic has billing and scheduling software but suffers from an <strong>Optimization Gap</strong>. We recommend auditing your current workflow rules.",
        action: "Audit top 3 rejection reasons in your billing software and configure pre-submission claim checks, and set up automated patient reminders."
      },
      no: {
        title: "🚀 Recommended Fix: Starter Platform Setup",
        desc: "Your clinic has a <strong>Technology Gap</strong>. To reduce denials and no-shows, we recommend dedicated software.",
        action: "Implement a billing audit tool and automated patient reminder platform (like Solutionreach/NexHealth)."
      }
    },
    legal: {
      has: {
        title: "🛠️ Recommended Fix: System Optimization",
        desc: "Your firm has a practice management tool but suffers from an <strong>Optimization Gap</strong>. We recommend optimizing your configuration.",
        action: "Enable automatic contemporaneous time-tracking rules in Clio/Lawmatics and configure automated Day 3/Day 7 client follow-ups."
      },
      no: {
        title: "🚀 Recommended Fix: Starter Platform Setup",
        desc: "Your firm has a <strong>Technology Gap</strong>. To capture billable hours, we recommend a practice management platform.",
        action: "Deploy Clio and Clio Grow to track billable work in real-time and automate consult-to-retained agreements."
      }
    },
    saas: {
      has: {
        title: "🛠️ Recommended Fix: System Optimization",
        desc: "Your SaaS has billing software but suffers from an <strong>Optimization Gap</strong>. We recommend configuring existing billing workflows.",
        action: "Enable Stripe/Chargebee automated dunning sequences at Day 0, 3, and 7, and set up inactive user alerts."
      },
      no: {
        title: "🚀 Recommended Fix: Starter Platform Setup",
        desc: "Your SaaS has a <strong>Technology Gap</strong>. To avoid churn, we recommend integrating automated dunning and tracking.",
        action: "Integrate Stripe/Chargebee dunning modules and set up user analytics (Mixpanel/Amplitude) to identify churn risks."
      }
    },
    general: {
      has: {
        title: "🛠️ Recommended Fix: System Optimization",
        desc: "Your business has process tools but suffers from an <strong>Optimization Gap</strong>. We recommend optimizing features within your current CRM/POS.",
        action: "Configure automated multi-channel follow-ups (at least 5 touches) and clean up manual bottlenecks."
      },
      no: {
        title: "🚀 Recommended Fix: Starter Platform Setup",
        desc: "Your business has a <strong>Technology Gap</strong>. We recommend deploying a starter system to track leads.",
        action: "Deploy a modern CRM and scheduling tool to automate pipeline tracking, appointment bookings, and intake."
      }
    }
  };
  
  const nicheRec = recommendations[k] || recommendations.general;
  return hasTool ? nicheRec.has : nicheRec.no;
}

function generateAndSendReport(lead, toEmail, note, subject, htmlBodyOverride) {
  try {
    const bizName = esc(lead.business || 'Your Business');
    const firstName = esc(String(lead.name || 'there').split(' ')[0]);
    const isPaid = ['paid','delivered'].includes(String(lead.paidReport||'').trim().toLowerCase());
    const attachments = [];
    const template = getTemplateForLead(lead);
    const reportId = lead.id || 'N/A';
    const safeBizName = (bizName || 'Revenue_Audit').replace(/[^a-z0-9]/gi, '_');

    if (isPaid) {
      const pdfHtml = buildFullPdfReportHtml(lead, note);
      if (!pdfHtml || typeof pdfHtml !== 'string' || pdfHtml.length < 100) {
        throw new Error("PDF generation failed: resulting content is empty or invalid.");
      }
      attachments.push(createPdfAttachment(pdfHtml, safeBizName + '_Revenue_Leakage_Report.pdf'));
    } else {
      const teaserHtml = buildTeaserPdfReportHtml(lead, note);
      const paymentHtml = buildPaymentPdfHtml(lead);
      attachments.push(createPdfAttachment(teaserHtml, safeBizName + '_Teaser_Report.pdf'));
      attachments.push(createPdfAttachment(paymentHtml, safeBizName + '_Invoice.pdf'));
    }

    const finalHtml = htmlBodyOverride || (isPaid ? buildFullReportEmailHtml(lead, note, template) : buildSummaryReportEmailHtml(lead, note, template));
    let finalSubject = (subject || (isPaid ? template.subject : ('Your Revenue Audit — ' + bizName)))
      .replace('{bizName}', bizName).replace('{name}', firstName).replace('{id}', reportId);
    
    if (!finalSubject.includes(reportId)) finalSubject += ` (Ref: ${reportId})`;

    MailApp.sendEmail({ 
      to: toEmail, 
      subject: finalSubject, 
      htmlBody: finalHtml, 
      name: 'BDL Revenue Intelligence', 
      attachments: attachments 
    });

    // Transition status: Paid leads become Delivered, others stay as they were or become Requested
    const newStatus = isPaid ? 'Delivered' : (lead.paidReport || 'Requested');
    updateCalculatorLead(lead.id || lead.email, { 
      contacted: 'Yes', 
      paidReport: newStatus 
    });

    return { success: true, reportId: reportId };
  } catch(err) { return { error: err.message }; }
}

function buildFullPdfReportHtml(lead, note) {
  const bizName = esc(lead.business || 'Your Business');
  const calc = calculateLeadLeakage(lead);
  const firstName = String(lead.name || 'there').split(' ')[0];
  const niche = (lead.niche || 'General').toLowerCase();
  const reportId = 'BDL-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd') + '-' + (niche.toUpperCase().slice(0, 3));
  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM dd, yyyy'); 

  const detailMap = {
    // Dental
    'Appointment No-Show Loss': 'Implement automated SMS/Email reminders at 48h and 2h. Target: no-show rate < 8%.',
    'Unscheduled Recall Patients': 'Assign a dedicated coordinator to call 10 overdue patients daily. Multi-channel reactivation is key.',
    'New Patient Follow-Up Gap': 'Adopt a 2-hour callback rule for all inquiries. Top practices convert 65% of leads.',
    'Staff Idle Time': 'Audit scheduling to eliminate gaps. Cross-train admin staff for high-value outreach during slow blocks.',
    // Real Estate
    'Lead Follow-Up Gap': 'Deploy a 7-touch follow-up system (Call/Text/Email). 80% of deals close between contact 5 and 12.',
    'Portal Spend vs Returns': 'Review Portal ROI monthly. Reallocate budget from underperforming zones to high-intent keywords.',
    'Agent Admin Time': 'Offload contract coordination to VAs. Each hour recovered = direct billable selling time.',
    // Healthcare
    'Insurance Claim Rejections': 'Review top 3 rejection reasons. Most are fixable with pre-submission software or coding audits.',
    'Referral No-Conversion': 'Contact every referral within 24h. Warm scripts increase booking rates by 40%.',
    'Overtime Prevention': 'Match staffing to historical hourly demand. Adjust templates to prevent "over-lapping" shifts.',
    // Legal
    'Unbilled Attorney Hours': 'Start daily time tracking. Even a 5% improvement in time capture adds $3k-$5k/mo per attorney.',
    'Consultation No-Convert': 'Structured follow-up within 24h. Phone calls at day 3 triple your conversion from consult to client.',
    'Attorney Admin Time': 'Delegate data entry to paralegals. Your hourly billable rate is too high for manual admin work.',
    // SaaS
    'Monthly Churn Loss': 'Identify customers inactive for 14 days. Personal outreach can save up to 15% of annual revenue.',
    'Trial No-Convert Loss': 'Optimize your 48-hour activation sequence. Getting users to one "key action" predicts 80% of upgrades.',
    'Failed Payments': 'Automate dunning sequences with retry logic at day 0, 3, and 7. Recovers 50% of failed charges.',
    // Restaurant
    'Food Waste': 'Implement a daily waste log by category for 14 days. Most restaurants reduce costs by 4% immediately.',
    'No-Show & Cancellation Loss': 'Introduce SMS confirmations. Clear cancellation policies reduce empty tables on busy nights.',
    'Delivery Fees': 'Calculate net profit after platform commission. If <10%, promote direct-order discounts to shift volume.',
    // Fallback
    'General': 'This area represents a significant operational gap. Implementing the 90-day plan will stabilize this revenue.'
  };

  const leakage = calc.monthlyLeak;
  const dailyCost = Math.round(leakage / 30);
  const quarterlyCost = Math.round(leakage * 3);
  const recoverable = Math.round(leakage * 0.7); 

  const grRating = parseFloat(lead.googleRating) || 0;
  const grCount = parseInt(lead.googleReviews) || 0;
  const hasReputation = grRating > 0 || grCount > 0;

  const planHtml = (calc.rules.plan90 || []).map((step, idx) => {
    let pColor = step.priority === 'CRITICAL' ? '#F43F5E' : step.priority === 'HIGH' ? '#F59E0B' : '#3B82F6';
    
    // Dynamically calculate estimated impact per phase (50% for Phase 1, 30% for Phase 2, 20% for Phase 3)
    const stepsPcts = [50, 30, 20];
    const pctVal = stepsPcts[idx] || 0;
    const stepImpactAmt = Math.round(recoverable * pctVal / 100);
    const dynamicImpact = '+$' + stepImpactAmt.toLocaleString() + '/mo';

    // Parse out template, script, or checklist box if available in detail
    let mainDetail = step.detail;
    let resourceBox = '';
    
    const templateIdx = step.detail.indexOf('Template:');
    const scriptIdx = step.detail.indexOf('Script:');
    const checklistIdx = step.detail.indexOf('Checklist:');
    const guidelineIdx = step.detail.indexOf('Guideline:');
    
    let boxIdx = -1;
    let boxType = '';
    
    if (templateIdx !== -1) { boxIdx = templateIdx; boxType = '⚡ COPY-PASTE TEMPLATE'; }
    else if (scriptIdx !== -1) { boxIdx = scriptIdx; boxType = '🗣️ OUTREACH SCRIPT'; }
    else if (checklistIdx !== -1) { boxIdx = checklistIdx; boxType = '📝 OPERATION CHECKLIST'; }
    else if (guidelineIdx !== -1) { boxIdx = guidelineIdx; boxType = '💡 PRACTICE GUIDELINE'; }
    
    if (boxIdx !== -1) {
      mainDetail = step.detail.substring(0, boxIdx).trim();
      const colonIdx = step.detail.indexOf(':', boxIdx);
      let resourceContent = '';
      if (colonIdx !== -1) {
        resourceContent = step.detail.substring(colonIdx + 1).trim();
      } else {
        resourceContent = step.detail.substring(boxIdx + 10).trim();
      }
      
      // Strip outer quotes if they exist
      if (resourceContent.startsWith('"') && resourceContent.endsWith('"')) {
        resourceContent = resourceContent.substring(1, resourceContent.length - 1);
      }
      
      resourceBox = `
      <div style="margin-top: 12px; padding: 12px 14px; border: 1px dashed #10B981; background-color: #F0FDF4; border-radius: 8px; font-family: monospace; font-size: 11px; color: #166534; line-height: 1.5;">
        <span style="font-weight: 800; font-size: 10px; color: #10B981; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">${boxType}</span>
        ${esc(resourceContent)}
      </div>`;
    }

    return `
    <div style="margin-bottom: 20px; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; background: #FAFAFA;">
      <table width="100%" cellpadding="12" cellspacing="0" border="0" style="background: #0F172A; color: #FFFFFF;">
        <tr>
          <td width="50" align="center" style="border-right: 1px solid rgba(255,255,255,0.1);">
            <div style="font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px;">Week</div>
            <div style="font-size: 18px; font-weight: 800; color: #F59E0B;">${step.week}</div>
          </td>
          <td>
            <div style="font-size: 14px; font-weight: bold; letter-spacing: 0.5px;">${esc(step.action)}</div>
          </td>
          <td align="right">
             <span style="background: ${pColor}; color: #FFFFFF; font-size: 9px; font-weight: bold; padding: 4px 8px; border-radius: 20px; text-transform: uppercase;">${step.priority}</span>
          </td>
        </tr>
      </table>
      <div style="padding: 16px; font-size: 13px; color: #475569; line-height: 1.6;">
        ${esc(mainDetail)}
        ${resourceBox}
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #E2E8F0; font-size: 11px; font-weight: 700; color: #10B981; text-transform: uppercase; letter-spacing: 1px;">
          Estimated Financial Impact: ${esc(dynamicImpact)}
        </div>
      </div>
    </div>`;
  }).join('');

  const leakHtml = calc.breakdown.map((item, i) => {
    const pcts = calc.breakdown.length === 3 ? [50, 30, 20] : calc.breakdown.length === 2 ? [60, 40] : [100];
    const pctVal = pcts[i] || 0;
    let color = i === 0 ? '#F43F5E' : i === 1 ? '#F59E0B' : '#3B82F6';
    return `
    <div style="background: #FFFFFF; border: 1px solid #E2E8F0; padding: 16px; margin-bottom: 12px; border-radius: 8px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <div style="font-size: 14px; font-weight: 700; color: #1E293B; margin-bottom: 6px;">${esc(item)}</div>
            <div style="font-size: 11px; color: #64748B; margin-bottom: 12px;">${esc(detailMap[item] || detailMap.General)}</div>
            <div style="background: #F1F5F9; height: 6px; width: 100%; border-radius: 4px; overflow: hidden;">
              <div style="background: ${color}; height: 6px; width: ${pctVal}%; border-radius: 4px;"></div>
            </div>
          </td>
        </tr>
      </table>
    </div>`;
  }).join('');

  let reputationHtml = '';
  if (hasReputation) {
    const isGood = grRating >= 4.5 && grCount > 20;
    const repColor = isGood ? '#10B981' : '#F43F5E';
    const repIcon = isGood ? '✓' : '⚠️';
    const repMsg = isGood 
      ? `Your Google Rating of ${grRating.toFixed(1)} with ${grCount} reviews is an asset. Maintain this to maximize conversion.`
      : `Your Google Rating of ${grRating.toFixed(1)} with ${grCount} reviews is actively causing top-of-funnel leak. Prospects are checking reviews and choosing competitors.`;
    
    reputationHtml = `
      <h2 style="color:#0F172A; text-transform:uppercase; font-size:13px; border-bottom:2px solid #E2E8F0; margin-top:30px; padding-bottom:8px; letter-spacing: 1px;">Reputation Diagnostic</h2>
      <table width="100%" cellpadding="16" cellspacing="0" border="0" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-left: 4px solid ${repColor}; border-radius: 8px;">
        <tr>
          <td width="60" align="center">
            <div style="font-size: 24px; color: ${repColor};">${repIcon}</div>
            <div style="font-size: 18px; font-weight: 800; color: #1E293B; margin-top: 4px;">${grRating.toFixed(1)}</div>
          </td>
          <td>
            <div style="font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase; margin-bottom: 4px;">Google Review Sentiment</div>
            <div style="font-size: 13px; color: #64748B; line-height: 1.5;">${esc(repMsg)}</div>
          </td>
        </tr>
      </table>`;
  }

  const allBenchmarks = {
    dental: [
      { name: 'Case Presentation Conversion', avg: '40 - 50%', top: '75% +' },
      { name: 'Patient No-Show Rate', avg: '15%', top: '< 3%' },
      { name: 'Speed to Lead (Response)', avg: '24 Hours', top: 'Under 10 Mins' },
      { name: 'Google Rating', avg: '4.5 ★', top: '4.9 ★ +' },
      { name: 'Hygiene Recare / Reactivation', avg: 'Inconsistent', top: 'Monthly Automated' }
    ],
    realestate: [
      { name: 'Lead to Appointment Conversion', avg: '3%', top: '12% +' },
      { name: 'Database Reactivation Rate', avg: '< 1%', top: '8% / Year' },
      { name: 'Speed to Lead (Response)', avg: '48 Hours', top: 'Under 5 Mins' },
      { name: 'Portal Spend ROI', avg: '1.5x', top: '4x +' },
      { name: 'Follow-Up Attempts per Lead', avg: '1 - 2', top: '8 - 12' }
    ],
    healthcare: [
      { name: 'Insurance Claim Denial Rate', avg: '10 - 15%', top: '< 4%' },
      { name: 'Referral Booking Conversion', avg: '40%', top: '85% +' },
      { name: 'Speed to Lead (Response)', avg: '24 - 48 Hours', top: 'Under 30 Mins' },
      { name: 'Google Rating', avg: '3.8 ★', top: '4.7 ★ +' },
      { name: 'Patient No-Show Rate', avg: '18%', top: '< 5%' }
    ],
    legal: [
      { name: 'Consultation to Retained', avg: '25%', top: '65% +' },
      { name: 'Billable Time Capture', avg: '60%', top: '85% +' },
      { name: 'Speed to Lead (Response)', avg: '24 Hours', top: 'Under 5 Mins' },
      { name: 'Google Rating', avg: '4.2 ★', top: '4.9 ★ +' },
      { name: 'Collection Realization Rate', avg: '80%', top: '96% +' }
    ],
    saas: [
      { name: 'Trial to Paid Conversion', avg: '15%', top: '40% +' },
      { name: 'Monthly Logo Churn', avg: '5 - 7%', top: '< 2%' },
      { name: 'Failed Payment Recovery', avg: '10%', top: '45% +' },
      { name: 'Onboarding Completion', avg: '40%', top: '80% +' },
      { name: 'Net Revenue Retention (NRR)', avg: '90%', top: '120% +' }
    ],
    restaurant: [
      { name: 'Table Turn Time', avg: '60 - 90 Mins', top: '< 45 Mins' },
      { name: 'Food/Inventory Waste', avg: '10%', top: '< 4%' },
      { name: 'Third-Party Delivery %', avg: '40% of Volume', top: '< 15% (Direct)' },
      { name: 'Google Rating', avg: '4.3 ★', top: '4.8 ★ +' },
      { name: 'Reservation No-Show Rate', avg: '15%', top: '< 2%' }
    ],
    general: [
      { name: 'Lead to Appointment Conversion', avg: '35%', top: '68% +' },
      { name: 'No-Show / Cancellation Rate', avg: '15 - 20%', top: '< 5%' },
      { name: 'Speed to Lead (Response)', avg: '24 - 48 Hours', top: 'Under 5 Mins' },
      { name: 'Google Rating', avg: '4.1 ★', top: '4.8 ★ +' },
      { name: 'Reactivation of Old Customers', avg: 'None', top: 'Quarterly Campaigns' }
    ]
  };

  const nicheBenchmarks = allBenchmarks[niche] || allBenchmarks.general;

  const benchmarkHtml = `
    <table width="100%" cellpadding="16" style="font-size: 12px; border-collapse: collapse; margin-bottom: 30px; border-radius: 8px; overflow: hidden;">
      <tr style="background: #0F172A; color: #FFFFFF;">
        <th align="left" style="border: 1px solid #1E293B;">Metric</th>
        <th align="center" style="border: 1px solid #1E293B;">Average Business</th>
        <th align="center" style="border: 1px solid #1E293B; color: #F59E0B;">Top 10% Performer</th>
      </tr>
      ${nicheBenchmarks.map((b, idx) => `
        <tr style="background: ${idx % 2 === 1 ? '#F8FAFC' : 'transparent'};">
          <td style="border: 1px solid #E2E8F0; color: #1E293B; font-weight: bold;">${esc(b.name)}</td>
          <td align="center" style="border: 1px solid #E2E8F0; color: #475569;">${esc(b.avg)}</td>
          <td align="center" style="border: 1px solid #E2E8F0; font-weight: bold; color: #10B981; font-size: 14px;">${esc(b.top)}</td>
        </tr>
      `).join('')}
    </table>`;

  const currentRevenue = calc.revenue - calc.monthlyLeak;
  const currentPct = calc.revenue > 0 ? Math.round(currentRevenue / calc.revenue * 100) : 84;
  const leakagePct = 100 - currentPct;

  const categoryTableHtml = `
    <h2 style="color:#0F172A; text-transform:uppercase; font-size:13px; border-bottom:2px solid #E2E8F0; margin-top:30px; padding-bottom:8px; margin-bottom: 12px; letter-spacing: 1px;">Leakage Category Allocation</h2>
    <table width="100%" cellpadding="8" style="font-size: 12px; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #E2E8F0;">
      <thead>
        <tr style="background: #0F172A; color: #FFFFFF;">
          <th align="left" style="padding: 8px; border: 1px solid #E2E8F0;">Leakage Vector</th>
          <th align="center" style="padding: 8px; border: 1px solid #E2E8F0; width: 25%;">Allocation %</th>
          <th align="right" style="padding: 8px; border: 1px solid #E2E8F0; width: 30%;">Est. Monthly Loss</th>
        </tr>
      </thead>
      <tbody>
        ${calc.breakdown.map((item, idx) => {
          const pcts = calc.breakdown.length === 3 ? [50, 30, 20] : calc.breakdown.length === 2 ? [60, 40] : [100];
          const pctVal = pcts[idx] || 0;
          const amtVal = Math.round(calc.monthlyLeak * pctVal / 100);
          return `
            <tr>
              <td style="border: 1px solid #E2E8F0; color: #1E293B; font-weight: bold; padding: 8px;">${esc(item)}</td>
              <td align="center" style="border: 1px solid #E2E8F0; color: #475569; padding: 8px;">${pctVal}%</td>
              <td align="right" style="border: 1px solid #E2E8F0; color: #F43F5E; font-weight: bold; padding: 8px;">$${amtVal.toLocaleString()}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  const visualChartHtml = calc.revenue > 0 ? `
    <h2 style="color:#0F172A; text-transform:uppercase; font-size:13px; border-bottom:2px solid #E2E8F0; margin-top:30px; padding-bottom:8px; margin-bottom: 12px; letter-spacing: 1px;">Current vs. Capture Potential Revenue</h2>
    <div style="background: #FAFAFA; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 15px;">
        <tr>
          <td width="130" style="font-size: 11px; font-weight: bold; color: #475569;">Current Revenue:</td>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="${currentPct}%" style="background: #64748B; height: 18px; border-radius: 4px; color: #FFFFFF; font-size: 10px; font-weight: bold; padding-left: 8px; line-height: 18px;">
                  $${Math.round(currentRevenue).toLocaleString()}/mo (${currentPct}%)
                </td>
                <td width="${leakagePct}%"></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="130" style="font-size: 11px; font-weight: bold; color: #0F172A;">Capture Potential:</td>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="${currentPct}%" style="background: #10B981; height: 18px; border-radius: 4px 0 0 4px; color: #FFFFFF; font-size: 10px; font-weight: bold; padding-left: 8px; line-height: 18px;">
                  $${Math.round(currentRevenue).toLocaleString()}/mo
                </td>
                <td width="${leakagePct}%" style="background: #F59E0B; height: 18px; border-radius: 0 4px 4px 0; color: #FFFFFF; font-size: 10px; font-weight: bold; text-align: center; line-height: 18px;">
                  +$${calc.monthlyLeak.toLocaleString()} (Leakage)
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <div style="font-size: 11px; color: #64748B; margin-top: 10px; text-align: right; font-style: italic;">
        Targeting recovery of <strong>$${recoverable.toLocaleString()}/mo</strong> (70%) within 90 days.
      </div>
    </div>
  ` : '';

  const rec = getRecommendedFix(niche, calc.toolTag);
  const recommendedFixHtml = `
        <!-- RECOMMENDED OPERATIONAL FIX -->
        <h2 style="color:#0F172A; text-transform:uppercase; font-size:13px; border-bottom:2px solid #E2E8F0; margin-top:30px; padding-bottom:8px; margin-bottom: 12px; letter-spacing: 1px;">Recommended Operational Fix</h2>
        <table width="100%" cellpadding="16" cellspacing="0" border="0" style="background: #FAFAFA; border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 24px;">
          <tr>
            <td>
              <div style="font-size: 14px; font-weight: 800; color: #1E293B; margin-bottom: 6px;">${esc(rec.title)}</div>
              <div style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 12px;">${rec.desc}</div>
              <div style="background: #FFFFFF; border: 1px solid #CBD5E1; border-left: 4px solid #F59E0B; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #1E293B; line-height: 1.6;">
                <strong>Immediate Action:</strong> ${esc(rec.action)}
              </div>
            </td>
          </tr>
        </table>`;

  return `<!DOCTYPE html><html>
    <head><meta charset="UTF-8"><style>body{font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;color:#1E293B;line-height:1.6;background:#FFFFFF;} .page-break{page-break-before:always;}</style></head>
    <body>
      
      <!-- TOP BANNER -->
      <table width="100%" cellpadding="20" cellspacing="0" style="background:#0F172A; color:#FFFFFF; border-bottom: 4px solid #F59E0B;">
        <tr>
          <td>
            <div style="font-size: 12px; color: #94A3B8; text-transform: uppercase; letter-spacing: 2px;">BDL Revenue Intelligence</div>
            <div style="font-size: 24px; font-weight: 800; margin-top: 4px; color: #FFFFFF;">${esc(bizName)}</div>
            <div style="font-size: 12px; color: #F59E0B; margin-top: 4px; font-weight: bold;">Executive Revenue Diagnostic — ${dateStr}</div>
            <div style="font-size: 11px; color: #94A3B8; margin-top: 8px; font-style: italic;">Confidential — Prepared exclusively for ${esc(bizName)}</div>
          </td>
          <td align="right">
            <div style="border: 2px solid rgba(245,158,11,0.3); background: rgba(245,158,11,0.1); border-radius: 12px; padding: 12px 20px; text-align: center; display: inline-block;">
              <div style="font-size: 9px; color: #F59E0B; text-transform: uppercase; letter-spacing: 1px;">Diagnostic Score</div>
              <div style="font-size: 32px; font-weight: 800; color: #FFFFFF; line-height: 1;">${calc.score}</div>
              <div style="font-size: 11px; color: #94A3B8; margin-top: 4px; font-weight: bold;">GRADE: ${calc.grade}</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- CONTENT BODY -->
      <div style="padding: 32px 24px;">
        ${note ? `<div style="background:#F8FAFC; border-left:4px solid #3B82F6; padding:16px; margin-bottom:24px; font-size: 13px; color: #475569; font-style:italic;">${esc(note)}</div>` : ''}
        
        <p style="font-size: 14px; margin-bottom: 20px; color: #334155;">Hi ${esc(firstName)}, we have successfully analyzed your operational data against Top 10% industry benchmarks.</p>
        <p style="font-size: 13.5px; margin-bottom: 30px; color: #334155; line-height: 1.6; background: #F8FAFC; padding: 16px; border-radius: 8px; border-left: 4px solid #F97316;">
          Based on your self-reported monthly revenue of <strong>$${calc.revenue.toLocaleString()}</strong>, your estimated annual revenue leakage is <strong>$${calc.annualLeak.toLocaleString()}</strong> (representing <strong>${leakagePct}% of operations</strong>). Furthermore, with a Google Rating of <strong>${grRating.toFixed(1)}</strong> and <strong>${grCount}</strong> reviews, your reputation metrics indicate key conversion opportunities at the top of your funnel.
        </p>
        
        <!-- EXECUTIVE SUMMARY METRICS -->
        <h2 style="color:#0F172A; text-transform:uppercase; font-size:13px; border-bottom:2px solid #E2E8F0; padding-bottom:8px; margin-bottom: 16px; letter-spacing: 1px;">Executive Financial Summary</h2>
        <table width="100%" cellpadding="0" cellspacing="8" border="0" style="margin-left: -8px; width: calc(100% + 16px);">
          <tr>
            <td width="33%">
              <div style="background:#FAFAFA; border:1px solid #E2E8F0; border-top: 4px solid #64748B; border-radius:8px; padding: 16px 12px; text-align: center; min-height: 90px;">
                <div style="font-size:10px; color:#64748B; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Monthly Revenue Input</div>
                <div style="font-size:22px; font-weight:800; color:#1E293B;">$${calc.revenue.toLocaleString()}</div>
              </div>
            </td>
            <td width="33%">
              <div style="background:#FAFAFA; border:1px solid #E2E8F0; border-top: 4px solid #F43F5E; border-radius:8px; padding: 16px 12px; text-align: center; min-height: 90px;">
                <div style="font-size:10px; color:#64748B; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Identified Monthly Leakage</div>
                <div style="font-size:22px; font-weight:800; color:#F43F5E;">$${calc.monthlyLeak.toLocaleString()}</div>
              </div>
            </td>
            <td width="33%">
              <div style="background:#FAFAFA; border:1px solid #E2E8F0; border-top: 4px solid #F43F5E; border-radius:8px; padding: 16px 12px; text-align: center; min-height: 90px;">
                <div style="font-size:10px; color:#64748B; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Annualized Leakage</div>
                <div style="font-size:22px; font-weight:800; color:#F43F5E;">$${calc.annualLeak.toLocaleString()}</div>
              </div>
            </td>
          </tr>
        </table>

        <!-- OWNER SNAPSHOT -->
        <div style="background: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 12px; padding: 20px; margin-top: 24px; margin-bottom: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <h3 style="color: #B45309; font-size: 15px; font-weight: 800; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 1px;">⚠️ Owner Snapshot</h3>
                <p style="font-size: 13px; color: #78350F; margin: 0 0 14px; line-height: 1.5;">
                  You are currently losing <strong>$${calc.monthlyLeak.toLocaleString()} per month</strong> mainly due to operational gaps in <strong>${esc(calc.breakdown[0] || 'your process flow')}</strong>.
                </p>
              </td>
            </tr>
          </table>
          <div style="background: #FFFFFF; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; color: #1E293B;">
              <tr>
                <td style="padding-bottom: 6px;"><strong>Estimated Monthly Leakage:</strong></td>
                <td align="right" style="font-size: 15px; font-weight: 800; color: #F43F5E; padding-bottom: 6px;">$${calc.monthlyLeak.toLocaleString()}/mo</td>
              </tr>
              <tr style="border-top: 1px solid #E2E8F0;">
                <td style="padding-top: 6px;"><strong>Immediate Recovery Target:</strong></td>
                <td align="right" style="font-size: 15px; font-weight: 800; color: #10B981; padding-top: 6px;">+$${recoverable.toLocaleString()}/mo (within 90 days)</td>
              </tr>
            </table>
          </div>
          <div style="text-align: center;">
            <a href="${SETTINGS.WALKTHROUGH_LINK || 'https://bluedatalabs.com/video-walkthrough'}" style="display: inline-block; background: #F97316; color: #FFFFFF; font-size: 12px; font-weight: bold; text-decoration: none; padding: 10px 20px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Watch 5-Min Walkthrough Video</a>
          </div>
        </div>

        <!-- LEAKAGE BREAKDOWN -->
        <h2 style="color:#0F172A; text-transform:uppercase; font-size:13px; border-bottom:2px solid #E2E8F0; margin-top:30px; padding-bottom:8px; margin-bottom: 16px; letter-spacing: 1px;">Primary Leakage Vectors</h2>
        ${leakHtml}

        <!-- LEAKAGE CATEGORY ALLOCATION TABLE -->
        ${categoryTableHtml}

        <!-- CURRENT VS POTENTIAL REVENUE VISUAL CHART -->
        ${visualChartHtml}
        
        <!-- REPUTATION -->
        ${reputationHtml}

        ${recommendedFixHtml}
        
        <!-- DECISION SUMMARY -->
        <h2 style="color:#0F172A; text-transform:uppercase; font-size:13px; border-bottom:2px solid #E2E8F0; margin-top:40px; padding-bottom:8px; margin-bottom: 16px; letter-spacing: 1px;">The Cost of Inaction</h2>
        <div style="background:#FFF1F2; border:1px solid #FECDD3; border-radius:12px; padding:24px; text-align:center;">
          <p style="font-size:13px; color:#BE123C; margin-bottom:20px; font-weight: bold;">Every day these operational gaps remain unaddressed, your business loses approximately:</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="border-right: 1px solid #FDA4AF;">
                <div style="color:#E11D48; font-size:24px; font-weight:900;">$${dailyCost.toLocaleString()}</div>
                <div style="font-size:10px; color:#9F1239; font-weight: bold; text-transform:uppercase; letter-spacing: 1px; margin-top: 4px;">Per Day</div>
              </td>
              <td align="center" style="border-right: 1px solid #FDA4AF;">
                <div style="color:#E11D48; font-size:24px; font-weight:900;">$${quarterlyCost.toLocaleString()}</div>
                <div style="font-size:10px; color:#9F1239; font-weight: bold; text-transform:uppercase; letter-spacing: 1px; margin-top: 4px;">Per Quarter</div>
              </td>
              <td align="center">
                <div style="color:#059669; font-size:24px; font-weight:900;">+$${recoverable.toLocaleString()}</div>
                <div style="font-size:10px; color:#065F46; font-weight: bold; text-transform:uppercase; letter-spacing: 1px; margin-top: 4px;">Recoverable / Mo</div>
              </td>
            </tr>
          </table>
        </div>
      </div>
      
      <!-- ROADMAP SECTION -->
      <div class="page-break"></div>
      <div style="padding:32px 24px;">
        <h2 style="color:#0F172A; text-transform:uppercase; font-size:16px; border-bottom:2px solid #E2E8F0; padding-bottom:8px; margin-bottom: 24px; letter-spacing: 1px;">90-Day Revenue Recovery Roadmap</h2>
        <p style="font-size: 13px; color: #475569; margin-bottom: 30px; line-height: 1.6;">The following implementation sequence is engineered to stabilize your revenue capture within the first 30 days and scale operational efficiency through day 90.</p>
        
        ${planHtml}

        <!-- ROADMAP RECOVERY SUMMARY CALLOUT -->
        <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 12px; padding: 20px; margin-top: 24px; margin-bottom: 24px; text-align: center;">
          <div style="font-size: 11px; color: #065F46; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Estimated Total Recovery (All 3 Phases Completed)</div>
          <div style="font-size: 26px; font-weight: 900; color: #047857;">Total Recoverable: $${recoverable.toLocaleString()}/month</div>
          <div style="font-size: 11px; color: #065F46; margin-top: 4px;">Annualized recovery value: <strong>$${(recoverable * 12).toLocaleString()}/year</strong></div>
        </div>
  
        <!-- VERIFICATION STAMP -->
        <h2 style="color:#0F172A; text-transform:uppercase; font-size:13px; border-bottom:2px solid #E2E8F0; margin-top:40px; padding-bottom:8px; letter-spacing: 1px;">Quality Assurance Verification</h2>
        <table width="100%" cellpadding="24" style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; margin-top:16px;">
          <tr>
            <td width="65%">
              <p style="font-size:14px; color:#1E293B; margin-top:0; margin-bottom:8px; font-weight:bold;">Analyst Verification Seal</p>
              <p style="font-size:12px; color:#475569; line-height:1.6; margin:0;">
                This diagnostic has been generated by the BDL Revenue Intelligence Engine and verified for data consistency by a Senior Revenue Analyst. The benchmarks applied are industry-specific to <strong>${esc(niche.charAt(0).toUpperCase() + niche.slice(1))}</strong> operations and calibrated for the current fiscal period.
              </p>
            </td>
            <td width="35%" align="center" style="border-left:1px solid #CBD5E1;">
              <div style="font-size:10px; color:#64748B; font-weight: bold; text-transform:uppercase; letter-spacing:1px; margin-bottom:12px;">Diagnostic Status</div>
              <div style="color:#10B981; font-weight:900; font-size:16px;">✓ VERIFIED</div>
              <div style="font-size:10px; color:#94A3B8; margin-top:8px; font-family: monospace;">Ref: ${reportId}</div>
            </td>
          </tr>
        </table>
      </div>
      
      <!-- BOILERPLATE PAGES -->
      <div class="page-break"></div>
      <div style="padding:32px 24px;">
        <h2 style="color:#0F172A; text-transform:uppercase; font-size:14px; border-bottom:2px solid #E2E8F0; padding-bottom:8px; margin-bottom: 24px; letter-spacing: 1px;">Appendix A: Diagnostic Methodology &amp; Important Disclosures</h2>
        <p style="font-size: 13px; color: #475569; line-height: 1.7; margin-bottom: 20px;">
          The BDL Revenue Diagnostic uses a structured estimation model to identify areas where revenue may be lost across service-based operations.
          Figures are calculated by applying publicly available industry benchmark percentages to the operational data you provided. These benchmarks are
          derived from widely-cited research including MGMA, NAR, Clio Legal Trends, OpenView SaaS benchmarks, USDA food waste reports, and similar
          peer-reviewed industry studies.
        </p>
        <p style="font-size: 13px; color: #475569; line-height: 1.7; margin-bottom: 20px;">
          All figures are <strong style="color:#1E293B;">conservative estimates</strong>. To avoid overstating results, a 40% conservative reduction is applied
          to all calculated leakage amounts before they are presented. The numbers in this report represent the lower range of what peer research suggests
          businesses in the <strong>${esc(niche.charAt(0).toUpperCase() + niche.slice(1))}</strong> sector typically leave on the table.
        </p>
        <p style="font-size: 13px; color: #F59E0B; font-weight: bold; line-height: 1.7; margin-bottom: 20px; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px 16px;">
          ⚠ These figures are illustrative estimates based on your self-reported inputs and generalised benchmarks. They are not a guarantee of revenue recovery
          and do not constitute financial, legal, or accounting advice. Actual results will vary based on execution, market conditions, and individual business circumstances.
        </p>
        
        <h3 style="color:#1E293B; font-size: 15px; margin-top: 40px; margin-bottom: 16px;">Primary Leakage Vectors Analysed</h3>
        <p style="font-size: 13px; color: #475569; line-height: 1.7; margin-bottom: 15px;">
          Our analysis focuses on three primary vectors of revenue loss:
          <br><br>
          <strong style="color: #0F172A;">1. Top-of-Funnel Attrition (Acquisition Loss):</strong> Leads that enter the ecosystem but fail to convert due to slow follow-up times, poor reputation metrics, or unoptimized intake processes. Industry standard follow-up time is &lt; 5 minutes; average performance is 24+ hours.<br><br>
          <strong style="color: #0F172A;">2. Mid-Funnel Operational Friction (Service Loss):</strong> Revenue lost during the service delivery phase, including appointment no-shows, under-billed hours, scheduling gaps, and inventory/labor waste.<br><br>
          <strong style="color: #0F172A;">3. Bottom-Funnel Retention (LTV Loss):</strong> Capital left on the table due to failed payments, lack of reactivation campaigns, churn, and poor cross-selling mechanics.
        </p>
      </div>

      <div class="page-break"></div>
      <div style="padding:32px 24px;">
        <h2 style="color:#0F172A; text-transform:uppercase; font-size:14px; border-bottom:2px solid #E2E8F0; padding-bottom:8px; margin-bottom: 24px; letter-spacing: 1px;">Appendix B: Industry Benchmarks</h2>
        <p style="font-size: 13px; color: #475569; line-height: 1.7; margin-bottom: 30px;">
          Understanding where you sit relative to the top 10% of performers in the <strong>${esc(niche.charAt(0).toUpperCase() + niche.slice(1))}</strong> industry is critical for strategic planning. The following benchmarks represent the performance of top-quartile businesses.
        </p>
        
        ${benchmarkHtml}
        
        <p style="font-size: 11px; color: #94A3B8; line-height: 1.6; font-style: italic;">
          Benchmarks sourced from publicly available industry research including MGMA, NAR, Clio Legal Trends Report, OpenView SaaS Benchmarks, USDA food waste data, and Toast/National Restaurant Association reports. All figures represent generalised averages and may vary by region, market size, and business model.
        </p>
      </div>

      <div class="page-break"></div>
      <div style="padding:32px 24px;">
        <h2 style="color:#0F172A; text-transform:uppercase; font-size:14px; border-bottom:2px solid #E2E8F0; padding-bottom:8px; margin-bottom: 24px; letter-spacing: 1px;">Implementation Notes & Strategy Worksheet</h2>
        <p style="font-size: 13px; color: #475569; line-height: 1.7; margin-bottom: 24px;">
          Use the following pages during your executive review session to map out internal resource allocation, assign task owners for the 90-day roadmap, and set target completion dates.
        </p>
        
        <div style="border: 2px dashed #CBD5E1; height: 160px; margin-bottom: 24px; padding: 16px; border-radius: 12px; background: #F8FAFC;">
          <p style="color: #64748B; font-size: 11px; font-weight: bold; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Phase 1 Focus (Weeks 1-4) / Immediate Constraints:</p>
        </div>
        <div style="border: 2px dashed #CBD5E1; height: 160px; margin-bottom: 24px; padding: 16px; border-radius: 12px; background: #F8FAFC;">
          <p style="color: #64748B; font-size: 11px; font-weight: bold; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Resource Allocation & Required Software Tooling:</p>
        </div>
        <div style="border: 2px dashed #CBD5E1; height: 160px; margin-bottom: 24px; padding: 16px; border-radius: 12px; background: #F8FAFC;">
          <p style="color: #64748B; font-size: 11px; font-weight: bold; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Delegation (Who owns which metric?):</p>
        </div>
      </div>

      <div class="page-break"></div>
      <div style="padding:32px 24px;">
        <h2 style="color:#0F172A; text-transform:uppercase; font-size:14px; border-bottom:2px solid #E2E8F0; padding-bottom:8px; margin-bottom: 24px; letter-spacing: 1px;">Next Steps: Partnering with BDL</h2>
        <p style="font-size: 14px; color: #1E293B; font-weight: bold; line-height: 1.7; margin-bottom: 16px;">
          You now possess the exact 90-day blueprint required to plug the <strong style="color: #F43F5E;">$${calc.monthlyLeak.toLocaleString()}/mo</strong> leakage occurring in your business. 
        </p>
        <p style="font-size: 13px; color: #475569; line-height: 1.7; margin-bottom: 30px;">
          While many organizations choose to execute this roadmap internally, doing so often pulls founders and key personnel away from their core competencies. 
          Implementation requires specialized software setup, script writing, staff training, and rigorous accountability tracking. If your team cannot manage this overhead, we can step in.
        </p>
        
        <div style="background: #0F172A; color: #FFFFFF; padding: 32px; border-radius: 16px; text-align: center; border-bottom: 4px solid #F59E0B; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
          <h3 style="margin-top: 0; color: #F59E0B; font-size: 18px; letter-spacing: 0.5px;">Custom Application Development & Implementation</h3>
          <p style="font-size: 14px; line-height: 1.6; margin-bottom: 24px; color: #CBD5E1;">
            BDL offers a full-service technical implementation package. If you don't have the time or technical staff to deploy this 90-day roadmap, <strong style="color: #FFFFFF;">we will build a customized internal application specifically for your business</strong> to automate these fixes. We build the software, deploy the systems, train your staff, and monitor the metrics until the revenue is successfully recaptured.
          </p>
          <p style="font-size: 16px; font-weight: 800; color: #10B981; margin-bottom: 0;">
            Stop relying on manual spreadsheets. Let us automate your revenue recovery.
          </p>
        </div>

        <p style="font-size: 14px; color: #1E293B; line-height: 1.7; margin-top: 40px; text-align: center;">
          <strong>Ready to stop losing money?</strong><br>
          <span style="color: #475569;">Reply directly to the email containing this report to schedule your Custom App Discovery Call.</span>
        </p>

        <!-- CONFUSION SAFETY NET -->
        <div style="background: #F8FAFC; border: 1.5px dashed #CBD5E1; border-radius: 12px; padding: 20px; text-align: center; margin-top: 30px;">
          <h3 style="margin-top: 0; color: #1E293B; font-size: 14px; font-weight: bold; margin-bottom: 6px;">❓ Need Help Reviewing This Report?</h3>
          <p style="font-size: 13px; color: #475569; line-height: 1.6; margin-bottom: 16px;">
            Not sure how to act on these findings? Watch our free 5-minute video walkthrough explaining how to use these copy-paste templates to start recovering your leakage immediately.
          </p>
          <a href="${SETTINGS.WALKTHROUGH_LINK || 'https://bluedatalabs.com/video-walkthrough'}" style="display: inline-block; background: #64748B; color: #FFFFFF; font-size: 12px; font-weight: bold; text-decoration: none; padding: 8px 16px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Watch 5-Min Walkthrough Video</a>
        </div>
      </div>

      <!-- LEGAL DISCLAIMER PAGE -->
      <div class="page-break"></div>
      <div style="padding:32px 24px;">
        <h2 style="color:#0F172A; text-transform:uppercase; font-size:13px; border-bottom:2px solid #E2E8F0; padding-bottom:8px; margin-bottom: 24px; letter-spacing: 1px;">Legal Disclaimer &amp; Terms of Use</h2>
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-left: 4px solid #F59E0B; border-radius:8px; padding:24px; font-size: 12px; color: #475569; line-height: 1.8;">
          <p style="margin-top:0;"><strong style="color:#1E293B;">Nature of This Report:</strong> This document is a Revenue Diagnostic Report prepared by BDL Revenue Intelligence. It is provided for informational and planning purposes only. All revenue leakage figures, estimates, projections, and recommendations contained in this report are based on (a) information self-reported by the client and (b) publicly available industry benchmark data. They are illustrative estimates, not audited financial statements.</p>
          <p><strong style="color:#1E293B;">No Guarantee of Results:</strong> BDL Revenue Intelligence makes no representation, warranty, or guarantee — express or implied — that implementing the recommendations in this report will result in any specific level of revenue recovery. Actual results will vary materially depending on market conditions, business-specific factors, quality of execution, staff capabilities, and other variables beyond BDL's control.</p>
          <p><strong style="color:#1E293B;">Not Professional Advice:</strong> This report does not constitute financial, legal, accounting, tax, or investment advice. Clients should consult qualified professionals before making significant business decisions based on any information contained herein.</p>
          <p><strong style="color:#1E293B;">Data Accuracy:</strong> The accuracy of this diagnostic is dependent on the accuracy and completeness of the data provided by the client. BDL Revenue Intelligence accepts no responsibility for errors resulting from inaccurate, incomplete, or misleading client inputs.</p>
          <p><strong style="color:#1E293B;">Benchmark Sources:</strong> Industry benchmarks referenced in this report are derived from publicly available third-party research (MGMA, NAR, Clio, OpenView, USDA, NRA, and similar organisations). BDL does not own or warrant these sources. Benchmarks represent generalised industry averages and may not apply to every business, region, or market segment.</p>
          <p style="margin-bottom:0;"><strong style="color:#1E293B;">Confidentiality:</strong> This report is prepared exclusively for the named recipient and contains confidential business analysis. Redistribution without consent of BDL Revenue Intelligence is not permitted.</p>
        </div>
        <p style="font-size: 10px; color: #94A3B8; text-align: center; margin-top: 24px;">© 2026 BDL Revenue Intelligence · All rights reserved · This report is for the exclusive use of the recipient named on page 1.</p>
      </div>
    </body>
  </html>`;
}

function sendConfirmationEmail(lead) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
      <h2 style="color: #F97316; margin-top: 0;">Audit Request Received ✅</h2>
      <p>Hi ${esc((lead.name || 'there').split(' ')[0])},</p>
      <p>We've successfully received your data for <strong>${esc(lead.business || 'your business')}</strong>.</p>
      <p>Our analysts are now processing your inputs through the BDL Revenue Intelligence engine. Once the preliminary analysis is complete, we will follow up with the results.</p>
      <p style="font-size: 11px; color: #94a3b8; border-top: 1px solid #eee; padding-top: 15px; margin-top: 20px;">BDL Revenue Intelligence Team</p>
    </div>`;

  MailApp.sendEmail({ 
    to: lead.email, 
    subject: `Audit Request Received - ${lead.business}`, 
    htmlBody: html, 
    name: 'BDL Revenue Intelligence' 
  });
}

function sendPaymentReceiptEmail(lead) {
  const amount = SETTINGS.REPORT_PRICE;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
      <h2 style="color: #10B981; margin-top: 0;">Payment Successful ✅</h2>
      <p>Hi ${esc((lead.name || 'there').split(' ')[0])},</p>
      <p>This email confirms that we have successfully received your payment for the Executive Revenue Diagnostic.</p>
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
      </div>
      <p>Your full, unredacted executive report and 90-day action plan is being generated right now and will be sent in a separate email shortly.</p>
      <p>Thank you for choosing BDL Revenue Intelligence.</p>
      <p style="font-size: 11px; color: #94a3b8; border-top: 1px solid #eee; padding-top: 15px; margin-top: 20px;">BDL Revenue Intelligence Team</p>
    </div>`;

  MailApp.sendEmail({ 
    to: lead.email, 
    subject: `Payment Receipt - ${lead.business}`, 
    htmlBody: html, 
    name: 'BDL Revenue Intelligence' 
  });
}

function buildSummaryReportEmailHtml(lead, note, template) {
  const leakage = parseFloat(String(lead.totalLeakage || '0').replace(/[$,]/g, '')) || 0;
  const breakdown = (lead.leakageBreakdown || '').split(' | ').filter(Boolean);
  
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #08090C; font-family: Arial, sans-serif; color: #E8EAF0;">
      <tr>
        <td align="center" style="padding: 20px 10px;">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; margin: 0 auto; border-collapse: collapse;">
            <tr>
              <td style="background-color: #0F1117; padding: 25px; border-radius: 12px; border: 1px solid #1E2230;">
                <h3 style="color: #F97316; font-size: 20px; margin: 0 0 20px;">📊 Revenue Audit Summary: ${esc(lead.business)}</h3>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="padding: 10px 0; border-bottom: 1px solid #1E2230; font-size: 13px; color: #6B7280;">Estimated Leakage</td><td align="right" style="padding: 10px 0; border-bottom: 1px solid #1E2230; font-size: 14px; font-weight: bold; color: #EF4444;">$${leakage.toLocaleString()}/mo</td></tr>
                  <tr><td style="padding: 10px 0; font-size: 13px; color: #6B7280;">Annual Impact</td><td align="right" style="padding: 10px 0; font-size: 14px; font-weight: bold; color: #EF4444;">$${(leakage * 12).toLocaleString()}/yr</td></tr>
                </table>
              </td>
            </tr>
            <tr><td style="height: 15px;">&nbsp;</td></tr>
            <tr>
              <td align="center" style="padding: 30px; background-color: rgba(249,115,22,0.1); border-radius: 12px; border: 2px dashed #F97316;">
                <p style="color: #E8EAF0; font-size: 15px; margin: 0 0 15px; font-weight: bold;">Your full Executive Revenue Diagnostic is ready.</p>
                <a href="${getGlobalPaymentLink()}" style="background-color: #F97316; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Unlock Full Report →</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

/**
 * Builds a professional delivery email for the full paid report.
 */
function buildFullReportEmailHtml(lead, note, template) {
  const calc = calculateLeadLeakage(lead);
  const leakage = calc.monthlyLeak;
  const annual = calc.annualLeak;
  const bizName = lead.business || 'Your Business';
  const reportId = lead.id || 'N/A';
  const nicheName = (lead.niche || 'General').charAt(0).toUpperCase() + (lead.niche || 'General').slice(1);
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const title = (template.subject || 'Executive Revenue Audit').split(' — ')[0];

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #08090C; font-family: Arial, sans-serif; color: #E8EAF0;">
      <tr>
        <td align="center" style="padding: 20px 10px;">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; margin: 0 auto; border-collapse: collapse;">
            <tr>
              <td style="background-color: #0F1117; padding: 25px; border-radius: 12px; border: 1px solid #1E2230;">
                <h3 style="color: #F97316; font-size: 20px; margin: 0 0 10px;">📊 ${esc(title)}: ${esc(bizName)}</h3>
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
                  <tr>
                    <td style="font-size: 11px; color: #6B7280; text-transform: uppercase; letter-spacing: 1px;">ID: ${reportId}</td>
                    <td align="right" style="font-size: 11px; color: #6B7280; text-transform: uppercase;">Date: ${date}</td>
                  </tr>
                </table>
                
                <div style="background-color: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); padding: 25px; border-radius: 10px; text-align: center; margin-bottom: 25px;">
                  <div style="font-size: 11px; color: #EF4444; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; letter-spacing: 1px;">Verified Monthly Leakage</div>
                  <div style="font-size: 42px; font-weight: 800; color: #E8EAF0; line-height: 1;">$${Math.round(leakage).toLocaleString()}</div>
                  <div style="font-size: 13px; color: #6B7280; margin-top: 8px;">≈ $${Math.round(annual).toLocaleString()} annual impact</div>
                </div>

                <p style="font-size: 14px; line-height: 1.6; color: #E8EAF0; margin: 0;">
                  Thank you for your payment. Our diagnostic engine has completed the operational audit for your business. We have identified critical friction points and provided exact steps to recapture this revenue.
                </p>
              </td>
            </tr>
            
            ${note ? `
            <tr><td style="height: 15px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
            <tr>
              <td style="padding: 20px; border-left: 4px solid #F97316; background-color: #141720; color: #E8EAF0; font-size: 13px; line-height: 1.6; font-style: italic;">
                ${esc(note).split('\n').join('<br>')}
              </td>
            </tr>` : ''}

            <tr><td style="height: 15px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
            <tr>
              <td align="center" style="padding: 30px; background-color: rgba(16, 185, 129, 0.1); border-radius: 12px; border: 2px dashed #10B981;">
                <p style="color: #10B981; font-size: 16px; margin: 0 0 10px; font-weight: bold;">📄 Full Diagnostic Report Attached</p>
                <p style="color: #6B7280; font-size: 12px; margin: 0; line-height: 1.5;">Your executive diagnostic PDF, including the 90-day roadmap and priority matrix, is attached to this email.</p>
              </td>
            </tr>
            
            <tr><td style="height: 15px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
            <tr>
              <td style="background-color: #0F1117; padding: 20px; border: 1px solid #1E2230; border-radius: 10px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size: 13px; color: #E8EAF0;">Audit Verification:</td>
                    <td align="right" style="font-size: 13px; color: #10B981; font-weight: bold;">✓ ANALYST VERIFIED</td>
                  </tr>
                  <tr>
                    <td style="font-size: 11px; color: #6B7280; padding-top: 4px;" colspan="2">
                      Benchmarks: ${esc(nicheName)} Operations Engine (FY26)
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr><td style="height: 15px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
            <tr>
              <td style="background-color: #0F1117; padding: 20px; border: 1px solid #1E2230; border-radius: 10px;">
                <div style="font-size: 10px; color: #6B7280; text-transform: uppercase; font-weight: bold; margin-bottom: 12px; letter-spacing: 1px;">Payment Confirmation</div>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size: 13px; color: #E8EAF0; padding-bottom: 5px;">Amount Paid:</td>
                    <td align="right" style="font-size: 13px; color: #E8EAF0; font-weight: bold; padding-bottom: 5px;">$${SETTINGS.REPORT_PRICE} USD</td>
                  </tr>
                  <tr>
                    <td style="font-size: 13px; color: #E8EAF0;">Payment Method:</td>
                    <td align="right" style="font-size: 13px; color: #E8EAF0; font-weight: bold;">Electronic Transfer / Ref: ${esc(lead.paymentReference || 'Verified')}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding: 30px; color: #6B7280; font-size: 11px;">
                © 2026 BDL Intelligence • Reference: ${reportId}<br>
                Need assistance? Reply to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function getTemplateForLead(lead) {
  const niche = (lead.niche || '').toLowerCase();
  const rules = getNicheCalculationRules(niche); // Pull source of truth from Core_Logic

  const templates = {
    dental: { subject: 'Dental Practice Revenue Audit — {bizName}' },
    realestate: { subject: 'Real Estate Agency Revenue Audit — {bizName}' },
    healthcare: { subject: 'Healthcare Practice Revenue Audit — {bizName}' },
    legal: { subject: 'Law Firm Revenue Audit — {bizName}' },
    saas: { subject: 'SaaS Business Revenue Audit — {bizName}' },
    restaurant: { subject: 'Restaurant Revenue Audit — {bizName}' },
    general: { subject: 'Your Revenue Audit — {bizName}' }
  };

  const base = templates[niche] || templates.general;
  
  // Return a new object to prevent mutation of the source map
  return {
    subject: base.subject.replace('{bizName}', lead.business || 'your business'),
    plan90: rules.plan90
  };
}

function getLeadPdf(lead, note, type = 'full') {
  try {
    const isPaid = ['paid','delivered'].includes(String(lead.paidReport||'').trim().toLowerCase());
    
    let html = '';
    let filename = '';
    const safeBizName = (lead.business || 'Revenue_Audit').replace(/[^a-z0-9]/gi, '_');

    if (type === 'teaser') {
      html = buildTeaserPdfReportHtml(lead, note);
      filename = safeBizName + '_Teaser.pdf';
    } else if (type === 'payment') {
      html = buildPaymentPdfHtml(lead);
      filename = safeBizName + '_Invoice.pdf';
    } else {
      if (!isPaid) throw new Error("Full PDF generation is restricted to leads with 'Paid' or 'Delivered' status.");
      html = buildFullPdfReportHtml(lead, note);
      filename = safeBizName + '_Full_Report.pdf';
    }

    const blob = Utilities.newBlob(html, 'text/html', 'report.html').getAs('application/pdf');
    return { success: true, base64: Utilities.base64Encode(blob.getBytes()), filename: filename };
  } catch (err) { return { success: false, error: err.message }; }
}

function saveLeadPdfToDrive(leadId, pdfType = 'teaser', note = '') {
  try {
    const leadSheet = getSpreadsheet().getSheetByName(SHEETS.LEADS);
    if (!leadSheet) return { success: false, error: 'Leads tab not found' };
    const data = leadSheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf('id');
    const pdfLinkCol = headers.indexOf('pdfLink');
    const notesCol = headers.indexOf('notes');
    
    let leadRow = -1;
    let lead = {};
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol]).trim() === String(leadId).trim()) {
        leadRow = i + 1;
        headers.forEach((h, idx) => {
          lead[h] = data[i][idx];
        });
        break;
      }
    }
    
    if (leadRow === -1) {
      return { success: false, error: 'Lead not found: ' + leadId };
    }
    
    let html = '';
    const safeBizName = (lead.business || 'Revenue_Audit').replace(/[^a-z0-9]/gi, '_');
    let filename = '';
    
    if (pdfType === 'teaser') {
      html = buildTeaserPdfReportHtml(lead, note);
      filename = safeBizName + '_Teaser.pdf';
    } else {
      html = buildFullPdfReportHtml(lead, note);
      filename = safeBizName + '_Full_Report.pdf';
    }
    
    const pdfBlob = Utilities.newBlob(html, 'text/html', 'report.html').getAs('application/pdf');
    pdfBlob.setName(filename);
    
    const folderName = "BDL Audit Reports";
    let folder;
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    const file = folder.createFile(pdfBlob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const link = file.getUrl();
    
    if (pdfLinkCol !== -1) {
      leadSheet.getRange(leadRow, pdfLinkCol + 1).setValue(link);
    }
    
    if (notesCol !== -1) {
      const currentNotes = String(leadSheet.getRange(leadRow, notesCol + 1).getValue() || '');
      const appendStr = `\n[PDF Audit Generated]: ${link}`;
      leadSheet.getRange(leadRow, notesCol + 1).setValue(currentNotes + appendStr);
    }
    
    return { success: true, pdfLink: link, filename: filename };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function createPdfAttachment(html, filename) {
  const blob = Utilities.newBlob(html, 'text/html', 'report.html');
  const pdfBlob = blob.getAs('application/pdf');
  pdfBlob.setName(filename || 'Revenue_Audit.pdf'); 
  return pdfBlob;
}function buildTeaserPdfReportHtml(lead, note) {
  const bizName = esc(lead.business || 'Your Business');
  const calc = calculateLeadLeakage(lead);
  const firstName = String(lead.name || 'there').split(' ')[0];
  const niche = (lead.niche || 'General').toLowerCase();
  const reportId = 'BDL-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd') + '-' + (niche.toUpperCase().slice(0, 3));
  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM dd, yyyy'); 

  const leakHtml = calc.breakdown.map((item, i) => `
    <div style="border-left: 4px solid #9CA3AF; background: #f9fafb; padding: 16px; margin-bottom: 12px; border-radius: 0 8px 8px 0; filter: blur(2px);">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td><strong style="font-size: 14px; color: #111;">${esc(item)}</strong></td>
          <td align="right"><span style="color:#9CA3AF; font-weight: 800; font-size: 15px;">-$***,***/mo</span></td>
        </tr>
        <tr><td colspan="2" style="padding-top: 8px; font-size: 12px; color: #444; line-height: 1.5;"><strong>Recommended Fix:</strong> 🔒 UNLOCK FULL REPORT TO VIEW</td></tr>
      </table>
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Helvetica,Arial;color:#111;line-height:1.5;} .page-break{page-break-before:always;}</style></head>
    <body>
      <table width="100%" cellpadding="12" style="background:#F97316; color:#fff; font-weight:bold;">
        <tr><td>BDL — REVENUE INTELLIGENCE (SUMMARY)</td><td align="right">ID: ${reportId}</td></tr>
      </table>
      <div style="background:#1a1a2e; color:#fff; padding:30px 24px;">
        <table width="100%">
          <tr>
            <td>
              <h1 style="margin:0;">${esc(bizName)}</h1>
              <p style="color:#9ca3af;">${esc(lead.city || 'National')} ${lead.state ? ', ' + esc(lead.state) : ''}</p>
              <p style="color:#F97316; font-size: 12px; margin-top: 4px; font-weight: bold;">Executive Revenue Diagnostic Summary · ${dateStr}</p>
            </td>
          </tr>
        </table>
      </div>
      <div style="padding:24px;">
        <p style="font-size: 13px; margin-bottom: 20px;">Hi ${esc(firstName)}, this is a summary of your operational data against industry benchmarks.</p>
        
        <h2 style="color:#F97316; text-transform:uppercase; font-size:14px; border-bottom:1px solid #eee;">Executive Summary</h2>
        <table width="100%" cellpadding="15" cellspacing="10">
          <tr>
            <td align="center" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px;">
              <div style="font-size:10px; color:#666;">MONTHLY LEAKAGE</div>
              <div style="font-size:20px; font-weight:800; color:#EF4444;">$${calc.monthlyLeak.toLocaleString()}</div>
            </td>
            <td align="center" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px;">
              <div style="font-size:10px; color:#666;">ANNUAL IMPACT</div>
              <div style="font-size:20px; font-weight:800; color:#EF4444;">$${calc.annualLeak.toLocaleString()}</div>
            </td>
          </tr>
        </table>

        <div style="margin-top: 30px; padding: 20px; background: #fff8f0; border: 1px solid #fed7aa; text-align: center; border-radius: 8px;">
          <h3 style="color: #F97316; margin-top: 0;">Detailed Breakdown & 90-Day Plan Locked</h3>
          <p style="font-size: 13px; color: #666;">The detailed analysis mapping out exactly where the leakage is occurring, and the step-by-step 90-day action plan to recover it, are available in the full Executive Report.</p>
        </div>

        <h2 style="color:#F97316; text-transform:uppercase; font-size:14px; border-bottom:1px solid #eee; margin-top:25px; padding-bottom:8px;">Leakage Breakdown (Preview)</h2>
        <div style="position: relative;">
          ${leakHtml}
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center;">
            <div style="background: rgba(0,0,0,0.8); color: #fff; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 18px; letter-spacing: 1px;">🔒 LOCKED</div>
          </div>
        </div>
      </div>
    </body></html>`;
}

function buildPaymentPdfHtml(lead) {
  const bizName = esc(lead.business || 'Your Business');
  const paymentId = lead.id || 'AUDIT-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'mmss');
  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM dd, yyyy'); 
  const amount = SETTINGS.REPORT_PRICE;
  const link = getGlobalPaymentLink();

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Helvetica,Arial;color:#111;line-height:1.5;}</style></head>
    <body>
      <table width="100%" cellpadding="12" style="background:#0F1117; color:#fff; font-weight:bold;">
        <tr><td>BDL — INVOICE & PAYMENT REQUEST</td><td align="right">Ref: ${paymentId}</td></tr>
      </table>
      <div style="padding:40px;">
        <table width="100%" style="margin-bottom: 40px;">
          <tr>
            <td>
              <h2 style="margin: 0; color: #111;">Billed To:</h2>
              <p style="margin: 5px 0; color: #444; font-size: 18px; font-weight: bold;">${bizName}</p>
              <p style="margin: 0; color: #666;">${esc(lead.email || '')}</p>
            </td>
            <td align="right" valign="top">
              <p style="margin: 0; color: #666; font-size: 14px;">Date: ${dateStr}</p>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="15" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; border-collapse: collapse;">
          <tr style="background: #f9fafb; text-transform: uppercase; font-size: 12px; color: #666;">
            <th align="left" style="border-bottom: 1px solid #e5e7eb;">Description</th>
            <th align="right" style="border-bottom: 1px solid #e5e7eb;">Total</th>
          </tr>
          <tr>
            <td style="border-bottom: 1px solid #e5e7eb; font-size: 14px;">
              <strong>Full Executive Revenue Diagnostic & 90-Day Action Plan</strong><br>
              <span style="font-size: 12px; color: #666;">Detailed analysis mapping the recovery of identified revenue leakage.</span>
            </td>
            <td align="right" style="border-bottom: 1px solid #e5e7eb; font-size: 16px; font-weight: bold;">$${amount}.00 USD</td>
          </tr>
          <tr style="background: #fff8f0;">
            <td align="right" style="font-size: 14px; font-weight: bold; color: #F97316;">Amount Due:</td>
            <td align="right" style="font-size: 18px; font-weight: 900; color: #F97316;">$${amount}.00 USD</td>
          </tr>
        </table>

        <div style="margin-top: 40px; padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; text-align: center;">
          <h3 style="margin-top: 0; color: #111;">Payment Instructions</h3>
          <p style="font-size: 14px; color: #444;">Please click the button below to complete your payment (supports local, fee-free transfer options like ACH and SEPA).</p>
          <p style="font-size: 13px; color: #EF4444; font-weight: bold; margin-bottom: 20px;">Crucial: Include the Reference ID <span style="background: #e5e7eb; padding: 3px 8px; border-radius: 4px; color: #111;">${paymentId}</span> in the payment note.</p>
          <a href="${link}" style="display: inline-block; background: #F97316; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Pay $${amount} Securely</a>
          <div style="font-size: 11px; color: #6B7280; margin-top: 15px; font-style: italic; line-height: 1.4;">* Note: Payments are securely processed via Wise under our parent finance name: <strong>M Haresh Kumar</strong> (supporting standard fee-free local transfers to minimize transaction costs).</div>
        </div>
      </div>
    </body></html>`;
}

function sendAdminNotificationEmail(lead, isRequested) {
  try {
    const adminEmail = SETTINGS.ADMIN_EMAIL;
    const adminDashboardUrl = SETTINGS.ADMIN_DASHBOARD_URL;
    const subject = isRequested 
      ? `🔥 New Audit Request: ${lead.business || 'Unknown'}` 
      : `📊 New Calculator Lead: ${lead.business || 'Unknown'}`;
    const body = `Hi Admin,\n\n` +
                 (isRequested 
                   ? `A new paid revenue audit has been requested!\n\n` 
                   : `A new user completed a calculator submission.\n\n`) +
                 `Business: ${lead.business || '—'}\n` +
                 `Niche: ${lead.niche || '—'}\n` +
                 `Contact Name: ${lead.name || '—'}\n` +
                 (lead.jobTitle ? `Job Title: ${lead.jobTitle}\n` : '') +
                 `Email: ${lead.email || '—'}\n` +
                 `Phone: ${lead.phone || '—'}\n` +
                 `Estimated Monthly Leakage: $${Number(lead.totalLeakage || 0).toLocaleString()}\n\n` +
                 `View Lead in Admin Dashboard: ${adminDashboardUrl}?search=${encodeURIComponent(lead.email)}`;
    
    MailApp.sendEmail(adminEmail, subject, body);
  } catch (e) {
    Logger.log("Admin notification email failed: " + e.toString());
  }
}

function sendWebhookNotification(text) {
  try {
    const sheet = getConfigSheet();
    if (!sheet) return;
    const webhookUrl = String(sheet.getRange('A4').getValue()).trim();
    if (!webhookUrl || !webhookUrl.startsWith("http")) return;
    
    let payload = {};
    if (webhookUrl.includes("discord.com")) {
      // Discord uses 'content'
      payload = { content: text };
    } else {
      // Google Chat and Slack use 'text'
      payload = { text: text };
    }
    
    UrlFetchApp.fetch(webhookUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload)
    });
  } catch (e) {
    Logger.log("Webhook notification failed: " + e.toString());
  }
}
