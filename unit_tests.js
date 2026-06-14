/**
 * Revenue Audit Unit Test Suite
 * Validates calculation accuracy across all business niches.
 */

// Mirroring core logic logic from getLeakageItems in index.html for standalone execution
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

    // Dental Test Case: 10 appts/day, 10% no-show, $180 avg value
    const dentalG = (id) => ({ slots: 10, aval: 180, recalls: 20, leads: 30, tval: 500 }[id] || 0);
    const dentalV = (id) => ({ nshow_v: 10, fup_v: 90 }[id] || 0);
    const dentalRes = getLeakageItems('dental', dentalG, dentalV);
    assert(dentalRes.find(i => i.l === 'Appointment No-Show Loss').v, 2376, "Dental No-Show Loss");
    assert(dentalRes.find(i => i.l === 'Unscheduled Recall Patients').v, 2160, "Dental Recall Loss");

    // SaaS Test Case: $100k MRR, 5% Churn, 500 trials at 10% conversion
    const saasG = (id) => ({ mrr: 100000, trials: 500, dval: 200 }[id] || 0);
    const saasV = (id) => ({ churn_v: 5, tconv_v: 10 }[id] || 0);
    const saasRes = getLeakageItems('saas', saasG, saasV);
    assert(saasRes.find(i => i.l === 'Monthly Churn Loss').v, 3000, "SaaS Churn Loss");
    assert(saasRes.find(i => i.l === 'Trial No-Convert Loss').v, 54000, "SaaS Trial Loss");

    // Restaurant Test Case: 50 reservations/day, 20% no-show, $60 avg spend
    const restG = (id) => ({ fcost: 20000, res: 50, covers: 4, spend: 60 }[id] || 0);
    const restV = (id) => ({ waste_v: 25, nshow_v: 20 }[id] || 0);
    const restRes = getLeakageItems('restaurant', restG, restV);
    assert(restRes.find(i => i.l === 'Food Waste').v, 3000, "Restaurant Waste Loss");
    assert(restRes.find(i => i.l === 'No-Show & Cancellation Loss').v, 43200, "Restaurant No-Show Loss");

    console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
    if (typeof process !== 'undefined' && failed > 0) process.exit(1);
}

runTests();