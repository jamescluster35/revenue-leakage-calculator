/**
 * BDL REVENUE AUDIT BACKEND
 * Calculation Engine & Industry Rules
 */

/**
 * Retrieves niche-specific calculation rules and plan details.
 *
 * ──────────────────────────────────────────────────────────────────
 * IMPORTANT — LEGITIMACY & COMPLIANCE NOTE
 * ──────────────────────────────────────────────────────────────────
 * All `estimatePct` values are CONSERVATIVE BENCHMARK ESTIMATES only.
 * They are derived from publicly available industry research and
 * widely-cited studies. They are NOT guarantees or legal projections.
 *
 * These percentages are used as a starting point for illustrative
 * estimates only. The frontend further applies a 40% conservative
 * multiplier (cm=0.6) before displaying any figure to users.
 *
 * Source references per niche (for internal documentation):
 *  - Dental:      ADAA/ADA patient no-show studies (~10-15%)
 *  - Real Estate: NAR research & portal ROI benchmarks (~8-12%)
 *  - Healthcare:  MGMA claim denial rate studies, JAMA no-show data (~15%)
 *  - Legal:       ILTA & Clio Legal Trends Reports (billable leakage ~15-20%)
 *  - SaaS:        OpenView SaaS benchmarks, ChurnZero churn studies (~10%)
 *  - Restaurant:  USDA Food Waste estimates, Toast industry reports (~16%)
 *  - General:     McKinsey & HBR SMB operational efficiency studies (~12%)
 * ──────────────────────────────────────────────────────────────────
 */
function getNicheCalculationRules(niche) {
  const key = String(niche || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const rules = {
    dental: {
      // Benchmark estimate: ~11% of monthly revenue. Source: ADA/ADAA no-show and recall studies.
      estimatePct: 0.11,
      breakdown: ['Appointment No-Show Loss', 'Unscheduled Recall Patients', 'New Patient Follow-Up Gap', 'Staff Idle Time'],
      plan90: [
        { week: '1-2', action: 'Audit scheduling', detail: 'Implement automated SMS/Email reminders at 48h and 2h. Template: "Hi {Name}, your dental visit at {Clinic} is scheduled for {Time}. Please reply YES to confirm or call to reschedule. See you soon!"', priority: 'CRITICAL', quick: true, impact: '+$800/mo' },
        { week: '3-4', action: 'Reactivation Campaign', detail: 'Assign a coordinator to call 10 overdue patients daily to book hygiene visits. Script: "Hi {Name}, it’s been over 6 months since your last cleaning at {Clinic}. We have a spot open this Thursday—would you like to protect your dental health and claim it?"', priority: 'HIGH', quick: false, impact: '+$1,200/mo' },
        { week: '5-8', action: 'Software Audit', detail: 'Consolidate redundant subscriptions (PMS, imaging, patient marketing) to recover immediate overhead. Checklist: (1) Audit software licenses vs active staff, (2) Cancel unused marketing modules, (3) Negotiate merchant processing fees.', priority: 'MEDIUM', quick: true, impact: '+$300/mo' }
      ]
    },
    realestate: {
      // Benchmark estimate: ~8% of monthly revenue. Source: NAR annual report, portal ROI benchmarks.
      estimatePct: 0.08,
      breakdown: ['Lead Follow-Up Gap', 'Portal Spend vs Returns', 'Agent Admin Time'],
      plan90: [
        { week: '1-2', action: '5-Touch Sequence', detail: 'Deploy a 7-touch follow-up system (Call/Text/Email). Text Template: "Hi {Name}, this is {Agent} with BDL Realty. I saw you viewed {Address} online. Would you like me to send you the neighborhood pricing trends?"', priority: 'CRITICAL', quick: true, impact: '+$2,500/mo' },
        { week: '3-4', action: 'Portal ROI Review', detail: 'Audit Portal GCI vs monthly spend. Reallocate budget from underperforming zip codes. Checklist: (1) Calculate cost-per-lead per portal, (2) Identify zip codes with zero closings, (3) Pause low-intent ad campaigns.', priority: 'HIGH', quick: false, impact: '+$1,000/mo' },
        { week: '5-8', action: 'Standardize Outreach', detail: 'Create automated templates for open house visitors. Email Template: "Hi {Name}, thanks for stopping by {Address}! I’ve attached the private inspection disclosures and virtual layout here: {Link}."', priority: 'MEDIUM', quick: false, impact: '+$1,500/mo' }
      ]
    }, 
    healthcare: {
      // Benchmark estimate: ~15% of monthly revenue. Source: MGMA claim denial studies, JAMA no-show data.
      estimatePct: 0.15,
      breakdown: ['Appointment No-Show Loss', 'Insurance Claim Rejections', 'Referral No-Conversion'],
      plan90: [
        { week: '1-2', action: 'Reminders & Claims', detail: 'Deploy 2-way SMS reminders and audit claim rejection codes. Template: "Hi {Name}, your consultation is confirmed for {Time}. To help our team prepare, reply YES to confirm or click to cancel: {Link}."', priority: 'CRITICAL', quick: true, impact: '+$1,100/mo' },
        { week: '3-4', action: 'Referral Sequence', detail: 'Contact all incoming referrals within 24 hours. Script: "Hi {Name}, we received your referral from Dr. {Name}. I noticed your charts were processed, and we have an opening tomorrow at 10 AM to get you checked. Does that work?"', priority: 'HIGH', quick: false, impact: '+$900/mo' },
        { week: '5-8', action: 'Staff Optimization', detail: 'Align clinical staff hours with historical patient volume. Checklist: (1) Extract check-in volume hourly reports, (2) Align scheduling blocks, (3) Trim administrative shifts during mid-day troughs.', priority: 'MEDIUM', quick: false, impact: '+$600/mo' }
      ]
    }, 
    legal: {
      // Benchmark estimate: ~15% of monthly revenue. Source: Clio Legal Trends Report, ILTA billable hour data.
      estimatePct: 0.15,
      breakdown: ['Unbilled Attorney Hours', 'Consultation No-Convert', 'Attorney Admin Time'],
      plan90: [
        { week: '1-2', action: 'Time Capture', detail: 'Adopt daily contemporaneous time entry. Practice Guideline: Log billable blocks immediately after calls/tasks. Capturing just 15 more minutes a day adds $3,000+/mo per attorney.', priority: 'CRITICAL', quick: true, impact: '+$3,000/mo' },
        { week: '3-4', action: 'Task Delegation', detail: 'Move non-billable administrative and intake tasks to paralegals or VAs. Checklist: (1) Identify daily document collation tasks, (2) Build standardized client intake templates, (3) Assign follow-up calls to admin team.', priority: 'HIGH', quick: false, impact: '+$1,500/mo' },
        { week: '5-8', action: 'Pipeline Audit', detail: 'Review the Consult-to-Retained funnel. Follow-Up Script: "Hi {Name}, this is {Attorney}\'s assistant. {Attorney} has completed your case audit. Do you want us to initiate the draft retainers for your signature?"', priority: 'MEDIUM', quick: false, impact: '+$2,000/mo' }
      ]
    }, 
    saas: {
      // Benchmark estimate: ~10% of monthly revenue. Source: OpenView SaaS benchmarks, ChurnZero churn studies.
      estimatePct: 0.10,
      breakdown: ['Monthly Churn Loss', 'Trial No-Convert Loss', 'Failed Payments'],
      plan90: [
        { week: '1-2', action: 'Churn Guard', detail: 'Segment users by last login to find at-risk accounts. Email Template: "Subject: Getting the most out of {App}. Hi {Name}, I noticed your team hasn\'t used the reporting module lately. Here is a quick 2-minute video on how it saves 4h/week: {Link}."', priority: 'CRITICAL', quick: false, impact: '+$1,500/mo' },
        { week: '3-4', action: 'Dunning Setup', detail: 'Automate failed payment recovery with a retry sequence. Email Template: "Subject: Action Required: Update billing info. Hi {Name}, your monthly payment failed. We have kept your account active, but please update details here to avoid service suspension: {Link}."', priority: 'HIGH', quick: true, impact: '+$800/mo' },
        { week: '5-8', action: 'Docs & Support', detail: 'Audit common support tickets and build a self-service knowledge base. Checklist: (1) Export last 90 days of tickets, (2) Group by query category, (3) Write step-by-step guides for top 5 issues.', priority: 'MEDIUM', quick: false, impact: '+$500/mo' }
      ]
    }, 
    restaurant: {
      // Benchmark estimate: ~16% of monthly revenue. Source: USDA food waste estimates, Toast/National Restaurant Association data.
      estimatePct: 0.16,
      breakdown: ['Food Waste', 'No-Show & Cancellation Loss', 'Delivery Fees'],
      plan90: [
        { week: '1-2', action: 'Reservation Fix', detail: 'Require SMS confirmation for all bookings. Template: "Hi {Name}, your table at {Restaurant} is set for {Time}. To help our kitchen prepare, please confirm with YES or reply CANCEL to free the table. Thanks!"', priority: 'CRITICAL', quick: true, impact: '+$1,200/mo' },
        { week: '3-4', action: 'Fee Analysis', detail: 'Analyze net profit per delivery platform and promote direct ordering. Flyer Template: "Skip the delivery app fees! Order directly through our site at {URL} and get 10% off your pickup order using code DIRECT10."', priority: 'HIGH', quick: true, impact: '+$600/mo' },
        { week: '5-8', action: 'Menu Optimization', detail: 'Track food waste for 14 days and engineer menus. Checklist: (1) Log prep waste weights daily, (2) Target high-margin, low-waste ingredients, (3) Cross-utilize premium proteins across multiple menu items.', priority: 'MEDIUM', quick: false, impact: '+$1,000/mo' }
      ]
    },
    general: {
      // Benchmark estimate: ~12% of monthly revenue. Source: McKinsey & HBR SMB operational efficiency research.
      estimatePct: 0.12,
      breakdown: ['Lead Follow-Up Gap', 'Administrative Time Waste'],
      plan90: [
        { week: '1-2', action: 'Process Audit', detail: 'Map your end-to-end sales cycle and identify manual bottlenecks. Checklist: (1) List client touchpoints, (2) Log time spent copy-pasting customer details, (3) Eliminate redundant sheet transfers.', priority: 'CRITICAL', quick: true, impact: '+$500/mo' },
        { week: '3-4', action: 'Standardize Outreach', detail: 'Build a multi-channel lead follow-up sequence. Text Template: "Hi {Name}, I saw you requested our operational leakage guide. Let’s do a quick 10-minute audit of your pipeline—do you have time tomorrow at 2 PM?"', priority: 'HIGH', quick: false, impact: '+$1,200/mo' },
        { week: '5-8', action: 'Margin Optimization', detail: 'Audit service delivery costs vs current pricing. Checklist: (1) Calculate fully-burdened hourly cost per employee, (2) List recurring vendor subscription overhead, (3) Adjust client billing rates to maintain target 65%+ gross margins.', priority: 'MEDIUM', quick: false, impact: '+$800/mo' }
      ]
    } 
  };
  return rules[key] || rules.dental;
}


/**
 * Calculates various leakage metrics and a health score for a given lead.
 */
function calculateLeadLeakage(lead) {
  const n = (v) => {
    if (v === undefined || v === null || v === '') return NaN;
    const p = parseFloat(String(v).replace(/[$,]/g, ''));
    return isNaN(p) ? NaN : p;
  };

  let revenue = n(lead.monthlyRevenue);
  if (isNaN(revenue)) revenue = 0;

  const rules = getNicheCalculationRules(lead.niche);
  let monthlyLeak = n(lead.totalLeakage);

  if (isNaN(monthlyLeak) || (monthlyLeak === 0 && revenue > 0)) {
    monthlyLeak = Math.round(revenue * rules.estimatePct);
  }

  let annualLeak = n(lead.annualLeakage);
  if (isNaN(annualLeak) || annualLeak === 0) annualLeak = Math.round(monthlyLeak * 12);
  
  const breakdown = (lead.leakageBreakdown || rules.breakdown.join(' | ')).split(' | ').filter(Boolean);

  // Unified Revenue Diagnostic Score Logic
  let score = 100;
  const ratio = revenue > 0 ? monthlyLeak / revenue : 0.25;
  
  // Deduction based on leakage ratio (Max 40 points)
  score -= Math.min(40, (ratio * 120));
  
  // Reputation Deductions
  const grRating = n(lead.googleRating);
  if (grRating > 0 && grRating < 4.0) score -= 15;
  if (grRating === 0) score -= 20; // Massive penalty for being invisible
  if (n(lead.googleReviews) < 30) score -= 8;    // Trust penalty
  
  score = Math.max(15, Math.min(95, Math.round(score)));
  const grade = score < 50 ? 'Critical' : score < 75 ? 'Needs Attention' : 'Healthy'; 

  // Parse has_tool and assign toolTag
  let hasTool = false;
  if (lead.calculationInputs) {
    try {
      const inputs = JSON.parse(lead.calculationInputs);
      if (inputs.has_tool === 'yes' || inputs.has_tool === 1 || inputs.has_tool === '1') {
        hasTool = true;
      }
    } catch (e) {
      // Ignore
    }
  }
  const toolTag = hasTool ? 'existing_tool_underused' : 'no_tool_gap';

  return { revenue, monthlyLeak, annualLeak, breakdown, score, grade, rules, ratio, toolTag };
}


/**
 * Runs the detailed leakage calculation securely on the server side.
 * Hides all multipliers and mathematical formulas from F12 browser inspection.
 *
 * @param {Object} data The input data from the frontend.
 * @returns {Object} Clean calculated results.
 */
function calculateDetailedLeakage(data) {
  const niche = String(data.niche || '').trim().toLowerCase();
  const revenue = parseFloat(data.monthlyRevenue) || 0;
  const inputs = data.calculationInputs || {};
  const googleRating = parseFloat(data.googleRating) || 0;
  const googleReviews = parseInt(data.googleReviews) || 0;
  const googleReviewRange = data.googleReviewRange || 'low';
  const platforms = data.platforms || [];
  
  const cm = 0.6; // Conservative multiplier
  
  // Helper to get inputs
  const g = (id) => {
    if (id === 'mrr') return revenue;
    if (id === 'fcost') return revenue * 0.35;
    if (id === 'res') return Math.round(revenue / 50);
    return parseFloat(inputs[id]) || 0;
  };
  
  const v = (id) => {
    return parseFloat(inputs[id]) || 0;
  };

  let r = [];
  if (niche === 'dental') {
    r = [
      { l: 'Appointment No-Show Loss', v: Math.max(0, g('slots') * (v('nshow_v') / 100) * g('aval') * 22 * cm), w: 'Empty appointment slots — industry avg no-show rate is 12%' },
      { l: 'Unscheduled Recall Patients', v: Math.max(0, g('recalls') * g('aval') * cm), w: 'Patients overdue for checkups who haven\'t been called back' },
      { l: 'New Patient Follow-Up Gap', v: Math.max(0, g('leads') * (1 - v('fup_v') / 100) * g('tval') * cm), w: 'Inquiries not followed up on properly' },
      { l: 'Staff Idle Time', v: Math.max(0, g('staff') * 4 * g('srate') * 4 * cm), w: 'Estimated wages during gaps between appointments' }
    ];
  } else if (niche === 'realestate') {
    r = [
      { l: 'Lead Follow-Up Gap', v: Math.max(0, g('leads') * (1 - v('fup_v') / 100) * g('comm') * (v('crate_v') / 100) * cm), w: 'Leads not followed up enough times' },
      { l: 'Portal Spend vs Returns', v: Math.max(0, (g('pfees') - g('pdeals') * g('comm')) * cm), w: 'Portal fees vs deals actually generated' },
      { l: 'Agent Admin Time', v: Math.max(0, g('agents') * v('ahrs_v') * g('arate') * 4 * cm), w: 'Time spent on admin instead of selling' }
    ];
  } else if (niche === 'healthcare') {
    r = [
      { l: 'Appointment No-Show Loss', v: Math.max(0, g('appts') * (v('nshow_v') / 100) * g('aval') * 22 * cm), w: 'Empty slots that can\'t be filled last minute' },
      { l: 'Insurance Claim Rejections', v: Math.max(0, g('claims') * (v('reject_v') / 100) * g('cval') * cm), w: 'Claims denied — revenue earned but not collected' },
      { l: 'Referral No-Conversion', v: Math.max(0, g('refs') * (1 - v('rconv_v') / 100) * g('pval') * cm), w: 'Referrals received that never booked' }
    ];
  } else if (niche === 'legal') {
    r = [
      { l: 'Unbilled Attorney Hours', v: Math.max(0, g('att') * v('unbill_v') * g('brate') * 4 * cm), w: 'Work done but never invoiced' },
      { l: 'Consultation No-Convert', v: Math.max(0, g('cons') * (1 - v('cconv_v') / 100) * g('casev') * cm), w: 'Consultations that didn\'t turn into cases' },
      { l: 'Attorney Admin Time', v: Math.max(0, g('att') * v('admin_v') * g('brate') * 4 * cm), w: 'Billable attorneys doing admin work' }
    ];
  } else if (niche === 'saas') {
    r = [
      { l: 'Monthly Churn Loss', v: Math.max(0, g('mrr') * (v('churn_v') / 100) * cm), w: 'Recurring revenue lost to cancellations' },
      { l: 'Trial No-Convert Loss', v: Math.max(0, g('trials') * (1 - v('tconv_v') / 100) * g('dval') * cm), w: 'Trials that never became paying customers' }
    ];
  } else if (niche === 'restaurant') {
    r = [
      { l: 'Food Waste', v: Math.max(0, g('fcost') * (v('waste_v') / 100) * cm), w: 'Food purchased but thrown away' },
      { l: 'No-Show & Cancellation Loss', v: Math.max(0, g('res') * (v('nshow_v') / 100) * g('covers') * g('spend') * 30 * cm), w: 'Reserved tables that sat empty' }
    ];
  } else {
    r = [
      { l: 'Lead Follow-Up Gap', v: Math.max(0, g('leads') * (1 - v('fup_v') / 100) * g('tval') * cm), w: 'Inquiries not followed up on properly' },
      { l: 'Administrative Time Waste', v: Math.max(0, g('staff') * v('admin_v') * g('srate') * 4 * cm), w: 'Wages spent on manual admin tasks instead of growth' }
    ];
  }

  // Filter items
  let items = r.filter(item => item.v >= 1);

  // Reputation Loss
  if (googleRating > 0 && googleRating < 4.0) {
    const loss = revenue * (googleRating < 3.5 ? 0.15 : 0.08);
    items.push({ l: 'Reputation Impact — Low Google Rating', v: loss, w: 'Potential customers choosing higher-rated competitors' });
  }
  if (googleRating === 0) {
    items.push({ l: 'Not Listed on Google', v: revenue * 0.10, w: 'Missing from local search — customers can\'t find you' });
  }
  
  if (googleReviewRange === 'none') {
    items.push({ l: 'No Google Reviews', v: revenue * 0.10, w: 'Zero reviews — customers have no social proof to trust your business' });
  } else if (googleReviewRange === 'low') {
    items.push({ l: 'Low Review Volume (Under 30)', v: revenue * 0.06, w: 'Fewer reviews means less trust — customers choose competitors with more' });
  } else if (googleReviewRange === 'mid') {
    items.push({ l: 'Growing Review Volume (30–100)', v: revenue * 0.02, w: 'Decent but below the trust threshold of top local businesses' });
  }

  // Platforms Loss
  platforms.forEach(p => {
    const cost = parseFloat(p.cost) || 0;
    if (cost > 0) {
      items.push({ l: p.name + ' Commission & Fees', v: cost, w: 'Monthly cost of using ' + p.name });
    }
  });

  // Sort
  items.sort((a, b) => b.v - a.v);

  const total = items.reduce((sum, item) => sum + item.v, 0);

  return {
    success: true,
    total: Math.round(total),
    items: items.map(item => ({ l: item.l, v: Math.round(item.v), w: item.w }))
  };
}