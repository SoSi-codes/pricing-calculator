/**
 * engine.js — APO Pricing & Investment Calculator
 *
 * Formula evaluation, recalculation, cycle detection, formatting,
 * deterministic analysis rules, SWOT assembly, LLM prompt + client,
 * and import/export utilities.
 *
 * SECURITY NOTE: evaluateExpression uses new Function(). This is acceptable
 * for a trusted internal tool where the user writes their own formulas.
 * It is NOT acceptable if models are shared between users or the app is
 * exposed externally. See README for the safe replacement path.
 */

// ─── Expression evaluation ───────────────────────────────────────────────────

/**
 * Evaluate a formula string against a value map.
 * Supported functions: IF, MIN, MAX, ROUND, ABS, SUM
 * Supported operators: + - * / ( ) == != < > <= >=
 */
export function evaluateExpression(formula, values) {
  if (typeof formula !== 'string') return formula;

  // Replace function names with safe JS equivalents
  let expr = formula
    .replace(/\bIF\s*\(/gi, '_IF(')
    .replace(/\bMIN\s*\(/gi, 'Math.min(')
    .replace(/\bMAX\s*\(/gi, 'Math.max(')
    .replace(/\bROUND\s*\(/gi, '_ROUND(')
    .replace(/\bABS\s*\(/gi, 'Math.abs(')
    .replace(/\bSUM\s*\(/gi, '_SUM(');

  // Build argument list from the values map
  const argNames = Object.keys(values);
  const argValues = argNames.map(k => values[k]);

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      ...argNames,
      '_IF', '_ROUND', '_SUM',
      `"use strict"; return (${expr});`,
    );
    return fn(
      ...argValues,
      (cond, t, f) => (cond ? t : f),
      (v, d = 0) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d),
      (...args) => args.reduce((s, v) => s + (Number(v) || 0), 0),
    );
  } catch {
    return NaN;
  }
}

// ─── Recalculation ───────────────────────────────────────────────────────────

const MAX_PASSES = 50;
const CONVERGENCE_EPSILON = 1e-9;

/**
 * Recalculate all derived rows iteratively until values stabilise.
 * Returns { values, cycles } where cycles is an array of cycle descriptions.
 */
export function recalculate(rows, overrides = {}) {
  // Seed values: inputs and constants use their value (or override); derived start at 0
  const values = {};
  for (const row of rows) {
    if (row.kind === 'heading') continue;
    if (overrides[row.id] !== undefined) {
      values[row.id] = Number(overrides[row.id]);
    } else if (row.kind !== 'derived') {
      values[row.id] = Number(row.value ?? 0);
    } else {
      values[row.id] = 0;
    }
  }

  let changed = true;
  let pass = 0;

  while (changed && pass < MAX_PASSES) {
    changed = false;
    pass++;
    for (const row of rows) {
      if (row.kind !== 'derived' || !row.formula) continue;
      if (overrides[row.id] !== undefined) {
        values[row.id] = Number(overrides[row.id]);
        continue;
      }
      const prev = values[row.id];
      const next = evaluateExpression(row.formula, values);
      const nextNum = Number.isFinite(next) ? next : NaN;
      if (Math.abs((nextNum || 0) - (prev || 0)) > CONVERGENCE_EPSILON) {
        changed = true;
      }
      values[row.id] = nextNum;
    }
  }

  const cycles = pass >= MAX_PASSES ? detectCycles(rows) : [];

  // Build per-row error map (NaN rows get an error string)
  const errors = {};
  for (const row of rows) {
    if (row.kind === 'derived' && !Number.isFinite(values[row.id])) {
      errors[row.id] = 'formula error';
    }
  }

  return { values, errors, cycles };
}

/**
 * Detect cycles by checking which derived rows still change after MAX_PASSES.
 */
function detectCycles(rows) {
  const deps = {};
  for (const row of rows) {
    if (row.formula) {
      deps[row.id] = rows
        .filter(r => row.formula.includes(r.id))
        .map(r => r.id);
    }
  }

  // Simple DFS cycle detection
  const visiting = new Set();
  const visited = new Set();
  const cycles = [];

  function dfs(id, path) {
    if (visiting.has(id)) {
      const cycleStart = path.indexOf(id);
      cycles.push(path.slice(cycleStart).join(' → ') + ' → ' + id);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of (deps[id] || [])) {
      dfs(dep, [...path, id]);
    }
    visiting.delete(id);
    visited.add(id);
  }

  for (const row of rows) {
    if (row.formula) dfs(row.id, []);
  }

  return [...new Set(cycles)];
}

// ─── Dependency graph ────────────────────────────────────────────────────────

/** Return ids of all rows that row.id directly depends on. */
export function getDependencies(rowId, rows) {
  const row = rows.find(r => r.id === rowId);
  if (!row?.formula) return [];
  return rows.filter(r => r.id !== rowId && row.formula.includes(r.id)).map(r => r.id);
}

/** Return ids of all rows that transitively depend on rowId. */
export function getTransitiveDependents(rowId, rows) {
  const result = new Set();
  const queue = [rowId];
  while (queue.length) {
    const id = queue.shift();
    for (const row of rows) {
      if (row.formula?.includes(id) && row.id !== id && !result.has(row.id)) {
        result.add(row.id);
        queue.push(row.id);
      }
    }
  }
  return [...result];
}

/** Human-readable formula: replace ids with their labels. */
export function humanFormula(formula, rows) {
  if (!formula) return '';
  let f = formula;
  // Sort by id length descending to avoid partial replacements
  const sorted = [...rows].sort((a, b) => b.id.length - a.id.length);
  for (const row of sorted) {
    f = f.replace(new RegExp('\\b' + row.id + '\\b', 'g'), `[${row.label}]`);
  }
  return f;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export function formatValue(value, format) {
  if (value === undefined || value === null || (typeof value === 'number' && !Number.isFinite(value))) {
    return '—';
  }
  const v = Number(value);
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0,
      }).format(v);
    case 'currency2':
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
      }).format(v);
    case 'percent':
      return (v * 100).toFixed(1) + '%';
    case 'months':
      return v.toFixed(1) + ' mo';
    case 'hours':
      return v.toFixed(1) + ' hrs';
    case 'ratio':
      return v.toFixed(2) + 'x';
    case 'integer':
      return Math.round(v).toLocaleString('en-US');
    case 'number':
    default:
      return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(2);
  }
}

// ─── Deterministic analysis rules ───────────────────────────────────────────

/**
 * Run all deterministic rules against the current model state.
 * Returns an array of finding objects: { id, severity, title, body }
 * severity: 'critical' | 'warning' | 'info'
 */
export function runAnalysis(rows, values) {
  const findings = [];
  const v = id => values[id] ?? 0;
  const row = id => rows.find(r => r.id === id);

  const placeholders = rows.filter(r =>
    r.confidence === 'placeholder' && r.kind !== 'heading'
  );

  // ── R1: Placeholder count ────────────────────────────────────────────────
  if (placeholders.length > 0) {
    findings.push({
      id: 'R1',
      severity: 'critical',
      title: `${placeholders.length} unsourced placeholder${placeholders.length > 1 ? 's' : ''} remain`,
      body: `The model cannot be described as funding-grade while unsourced placeholders drive material calculations. Affected rows: ${placeholders.map(r => r.label).join('; ')}.`,
    });
  }

  // ── R2: Price below cost-derived floor ──────────────────────────────────
  const priceFloor = v('e_price_floor');
  const price = v('e_price');
  const targetMarg = v('e_target_gp');
  if (Number.isFinite(priceFloor) && price < priceFloor) {
    findings.push({
      id: 'R2',
      severity: 'critical',
      title: 'Price is below the cost-derived floor',
      body: `At ${formatValue(price, 'currency')}/yr the ${formatValue(targetMarg, 'percent')} target margin is arithmetically impossible. The minimum price required is ${formatValue(priceFloor, 'currency')}.`,
    });
  }

  // ── R3: Client-level gross margin below target ───────────────────────────
  const grossMargPct = v('e_gp_client');
  if (Number.isFinite(grossMargPct) && grossMargPct < targetMarg) {
    findings.push({
      id: 'R3',
      severity: 'critical',
      title: 'Gross margin per client is below the target',
      body: `Client-level gross margin is ${formatValue(grossMargPct, 'percent')} against the ${formatValue(targetMarg, 'percent')} target. The pricing or cost-to-serve assumptions must change.`,
    });
  }

  // ── R4: Margin after GTM negative ───────────────────────────────────────
  const margAfterGTM = v('g_gp_after_gtm');
  if (Number.isFinite(margAfterGTM) && margAfterGTM < 0) {
    findings.push({
      id: 'R4',
      severity: 'critical',
      title: 'Gross profit after GTM is negative',
      body: `After subtracting total acquisition cost (${formatValue(v('f_cac_total'), 'currency')}) from gross profit, the model is loss-making at the target client count. The business model loses money even before recovering the build.`,
    });
  }

  // ── R5: Margin after GTM below target ────────────────────────────────────
  const margAfterGTMPct = v('g_margin_after_gtm');
  if (Number.isFinite(margAfterGTMPct) && margAfterGTMPct >= 0 && margAfterGTMPct < targetMarg) {
    findings.push({
      id: 'R5',
      severity: 'warning',
      title: 'Margin after GTM is below the target',
      body: `After acquisition costs, blended margin falls to ${formatValue(margAfterGTMPct, 'percent')} — below the ${formatValue(targetMarg, 'percent')} target. The client-level gross margin cannot be quoted without this deduction.`,
    });
  }

  // ── R6: Scaling factor at 1.0 ───────────────────────────────────────────
  if (v('d_scaling') === 1.0) {
    findings.push({
      id: 'R6',
      severity: 'warning',
      title: 'Operational scaling factor left at 1.0 (linear — optimistic)',
      body: 'The review specifically flagged understated scaling costs. A multiplier of 1.0 assumes operational complexity grows linearly with client count. Stress-test at 1.3–1.5 for a pessimistic case at ten clients.',
    });
  }

  // ── R7: Business model mismatch ─────────────────────────────────────────
  const deliveryPm = v('d_delivery_pm');
  if (deliveryPm >= 2 && grossMargPct >= targetMarg) {
    findings.push({
      id: 'R7',
      severity: 'warning',
      title: 'Services-heavy delivery dial combined with software margin target',
      body: `The delivery model dial is set to ${deliveryPm.toFixed(1)} person-months of bundled delivery per client per year, yet the gross margin target appears met. This combination requires either an unusually high price or an understated cost-to-serve. Verify.`,
    });
  }

  // ── R8: LTV:CAC below 3:1 ────────────────────────────────────────────────
  const ltvCac = v('f_ltv_cac');
  if (Number.isFinite(ltvCac) && ltvCac < 3) {
    findings.push({
      id: 'R8',
      severity: 'critical',
      title: `LTV:CAC ratio is ${ltvCac.toFixed(2)}:1 (threshold: 3:1)`,
      body: 'Below 3:1 the business is buying revenue at an unsustainable price. Either loaded CAC must fall, or lifetime value (price × margin × retention) must rise.',
    });
  }

  // ── R9: Build payback vs timing window ──────────────────────────────────
  const buildPayback = v('g_payback_mo');
  const revWindow = v('i_window_mo');
  if (Number.isFinite(buildPayback) && buildPayback > 0 && buildPayback > revWindow * 3) {
    findings.push({
      id: 'R9',
      severity: 'critical',
      title: `Build payback (${formatValue(buildPayback, 'months')}) is very long relative to the revenue window`,
      body: `At the modelled run-rate, the build costs are not recovered within three revenue measurement windows. Reduce build cost, increase post-GTM margin, or reset expectations on the return horizon.`,
    });
  }

  // ── R10: Sellable months — timing crunch ─────────────────────────────────
  const sellable = v('i_sellable_months');
  const salesCycle = v('f_cycle_mo');
  if (Number.isFinite(sellable) && Number.isFinite(salesCycle)) {
    if (sellable <= 0) {
      findings.push({
        id: 'R10',
        severity: 'critical',
        title: 'No sellable months remain inside the revenue window',
        body: `Build duration (${formatValue(v('b_months'), 'months')}) equals or exceeds the ${formatValue(revWindow, 'months')} revenue measurement window. Year-one revenue is arithmetically unreachable without selling before the product exists.`,
      });
    } else if (sellable < salesCycle * 2) {
      findings.push({
        id: 'R10',
        severity: 'warning',
        title: 'Short selling window relative to sales cycle',
        body: `Only ${formatValue(sellable, 'months')} remain in the window after build. With a ${formatValue(salesCycle, 'months')} sales cycle, fewer than two deal cycles fit — the revenue target requires closing deals that must be started before the product is finished.`,
      });
    }
  }

  // ── R11: Deals closable after full cycle ─────────────────────────────────
  const dealsClosable = v('i_deals_closable');
  if (Number.isFinite(dealsClosable) && dealsClosable <= 0) {
    findings.push({
      id: 'R11',
      severity: 'critical',
      title: 'No time remains after build + one sales cycle',
      body: 'Any deal started after the product exists cannot close inside the measurement window. Selling must begin before the sellable release — which changes what must be true today about the pipeline.',
    });
  }

  // ── R12: Capital at risk (net) ───────────────────────────────────────────
  const netAtRisk = v('h_net_at_risk');
  findings.push({
    id: 'R12',
    severity: 'info',
    title: `Net capital at risk after client funding: ${formatValue(netAtRisk, 'currency')}`,
    body: `At the modelled ${formatValue(v('h_client_funded_pct'), 'percent')} client-funding share, ${formatValue(netAtRisk, 'currency')} is the downside exposure if the product fails to find clients. The full build cost is ${formatValue(v('b_total'), 'currency')}.`,
  });

  // ── R13: Obsolescence risk ───────────────────────────────────────────────
  findings.push({
    id: 'R13',
    severity: 'info',
    title: 'Obsolescence risk not quantified',
    body: `The model has no cell capturing the risk that the market moves during the ${formatValue(v('b_months'), 'months')} build window. A time-to-market discount on year-one revenue would be the honest next step.`,
  });

  // ── R14: Single-client dependency ───────────────────────────────────────
  const clientsNeeded = v('e_clients');
  if (clientsNeeded <= 1.5) {
    findings.push({
      id: 'R14',
      severity: 'warning',
      title: `Revenue target requires only ${clientsNeeded.toFixed(1)} clients — single-client concentration risk`,
      body: `At ${formatValue(price, 'currency')} per client a single client accounts for most or all of the revenue target. Loss of one client would be catastrophic. Diversification or a lower price-point with more clients should be modelled.`,
    });
  }

  // ── R15: Model review approval gate (services cost shape) ────────────────
  if (v('d_review_hrs_qtr') > 0) {
    findings.push({
      id: 'R15',
      severity: 'info',
      title: 'Manual model approval gate creates a services cost shape',
      body: `The architecture requires ${v('d_review_hrs_qtr').toFixed(0)} hours/quarter per client for human review and approval of model refreshes. This is a permanent per-client labour cost that persists regardless of client count — inconsistent with the software margin target unless the gate is later automated.`,
    });
  }

  return findings;
}

// ─── SWOT ────────────────────────────────────────────────────────────────────

export function buildSWOT(rows, values, findings) {
  const v = id => values[id] ?? 0;
  const hasCritical = findings.some(f => f.severity === 'critical');

  return {
    strengths: [
      v('e_gp_client') >= v('e_target_gp')
        ? `Client-level gross margin of ${formatValue(v('e_gp_client'), 'percent')} meets the ${formatValue(v('e_target_gp'), 'percent')} target.`
        : null,
      v('f_ltv_cac') >= 3
        ? `LTV:CAC ratio of ${v('f_ltv_cac').toFixed(1)}:1 meets the 3:1 threshold.`
        : null,
      v('g_margin_after_gtm') >= v('e_target_gp')
        ? `Margin after GTM of ${formatValue(v('g_margin_after_gtm'), 'percent')} meets the target — acquisition costs do not break the model.`
        : null,
      v('h_client_funded_pct') >= 0.5
        ? `${formatValue(v('h_client_funded_pct'), 'percent')} of build is client-funded — significantly reducing capital at risk.`
        : null,
    ].filter(Boolean),

    weaknesses: [
      hasCritical ? 'Model has critical findings that block a funding-grade designation.' : null,
      rows.filter(r => r.confidence === 'placeholder').length > 0
        ? `${rows.filter(r => r.confidence === 'placeholder').length} placeholder inputs drive material calculations.`
        : null,
      v('d_scaling') === 1.0 ? 'Operational scaling factor is linear — known optimistic assumption.' : null,
      v('g_gp_after_gtm') < 0 ? 'Gross profit after GTM is negative — acquisition economics are broken at target volume.' : null,
      v('d_delivery_pm') === 0
        ? 'Delivery model dial is at 0 (pure software). This is the most optimistic configuration — argue why it is defensible.'
        : null,
    ].filter(Boolean),

    opportunities: [
      v('d_onboard_billed_separately') === 0
        ? 'Onboarding billed separately (switch d_onboard_billed_separately to 1) would reduce cost-to-serve and improve margin.'
        : 'Onboarding is currently billed separately — protecting subscription margin. Maintain this as the commercial position.',
      v('d_delivery_pm') > 0
        ? 'Reducing bundled delivery (d_delivery_pm dial) would improve margin at the cost of a weaker value proposition.'
        : null,
      'Replacing placeholder rate card inputs with verified band rates will either confirm or sharply move the build cost.',
      'A paid Stage 0 readiness engagement could produce both validation data and a reference customer before any build commitment.',
    ].filter(Boolean),

    threats: [
      v('i_sellable_months') <= 0 ? 'No sellable months in the window — year-one revenue target is arithmetically unreachable.' : null,
      v('i_deals_closable') <= 0 ? 'Build + one sales cycle consumes the entire window — selling must begin before launch.' : null,
      v('f_ltv_cac') < 3 ? 'LTV:CAC below 3:1 — acquisition model structurally unsound at current assumptions.' : null,
      'Obsolescence risk: the market for MMM tooling is active. Build duration creates exposure to a competitor shipping first.',
      'Key-person risk: the engine owner is the sole builder and sole committer. Loss of this person stops the project.',
      v('d_delivery_pm') >= 2 ? 'Bundled services delivery creates margin ceiling inconsistent with the 70% software GP target.' : null,
    ].filter(Boolean),
  };
}

// ─── LLM prompt ─────────────────────────────────────────────────────────────

export function buildAnalysisPrompt(rows, values, findings, swot) {
  const modelSnapshot = rows
    .filter(r => r.kind !== 'heading')
    .map(r => ({
      id: r.id,
      label: r.label,
      value: formatValue(values[r.id], r.format),
      confidence: r.confidence,
      formula: r.formula || null,
    }));

  return `You are a senior IBM finance and strategy reviewer assessing an internal investment case.

Below is the full model state, followed by deterministic findings that have already been calculated. Your role is to provide narrative analysis — do NOT contradict the deterministic findings.

## DETERMINISTIC FINDINGS (authoritative — do not contradict)
${findings.map(f => `[${f.severity.toUpperCase()}] ${f.title}: ${f.body}`).join('\n')}

## MODEL STATE
${JSON.stringify(modelSnapshot, null, 2)}

## SWOT SUMMARY
Strengths: ${swot.strengths.join('; ')}
Weaknesses: ${swot.weaknesses.join('; ')}
Opportunities: ${swot.opportunities.join('; ')}
Threats: ${swot.threats.join('; ')}

## YOUR TASK
Respond with a JSON object matching this exact schema (no markdown fences, raw JSON only):
{
  "verdict": "PASS | CONDITIONAL | FAIL",
  "headline": "One sentence (≤ 25 words) summarising the investment case strength",
  "narrative": "3–5 paragraph narrative analysis. Be direct. Name specific numbers. Explain the central tension.",
  "top_risks": ["risk 1", "risk 2", "risk 3"],
  "recommended_actions": ["action 1", "action 2", "action 3"],
  "confidence_in_model": "HIGH | MEDIUM | LOW",
  "confidence_rationale": "One sentence explaining confidence level"
}

Rules:
- verdict is FAIL if any CRITICAL finding exists
- verdict is CONDITIONAL if WARNINGS exist but no CRITICAL findings  
- verdict is PASS only if no CRITICAL or WARNING findings exist
- Do not invent numbers not in the model state
- Temperature is set low — be precise, not fluent`;
}

/**
 * Call a chat-completions-shaped endpoint.
 * NEVER pass an API key from the client. Use a server-side proxy.
 */
export async function analyseWithLLM(prompt, endpoint, modelId) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM endpoint returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? '';

  try {
    return JSON.parse(content);
  } catch {
    // Graceful degradation — put raw text in verdict
    return {
      verdict: 'UNKNOWN',
      headline: 'LLM returned unstructured response',
      narrative: content,
      top_risks: [],
      recommended_actions: [],
      confidence_in_model: 'LOW',
      confidence_rationale: 'Response was not valid JSON.',
    };
  }
}

// ─── Import / Export ─────────────────────────────────────────────────────────

export function exportModel(rows, overrides) {
  return JSON.stringify({ rows, overrides }, null, 2);
}

export function importModel(jsonString) {
  const parsed = JSON.parse(jsonString);
  if (!Array.isArray(parsed.rows)) throw new Error('Invalid model: missing rows array');
  return {
    rows: parsed.rows,
    overrides: parsed.overrides ?? {},
  };
}

// ─── Compatibility aliases & additions ───────────────────────────────────────
// These names are used by App.jsx. The originals are kept intact above.

/** buildSwot — alias for buildSWOT, accepting (rows, values, findings) */
export function buildSwot(rows, values, findings) {
  return buildSWOT(rows, values, findings);
}

/** humaniseFormula — alias for humanFormula */
export { humanFormula as humaniseFormula };

/**
 * extractDependencies — returns row ids that appear in a formula string,
 * filtered to known ids.
 * @param {string} formula
 * @param {Set<string>} knownIds
 */
export function extractDependencies(formula, knownIds) {
  if (!formula) return [];
  return [...knownIds].filter(id => new RegExp('\\b' + id + '\\b').test(formula));
}

/**
 * dependentsOf — transitive dependents of rowId across the row array.
 * Alias of getTransitiveDependents with the same signature.
 */
export { getTransitiveDependents as dependentsOf };

/**
 * serialiseModel — alias for exportModel; accepts optional metadata param.
 */
export function serialiseModel(rows, overrides, meta = {}) {
  return JSON.stringify({ ...meta, rows, overrides }, null, 2);
}

/**
 * deserialiseModel — alias for importModel.
 */
export { importModel as deserialiseModel };

/**
 * toCSV — produce a flat CSV of all rows with their current values.
 * @param {Array} rows
 * @param {Object} values
 * @param {Object} formats  — the FORMATS map from model.js
 */
export function toCSV(rows, values, formats) {
  const header = ['id', 'section', 'label', 'kind', 'confidence', 'value', 'formula'];
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    header.join(','),
    ...rows.map(r => [
      escape(r.id),
      escape(r.section),
      escape(r.label),
      escape(r.kind),
      escape(r.confidence),
      escape(formatValue(values[r.id], r.format)),
      escape(r.formula ?? ''),
    ].join(',')),
  ];
  return lines.join('\n');
}
