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
      breakdown: ['Appointment no-shows', 'Uncollected copays/fees', 'Unused inventory and supplies'],
      plan90: [
        { week: '1-2', action: 'Audit scheduling', detail: 'Implement automated SMS/Email reminders at 48h and 2h. Target a no-show rate of <8% to recapture lost chair time.', priority: 'CRITICAL', quick: true, impact: '+$800/mo' },
        { week: '3-4', action: 'Reactivation Campaign', detail: 'Assign a coordinator to call 10 overdue patients daily using multi-channel reactivation scripts to book hygiene visits.', priority: 'HIGH', quick: false, impact: '+$1,200/mo' },
        { week: '5-8', action: 'Software Audit', detail: 'Consolidate redundant subscriptions (PMS, imaging, patient marketing) to recover immediate overhead and improve margins.', priority: 'MEDIUM', quick: true, impact: '+$300/mo' }
      ]
    },
    realestate: {
      // Benchmark estimate: ~8% of monthly revenue. Source: NAR annual report, portal ROI benchmarks.
      estimatePct: 0.08,
      breakdown: ['Missed lead follow-up', 'Low portal ROI', 'Inefficient offer conversion'],
      plan90: [
        { week: '1-2', action: '5-Touch Sequence', detail: 'Deploy a 7-touch follow-up system (Call/Text/Email). Industry data shows 80% of deals close between contact 5 and 12.', priority: 'CRITICAL', quick: true, impact: '+$2,500/mo' },
        { week: '3-4', action: 'Portal ROI Review', detail: 'Audit Portal GCI vs monthly spend. Reallocate budget from underperforming zip codes to high-intent lead sources.', priority: 'HIGH', quick: false, impact: '+$1,000/mo' },
        { week: '5-8', action: 'Standardize Outreach', detail: 'Create automated templates for open house visitors and referral partner check-ins to ensure no lead expires.', priority: 'MEDIUM', quick: false, impact: '+$1,500/mo' }
      ]
    }, 
    healthcare: {
      // Benchmark estimate: ~15% of monthly revenue. Source: MGMA claim denial studies, JAMA no-show data.
      estimatePct: 0.15,
      breakdown: ['Denied insurance claims', 'Patient no-shows', 'Underbilled services'],
      plan90: [
        { week: '1-2', action: 'Reminders & Claims', detail: 'Deploy 2-way SMS reminders and audit top 3 claim rejection codes for immediate resubmission and process change.', priority: 'CRITICAL', quick: true, impact: '+$1,100/mo' },
        { week: '3-4', action: 'Referral Sequence', detail: 'Contact all incoming referrals within 24 hours using warm scripts. Prompt callbacks increase booking rates by 40%.', priority: 'HIGH', quick: false, impact: '+$900/mo' },
        { week: '5-8', action: 'Staff Optimization', detail: 'Align clinical staff hours with historical patient volume to eliminate overtime and idle blocks during slow periods.', priority: 'MEDIUM', quick: false, impact: '+$600/mo' }
      ]
    }, 
    legal: {
      // Benchmark estimate: ~15% of monthly revenue. Source: Clio Legal Trends Report, ILTA billable hour data.
      estimatePct: 0.15,
      breakdown: ['Untracked billable hours', 'Low realization rates', 'Administrative delays'],
      plan90: [
        { week: '1-2', action: 'Time Capture', detail: 'Adopt daily contemporaneous time entry. Capturing just 15 more billable minutes a day adds $3k-$5k/mo per attorney.', priority: 'CRITICAL', quick: true, impact: '+$3,000/mo' },
        { week: '3-4', action: 'Task Delegation', detail: 'Move non-billable administrative and intake tasks to paralegals or VAs to maximize attorney realization rates.', priority: 'HIGH', quick: false, impact: '+$1,500/mo' },
        { week: '5-8', action: 'Pipeline Audit', detail: 'Review the Consult-to-Retained funnel. Implement follow-up calls at Day 3 and Day 7 for unsigned fee agreements.', priority: 'MEDIUM', quick: false, impact: '+$2,000/mo' }
      ]
    }, 
    saas: {
      // Benchmark estimate: ~10% of monthly revenue. Source: OpenView SaaS benchmarks, ChurnZero churn studies.
      estimatePct: 0.10,
      breakdown: ['Churn and downgrades', 'Failed payments', 'Weak onboarding flow'],
      plan90: [
        { week: '1-2', action: 'Churn Guard', detail: 'Segment users by last login. Trigger personal reach-out for "at-risk" accounts inactive for more than 14 days.', priority: 'CRITICAL', quick: false, impact: '+$1,500/mo' },
        { week: '3-4', action: 'Dunning Setup', detail: 'Automate failed payment recovery with a 3-step retry sequence (Day 0, 3, 7) before subscription suspension.', priority: 'HIGH', quick: true, impact: '+$800/mo' },
        { week: '5-8', action: 'Docs & Support', detail: 'Audit common support tickets and build a self-service knowledge base to reduce L1 ticket volume by 30%.', priority: 'MEDIUM', quick: false, impact: '+$500/mo' }
      ]
    }, 
    restaurant: {
      // Benchmark estimate: ~16% of monthly revenue. Source: USDA food waste estimates, Toast/National Restaurant Association data.
      estimatePct: 0.16,
      breakdown: ['No-shows and cancellations', 'Food and labour waste', 'High delivery fees'],
      plan90: [
        { week: '1-2', action: 'Reservation Fix', detail: 'Require SMS confirmation for all bookings. Implement a standard 24h cancellation policy to reduce empty table loss.', priority: 'CRITICAL', quick: true, impact: '+$1,200/mo' },
        { week: '3-4', action: 'Fee Analysis', detail: 'Analyze net profit per platform. Promote direct ordering via QR codes to recapture 25-30% delivery commissions.', priority: 'HIGH', quick: true, impact: '+$600/mo' },
        { week: '5-8', action: 'Menu Optimization', detail: 'Track food waste for 14 days. Engineer menus to focus on high-margin, low-waste ingredients and optimize prep.', priority: 'MEDIUM', quick: false, impact: '+$1,000/mo' }
      ]
    },
    general: {
      // Benchmark estimate: ~12% of monthly revenue. Source: McKinsey & HBR SMB operational efficiency research.
      estimatePct: 0.12,
      breakdown: ['Missed lead follow-up', 'Operational bottlenecks', 'Unoptimized service margins'],
      plan90: [
        { week: '1-2', action: 'Process Audit', detail: 'Map your end-to-end sales cycle and identify the single biggest manual bottleneck preventing faster closing cycles.', priority: 'CRITICAL', quick: true, impact: '+$500/mo' },
        { week: '3-4', action: 'Standardize Outreach', detail: 'Build a multi-channel lead follow-up sequence with at least 5 touches across Phone, Email, and LinkedIn.', priority: 'HIGH', quick: false, impact: '+$1,200/mo' },
        { week: '5-8', action: 'Margin Optimization', detail: 'Audit service delivery costs vs current pricing. Ensure all overhead is properly allocated to maintain target margins.', priority: 'MEDIUM', quick: false, impact: '+$800/mo' }
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

  return { revenue, monthlyLeak, annualLeak, breakdown, score, grade, rules, ratio };
}