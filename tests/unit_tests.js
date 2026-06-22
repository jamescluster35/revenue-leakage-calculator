/**
 * Revenue Audit Unit Test Suite
 * Validates calculation accuracy across all business niches.
 */

// Mirroring core logic from getLeakageItems in index.html for standalone execution
function getLeakageItems(n, g, v) {
    var r = [];
    var cm = 0.6;
    if (n === 'dental') {
        r = [
            { l: 'Appointment No-Show Loss', v: Math.max(0, g('slots') * (v('nshow_v') / 100) * g('aval') * 22 * cm) },
            { l: 'Unscheduled Recall Patients', v: Math.max(0, g('recalls') * g('aval') * cm) },
            { l: 'New Patient Follow-Up Gap', v: Math.max(0, g('leads') * (1 - v('fup_v') / 100) * g('tval') * cm) },
            { l: 'Staff Idle Time', v: Math.max(0, g('staff') * 4 * g('srate') * 4 * cm) },
        ];
    } else if (n === 'realestate') {
        r = [
            { l: 'Lead Follow-Up Gap', v: Math.max(0, g('leads') * (1 - v('fup_v') / 100) * g('comm') * (v('crate_v') / 100) * cm) },
            { l: 'Portal Spend vs Returns', v: Math.max(0, (g('pfees') - g('pdeals') * g('comm')) * cm) },
            { l: 'Agent Admin Time', v: Math.max(0, g('agents') * v('ahrs_v') * g('arate') * 4 * cm) },
        ];
    } else if (n === 'healthcare') {
        r = [
            { l: 'Appointment No-Show Loss', v: Math.max(0, g('appts') * (v('nshow_v') / 100) * g('aval') * 22 * cm) },
            { l: 'Insurance Claim Rejections', v: Math.max(0, g('claims') * (v('reject_v') / 100) * g('cval') * cm) },
            { l: 'Referral No-Conversion', v: Math.max(0, g('refs') * (1 - v('rconv_v') / 100) * g('pval') * cm) },
        ];
    } else if (n === 'legal') {
        r = [
            { l: 'Unbilled Attorney Hours', v: Math.max(0, g('att') * v('unbill_v') * g('brate') * 4 * cm) },
            { l: 'Consultation No-Convert', v: Math.max(0, g('cons') * (1 - v('cconv_v') / 100) * g('casev') * cm) },
            { l: 'Attorney Admin Time', v: Math.max(0, g('att') * v('admin_v') * g('brate') * 4 * cm) },
        ];
    } else if (n === 'saas') {
        r = [
            { l: 'Monthly Churn Loss', v: Math.max(0, g('mrr') * (v('churn_v') / 100) * cm) },
            { l: 'Trial No-Convert Loss', v: Math.max(0, g('trials') * (1 - v('tconv_v') / 100) * g('dval') * cm) },
        ];
    } else if (n === 'restaurant') {
        r = [
            { l: 'Food Waste', v: Math.max(0, g('fcost') * (v('waste_v') / 100) * cm) },
            { l: 'No-Show & Cancellation Loss', v: Math.max(0, g('res') * (v('nshow_v') / 100) * g('covers') * g('spend') * 30 * cm) },
        ];
    } else if (n === 'general') {
        r = [
            { l: 'Lead Follow-Up Gap', v: Math.max(0, g('leads') * (1 - v('fup_v') / 100) * g('tval') * cm) },
            { l: 'Administrative Time Waste', v: Math.max(0, g('staff') * v('admin_v') * g('srate') * 4 * cm) },
        ];
    }
    return r.filter(function (i) { return i.v >= 1; });
}

function runTests() {
    console.log("--- Starting Revenue Audit Calculator Tests ---");
    let passed = 0; let failed = 0;

    const assert = (actual, expected, name) => {
        const a = Math.round(actual); const e = Math.round(expected);
        if (a === e) { console.log("✅ PASS:", name); passed++; }
        else { console.error("❌ FAIL:", name, `Expected ${e}, got ${a}`); failed++; }
    };

    // Dental Test Case
    const dentalG = (id) => ({ slots: 10, aval: 180, recalls: 20, leads: 30, tval: 500 }[id] || 0);
    const dentalV = (id) => ({ nshow_v: 10, fup_v: 90 }[id] || 0);
    const dentalRes = getLeakageItems('dental', dentalG, dentalV);
    assert(dentalRes.find(i => i.l === 'Appointment No-Show Loss').v, 2376, "Dental No-Show Loss");
    assert(dentalRes.find(i => i.l === 'Unscheduled Recall Patients').v, 2160, "Dental Recall Loss");

    // Real Estate Test Case
    const reG = (id) => ({ leads: 100, comm: 8000, pfees: 2000, pdeals: 1, agents: 10, arate: 75 }[id] || 0);
    const reV = (id) => ({ fup_v: 50, crate_v: 15, ahrs_v: 16 }[id] || 0);
    const reRes = getLeakageItems('realestate', reG, reV);
    assert(reRes.find(i => i.l === 'Lead Follow-Up Gap').v, 36000, "Real Estate Follow-Up Gap");
    assert(reRes.find(i => i.l === 'Agent Admin Time').v, 28800, "Real Estate Agent Admin Time");

    // Healthcare Test Case
    const hcG = (id) => ({ appts: 20, aval: 150, claims: 150, cval: 200, refs: 40, pval: 150 }[id] || 0);
    const hcV = (id) => ({ nshow_v: 20, reject_v: 15, rconv_v: 60 }[id] || 0);
    const hcRes = getLeakageItems('healthcare', hcG, hcV);
    assert(hcRes.find(i => i.l === 'Appointment No-Show Loss').v, 7920, "Healthcare No-Show Loss");
    assert(hcRes.find(i => i.l === 'Insurance Claim Rejections').v, 2700, "Healthcare Claim Rejections");

    // Legal Test Case
    const legalG = (id) => ({ att: 5, brate: 300, cons: 15, casev: 5000 }[id] || 0);
    const legalV = (id) => ({ unbill_v: 3, cconv_v: 55, admin_v: 3 }[id] || 0);
    const legalRes = getLeakageItems('legal', legalG, legalV);
    assert(legalRes.find(i => i.l === 'Unbilled Attorney Hours').v, 10800, "Legal Unbilled Hours");
    assert(legalRes.find(i => i.l === 'Consultation No-Convert').v, 20250, "Legal Consultation No-Convert");

    // SaaS Test Case
    const saasG = (id) => ({ mrr: 100000, trials: 500, dval: 200 }[id] || 0);
    const saasV = (id) => ({ churn_v: 5, tconv_v: 10 }[id] || 0);
    const saasRes = getLeakageItems('saas', saasG, saasV);
    assert(saasRes.find(i => i.l === 'Monthly Churn Loss').v, 3000, "SaaS Churn Loss");
    assert(saasRes.find(i => i.l === 'Trial No-Convert Loss').v, 54000, "SaaS Trial Loss");

    // Restaurant Test Case
    const restG = (id) => ({ fcost: 20000, res: 50, covers: 4, spend: 60 }[id] || 0);
    const restV = (id) => ({ waste_v: 25, nshow_v: 20 }[id] || 0);
    const restRes = getLeakageItems('restaurant', restG, restV);
    assert(restRes.find(i => i.l === 'Food Waste').v, 3000, "Restaurant Waste Loss");
    assert(restRes.find(i => i.l === 'No-Show & Cancellation Loss').v, 43200, "Restaurant No-Show Loss");

    // General Test Case
    const genG = (id) => ({ leads: 50, tval: 1000, staff: 5, srate: 25 }[id] || 0);
    const genV = (id) => ({ fup_v: 70, admin_v: 10 }[id] || 0);
    const genRes = getLeakageItems('general', genG, genV);
    assert(genRes.find(i => i.l === 'Lead Follow-Up Gap').v, 9000, "General Follow-Up Gap");
    assert(genRes.find(i => i.l === 'Administrative Time Waste').v, 3000, "General Admin Time Waste");

    console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
    if (typeof process !== 'undefined' && failed > 0) process.exit(1);
}

runTests();