/**
 * APO / Marketing & Media Optimization — Pricing & Investment Model
 *
 * Every row is a first-class object. Nothing is hardcoded in the UI.
 * Rows can be added, edited, reordered or deleted at runtime; formulas are
 * strings evaluated by engine.js against other rows' ids.
 *
 * confidence levels drive the provenance badge AND the analysis engine:
 *   'sourced'     — traceable to a named document or meeting
 *   'derived'     — computed from other rows, no independent assumption
 *   'assumption'  — a deliberate modelling choice, defensible but unverified
 *   'placeholder' — a number invented to make the model run. MUST be replaced.
 */

export const FORMATS = {
  currency:  { kind: 'currency', dp: 0 },
  currency2: { kind: 'currency', dp: 2 },
  percent:   { kind: 'percent',  dp: 1 },
  number:    { kind: 'number',   dp: 2 },
  integer:   { kind: 'number',   dp: 0 },
  months:    { kind: 'number',   dp: 1, suffix: ' mo' },
  hours:     { kind: 'number',   dp: 1, suffix: ' hrs' },
  ratio:     { kind: 'number',   dp: 2, suffix: 'x' },
};

export const SECTIONS = [
  { id: 'A', title: 'A · Rate card',                          blurb: 'Replace every placeholder here before this model is shown to anyone. Everything downstream flexes off these cells.' },
  { id: 'B', title: 'B · Bucket 1 — one-time build cost',      blurb: 'The $250,000 figure was offered as a floor to start from, not an estimate. This is the build-up.' },
  { id: 'C', title: 'C · Bucket 2 — fixed run cost',           blurb: 'Costs the same whether you serve one client or ten. Hurts most at low client counts.' },
  { id: 'D', title: 'D · Bucket 3 — marginal cost per client', blurb: '70% GP is a statement about the SHAPE of the cost curve, not its size. This is the only bucket that decides it.' },
  { id: 'E', title: 'E · Price, margin and volume',            blurb: 'The backwards math: price, target margin, how many clients do we need.' },
  { id: 'F', title: 'F · Go-to-market and acquisition',        blurb: 'Added after review feedback that CAC and GTM economics were missing. A margin that excludes the cost of winning the customer is not a real margin.' },
  { id: 'G', title: 'G · Economics after GTM',                 blurb: 'The margin that survives contact with the cost of selling. This is the number to defend.' },
  { id: 'H', title: 'H · Staged investment',                   blurb: 'Models the cautious staged path the review recommended over a full speculative build.' },
  { id: 'I', title: 'I · Timing',                              blurb: 'How much of the 12-month revenue window actually exists once build and hardening are done.' },
];

export const MODEL_ROWS = [
  // ─────────────────────────── A · RATE CARD ───────────────────────────
  { id: 'a_onshore', section: 'A', label: 'Onshore senior cost per FTE-month',
    value: 22000, format: 'currency', kind: 'input', confidence: 'placeholder',
    provenance: {
      what: 'Fully loaded internal cost of the engine owner for one month.',
      why: 'The engine owner is the largest single labour line in the build and the only onshore senior resource. Getting this wrong moves the build total more than any other input.',
      how: 'Currently invented. Should be the band-based internal cost rate finance publishes — not a market rate, not a bill rate.',
      source: 'PLACEHOLDER — no source. Owner: resource manager.' } },

  { id: 'a_delivery', section: 'A', label: 'Delivery-team blended cost per FTE-month',
    value: 7500, format: 'currency', kind: 'input', confidence: 'placeholder',
    provenance: {
      what: 'Blended fully loaded internal cost across the delivery team.',
      why: 'Applied across ~5.33 FTE for the whole build, so it is the second-largest lever in the model.',
      how: 'Reported as a blend of 1/3 Architect + 1 Band 6 Data Scientist + 1 Band 7 UI. KNOWN DEFECT: the build applies this same rate to a team that also contains a team lead and a Band 8 PM, and the architect is Band 9 — none of which the blend was built to price. Row b_cost_arch carries a partial correction; the proper fix is to split the team into per-band lines.',
      source: 'PLACEHOLDER — structure reported by PM; rates unverified. Owner: resource manager.' } },

  { id: 'a_band9', section: 'A', label: 'Band 9 Architect cost per FTE-month',
    value: 32000, format: 'currency', kind: 'input', confidence: 'placeholder',
    provenance: {
      what: 'Fully loaded internal cost for the Band 9 architect.',
      why: 'The blended delivery rate underprices a Band 9 role. Without a separate line the build cost is understated.',
      how: 'Invented at roughly 4.3x the blended rate to make the correction visible. Replace with the real band 9 rate.',
      source: 'PLACEHOLDER. Band confirmed; rate not sourced. Owner: resource manager.' } },

  { id: 'a_cal_days', section: 'A', label: 'Calendar days per year',
    value: 365, format: 'integer', kind: 'constant', confidence: 'sourced',
    provenance: { what: 'Days in a year.', why: 'Start of the productive-hours derivation.', how: 'Fixed.', source: 'Calendar.' } },

  { id: 'a_weekend', section: 'A', label: 'Less: weekend days',
    value: 104, format: 'integer', kind: 'constant', confidence: 'sourced',
    provenance: { what: '52 weeks x 2 days.', why: 'Not worked.', how: '52*2.', source: 'Calendar.' } },

  { id: 'a_holidays', section: 'A', label: 'Less: public holidays',
    value: 10, format: 'integer', kind: 'input', confidence: 'placeholder',
    provenance: { what: 'Public holidays per year.', why: 'Reduces available delivery capacity.', how: 'Assumed. Varies by delivery location.', source: 'PLACEHOLDER. Owner: HR.' } },

  { id: 'a_leave', section: 'A', label: 'Less: annual leave',
    value: 20, format: 'integer', kind: 'input', confidence: 'placeholder',
    provenance: { what: 'Annual leave entitlement in days.', why: 'Paid but not delivering.', how: 'Assumed. Varies by band and tenure.', source: 'PLACEHOLDER. Owner: HR.' } },

  { id: 'a_sick', section: 'A', label: 'Less: sick / other leave',
    value: 7, format: 'integer', kind: 'input', confidence: 'placeholder',
    provenance: { what: 'Unplanned absence.', why: 'Paid but not delivering.', how: 'Assumed.', source: 'PLACEHOLDER. Owner: HR.' } },

  { id: 'a_avail_days', section: 'A', label: '= Available working days',
    formula: 'a_cal_days - a_weekend - a_holidays - a_leave - a_sick',
    format: 'integer', kind: 'derived', confidence: 'derived',
    provenance: { what: 'Days a person is actually at work.', why: 'Bridge from calendar to capacity.', how: 'Calendar less weekends, holidays and leave.', source: 'Derived.' } },

  { id: 'a_hrs_day', section: 'A', label: 'Hours per working day',
    value: 8, format: 'integer', kind: 'input', confidence: 'assumption',
    provenance: { what: 'Standard working day.', why: 'Converts days to hours.', how: 'Standard.', source: 'Assumption.' } },

  { id: 'a_avail_hrs_mo', section: 'A', label: 'Available hours per month',
    formula: 'a_avail_days * a_hrs_day / 12', format: 'hours', kind: 'derived', confidence: 'derived',
    provenance: { what: 'Hours at work per month, after leave and holidays, before internal time.', why: 'Intermediate step.', how: 'Available days x hours per day / 12.', source: 'Derived.' } },

  { id: 'a_overhead', section: 'A', label: 'Non-delivery overhead',
    value: 0.12, format: 'percent', kind: 'input', confidence: 'assumption',
    provenance: {
      what: 'Share of time on internal meetings, training, admin and enablement.',
      why: 'Time that is paid for but produces no client-facing output. Excluding it overstates capacity and understates the hourly cost of delivered work.',
      how: 'Assumed 12%. Consulting utilisation targets of 80-85% imply 15-20%, so this sits at the optimistic end.',
      source: 'Assumption. Confirm against practice utilisation target.' } },

  { id: 'a_prod_hrs_mo', section: 'A', label: 'PRODUCTIVE hours per month',
    formula: 'a_avail_hrs_mo * (1 - a_overhead)', format: 'hours', kind: 'derived', confidence: 'derived',
    provenance: {
      what: 'Hours of actual delivered work per FTE per month.',
      why: 'The correct denominator for costing delivered work. A flat 160 was used originally; that assumes 40 hrs x exactly 4 weeks, but months average 4.33 weeks — so 160 is neither the paid-calendar figure (173.3) nor the productive figure (~131).',
      how: 'Available hours less non-delivery overhead.',
      source: 'Derived. Replaces the original flat 160 assumption.' } },

  { id: 'a_hourly', section: 'A', label: 'Delivery hourly rate',
    formula: 'a_delivery / a_prod_hrs_mo', format: 'currency2', kind: 'derived', confidence: 'derived',
    provenance: {
      what: 'Cost of one hour of delivered work from the blended delivery team.',
      why: 'Drives every per-client labour cost in Section D.',
      how: 'Monthly cost divided by productive hours per month. At placeholder rates this is ~$57/hr versus ~$47/hr on the old flat-160 basis — a 22% increase that moves cost-to-serve only ~7%, because per-client compute dominates.',
      source: 'Derived.' } },

  // ─────────────────────────── B · BUILD ───────────────────────────────
  { id: 'b_mvp_months', section: 'B', label: 'MVP build duration',
    value: 7.5, format: 'months', kind: 'input', confidence: 'sourced',
    provenance: { what: 'Months to a working MVP.', why: 'Drives all build labour and the timing section.', how: 'Midpoint of the stated 7-8 months.', source: 'Leadership 1:1, 2026-08-10.' } },

  { id: 'b_hard_months', section: 'B', label: 'Hardening to sellable release',
    value: 3, format: 'months', kind: 'input', confidence: 'assumption',
    provenance: {
      what: 'Additional months from MVP to something a client can actually run.',
      why: 'The 7-8 months buys an MVP, not a product. Omitting this understates build by roughly 30% and overstates how much of the revenue window exists.',
      how: 'Assumed. Covers replacing the test-grade database, security and permissions, rebuilding the tooling dependency on an approved platform, and packaging for client-infrastructure deployment.',
      source: 'Assumption, grounded in architecture walkthrough minutes, 2026-07-28.' } },

  { id: 'b_months', section: 'B', label: 'Total build duration',
    formula: 'b_mvp_months + b_hard_months', format: 'months', kind: 'derived', confidence: 'derived',
    provenance: { what: 'MVP plus hardening.', why: 'The period over which build labour accrues.', how: 'Sum.', source: 'Derived.' } },

  { id: 'b_doug_fte', section: 'B', label: 'Engine owner — FTE',
    value: 1.0, format: 'number', kind: 'input', confidence: 'sourced',
    provenance: { what: 'Engine owner full time.', why: 'Sole builder and sole committer; also the key-person risk.', how: 'Stated.', source: 'Architecture walkthrough minutes, 2026-07-28.' } },

  { id: 'b_team_fte', section: 'B', label: 'Delivery team — FTE',
    value: 5.33, format: 'number', kind: 'input', confidence: 'assumption',
    provenance: {
      what: 'Team lead + 2 developers + 0.5 UI + 0.5 PM + 0.33 architect.',
      why: 'The second-largest cost line.',
      how: 'Reflects the proposed reshape moving PM and UI to 50% shared capacity. Excludes the additional developer that reshape is meant to fund. KNOWN DEFECT: priced at a single blended rate that does not cover the team lead, the Band 8 PM, or the Band 9 architect.',
      source: 'Leadership 1:1, 2026-08-10.' } },

  { id: 'b_arch_fte', section: 'B', label: 'Band 9 architect — FTE',
    value: 0.33, format: 'number', kind: 'input', confidence: 'sourced',
    provenance: { what: 'Architect at one-third capacity.', why: 'Priced separately because the blended rate underprices Band 9.', how: 'Stated.', source: 'Leadership 1:1, 2026-08-10; band confirmed by PM.' } },

  { id: 'b_infra_mo', section: 'B', label: 'Infrastructure & compute during build',
    value: 8000, format: 'currency', kind: 'input', confidence: 'placeholder',
    provenance: { what: 'Monthly non-labour build cost.', why: 'Bayesian MCMC training is compute-heavy; also covers dev/prod environments and the IAC harness.', how: 'Invented.', source: 'PLACEHOLDER. Owner: lead architect.' } },

  { id: 'b_bob_rebuild', section: 'B', label: 'Tooling-dependency rebuild allowance',
    value: 40000, format: 'currency', kind: 'input', confidence: 'placeholder',
    provenance: {
      what: 'Allowance to rebuild engine components created with an external coding tool onto an approved platform.',
      why: 'The tool cannot yet be triggered from inside the enterprise environment and cannot be a permanent dependency of a shipped product.',
      how: 'Entirely invented — this scope has never been sized.',
      source: 'PLACEHOLDER. Risk raised in architecture walkthrough minutes. Owner: engine owner.' } },

  { id: 'b_cost_doug', section: 'B', label: 'Labour — engine owner',
    formula: 'b_doug_fte * a_onshore * b_months', format: 'currency', kind: 'derived', confidence: 'derived',
    provenance: { what: 'Engine owner total build cost.', why: 'Largest single labour line.', how: 'FTE x monthly rate x months.', source: 'Derived.' } },

  { id: 'b_cost_team', section: 'B', label: 'Labour — delivery team',
    formula: 'b_team_fte * a_delivery * b_months', format: 'currency', kind: 'derived', confidence: 'derived',
    provenance: { what: 'Delivery team total build cost.', why: 'Second-largest labour line.', how: 'FTE x blended rate x months.', source: 'Derived.' } },

  { id: 'b_cost_arch', section: 'B', label: 'Labour — Band 9 uplift correction',
    formula: 'b_arch_fte * (a_band9 - a_delivery) * b_months', format: 'currency', kind: 'derived', confidence: 'derived',
    provenance: {
      what: 'The amount by which the blended rate underprices the Band 9 architect.',
      why: 'The architect is already inside the delivery FTE at the blended rate. This line adds only the difference, so cost is not double-counted.',
      how: '(Band 9 rate less blended rate) x architect FTE x months.',
      source: 'Derived. Correction added after the Band 9 confirmation.' } },

  { id: 'b_cost_infra', section: 'B', label: 'Infrastructure & compute',
    formula: 'b_infra_mo * b_months', format: 'currency', kind: 'derived', confidence: 'derived',
    provenance: { what: 'Non-labour build cost.', why: 'Real cash cost of building.', how: 'Monthly x months.', source: 'Derived.' } },

  { id: 'b_subtotal', section: 'B', label: 'Build subtotal',
    formula: 'b_cost_doug + b_cost_team + b_cost_arch + b_cost_infra + b_bob_rebuild',
    format: 'currency', kind: 'derived', confidence: 'derived',
    provenance: { what: 'Build cost before contingency.', why: 'Base for the contingency uplift.', how: 'Sum of labour, infrastructure and the rebuild allowance.', source: 'Derived.' } },

  { id: 'b_conting_pct', section: 'B', label: 'Contingency on unsized scope',
    value: 0.25, format: 'percent', kind: 'input', confidence: 'assumption',
    provenance: {
      what: 'Uplift covering scope that has never been estimated.',
      why: 'The hardest and most load-bearing capability (supervisor intelligence) has no sprint estimate, and two workplan rows read "cannot be sized yet". A model without contingency implies a precision that does not exist.',
      how: 'Assumed 25%. Drop toward zero only once the open scope is sized.',
      source: 'Assumption, grounded in MVP roadmap Open Risks #1.' } },

  { id: 'b_conting', section: 'B', label: 'Contingency',
    formula: 'b_subtotal * b_conting_pct', format: 'currency', kind: 'derived', confidence: 'derived',
    provenance: { what: 'Contingency in dollars.', why: 'Makes unsized scope explicit rather than hidden.', how: 'Subtotal x contingency percent.', source: 'Derived.' } },

  { id: 'b_total', section: 'B', label: 'TOTAL BUILD COST',
    formula: 'b_subtotal + b_conting', format: 'currency', kind: 'derived', confidence: 'derived', emphasis: true,
    provenance: {
      what: 'Everything it costs to get to a sellable release.',
      why: 'Compare against the $250,000 floor. Landing several times higher is the finding, and it is exactly what was asked to be scoped.',
      how: 'Subtotal plus contingency.',
      source: 'Derived.' } },

  // ─────────────────────────── C · FIXED RUN ───────────────────────────
  { id: 'c_platform_qtr', section: 'C', label: 'Platform run cost per quarter',
    value: 10000, format: 'currency', kind: 'input', confidence: 'sourced',
    provenance: {
      what: 'Hosting, model registry and environments.',
      why: 'Overhead against gross profit that does not scale down with client count.',
      how: 'Offered as "at least $10,000 every quarter" — a floor. It appears to cover hosting only, not L2/L3 support or per-client model refresh, which sit in Section D.',
      source: 'Leadership 1:1, 2026-08-10.' } },

  { id: 'c_maint_fte', section: 'C', label: 'Platform maintenance labour — FTE',
    value: 0.25, format: 'number', kind: 'input', confidence: 'assumption',
    provenance: { what: 'Ongoing engineering to keep the platform alive.', why: 'Dependency upgrades, patching, registry care. Real and permanent.', how: 'Assumed quarter of an FTE.', source: 'Assumption. Owner: lead architect.' } },

  { id: 'c_fixed_yr', section: 'C', label: 'Fixed run cost per year',
    formula: 'c_platform_qtr * 4 + c_maint_fte * a_delivery * 12',
    format: 'currency', kind: 'derived', confidence: 'derived', emphasis: true,
    provenance: { what: 'Annual cost of running the platform regardless of client count.', why: 'Subtracted from total gross profit in Section E.', how: 'Quarterly platform x 4, plus maintenance FTE cost.', source: 'Derived.' } },

  // ─────────────────────────── D · PER CLIENT ──────────────────────────
  { id: 'd_review_hrs_qtr', section: 'D', label: 'Model review & approval — hours per quarter per client',
    value: 16, format: 'hours', kind: 'input', confidence: 'placeholder',
    provenance: {
      what: 'Human review and approval of each model refresh.',
      why: 'THE SINGLE MOST IMPORTANT MARGIN INPUT. The architecture requires a person to check and approve a model before the system will use it, and that gate stays in place for the MVP. That is a person, per client, per refresh, permanently — a services cost shape inside a product being sold on software margins.',
      how: 'Invented. The lead architect can supply the real figure.',
      source: 'PLACEHOLDER. Approval gate confirmed in architecture walkthrough minutes. Owner: lead architect.' } },

  { id: 'd_support_hrs_mo', section: 'D', label: 'L2/L3 support — hours per month per client',
    value: 8, format: 'hours', kind: 'input', confidence: 'placeholder',
    provenance: { what: 'Ongoing support per client.', why: 'Direct cost of serving.', how: 'Invented.', source: 'PLACEHOLDER. Owner: lead architect.' } },

  { id: 'd_compute_mo', section: 'D', label: 'Client compute & hosting per month',
    value: 1200, format: 'currency', kind: 'input', confidence: 'placeholder',
    provenance: {
      what: 'Per-client MCMC retraining and data storage.',
      why: 'Dominates cost-to-serve — it is why changing the hourly rate by 22% moves cost-to-serve only 7%. Under-scrutinised relative to its weight.',
      how: 'Invented.',
      source: 'PLACEHOLDER. Owner: lead architect / engine owner.' } },

  { id: 'd_onboard_pm', section: 'D', label: 'Data-readiness onboarding — person-months per client',
    value: 3, format: 'number', kind: 'input', confidence: 'placeholder',
    provenance: {
      what: 'One-time upstream work to get a client to clean, usable data.',
      why: 'The engine assumes it is handed clean data and is explicitly not designed to clean up messy source systems. Someone still has to do it.',
      how: 'Invented.',
      source: 'PLACEHOLDER. Clean-data assumption from architecture walkthrough minutes. Owner: lead architect.' } },

  { id: 'd_onboard_billed_separately', section: 'D', label: 'Onboarding billed separately? (1 = yes, 0 = absorbed)',
    value: 1, format: 'integer', kind: 'input', confidence: 'assumption',
    provenance: {
      what: 'The packaging decision, expressed as a switch.',
      why: 'NOT a modelling convenience — this is the commercial choice being worked through in the packaging exercise. Set to 1, data-readiness is its own engagement and the subscription carries only marginal run cost. Set to 0, it is absorbed and the price floor roughly doubles.',
      how: 'Toggle and watch e_price_floor.',
      source: 'Open decision. Owner: PM / offering team.' } },

  { id: 'd_delivery_pm', section: 'D', label: 'Ongoing services delivery — person-months per client per year',
    value: 0, format: 'number', kind: 'input', confidence: 'assumption',
    provenance: {
      what: 'The business-model dial. Person-months of hands-on delivery bundled into the subscription each year.',
      why: 'This is where the central contradiction becomes visible and testable. At 0 the asset behaves like software and clears ~90% margins. Raise it toward a services-led reality and gross margin collapses toward consulting levels — which is the delivery model the value proposition actually implies. Do not leave this at 0 without arguing why.',
      how: 'Set 0 for pure software, 2-4 for hybrid, 6+ for services-led.',
      source: 'Assumption. Added in response to the review finding that the modelled business type does not match the actual delivery model.' } },

  { id: 'd_scaling', section: 'D', label: 'Operational scaling factor',
    value: 1.0, format: 'number', kind: 'input', confidence: 'assumption',
    provenance: {
      what: 'Multiplier on per-client operational labour as client count rises.',
      why: 'A flat 1.0 assumes serving the tenth client costs exactly what serving the first did. Review feedback flagged operational scaling costs as understated. Multi-tenancy, per-client model drift, escalation load and account management rarely stay flat.',
      how: 'Set above 1.0 to stress-test. 1.3-1.5 is a reasonable pessimistic case at ten clients.',
      source: 'Assumption. Added in response to review feedback.' } },

  { id: 'd_labor_hrs_yr', section: 'D', label: 'Delivery hours per client per year',
    formula: 'd_review_hrs_qtr * 4 + d_support_hrs_mo * 12', format: 'hours', kind: 'derived', confidence: 'derived',
    provenance: { what: 'Annualised review plus support hours.', why: 'Labour component of cost-to-serve.', how: 'Quarterly review x 4, plus monthly support x 12.', source: 'Derived.' } },

  { id: 'd_cost_client', section: 'D', label: 'COST TO SERVE, per client per year',
    formula: 'd_labor_hrs_yr * a_hourly * d_scaling + d_compute_mo * 12 + IF(d_onboard_billed_separately == 1, 0, d_onboard_pm * a_delivery) + d_delivery_pm * a_delivery',
    format: 'currency', kind: 'derived', confidence: 'derived', emphasis: true,
    provenance: {
      what: 'Everything it costs to keep one client running for a year.',
      why: 'The denominator of the whole margin argument. Gross margin is (price minus this) divided by price.',
      how: 'Delivery labour x hourly rate x scaling factor, plus annual compute, plus onboarding only if absorbed rather than billed separately, plus any bundled services delivery.',
      source: 'Derived.' } },

  // ─────────────────────────── E · PRICE & VOLUME ──────────────────────
  { id: 'e_target_gp', section: 'E', label: 'Target gross margin',
    value: 0.70, format: 'percent', kind: 'input', confidence: 'sourced',
    provenance: {
      what: 'The margin the asset must clear to be treated as a software business.',
      why: 'Gross margin is the share of revenue left after the direct cost of serving that customer — not overhead, not build. Software runs 70%+ because serving one more customer costs very little; services runs 30-40% because every delivery hour is a paid person. Setting the bar at 70% is asking whether this behaves like software or is a services engagement wearing a software label.',
      how: 'Stated as a floor, not a target.',
      source: 'Leadership 1:1, 2026-08-10.' } },

  { id: 'e_price_floor', section: 'E', label: 'MINIMUM PRICE per client per year to hit target margin',
    formula: 'd_cost_client / (1 - e_target_gp)', format: 'currency', kind: 'derived', confidence: 'derived', emphasis: true,
    provenance: {
      what: 'The price below which the target margin is arithmetically impossible, at any volume.',
      why: 'Answers the pricing question from the cost side. Volume cannot rescue a price below this line.',
      how: 'If (price - cost) / price = target, then cost = (1 - target) x price, so price = cost / (1 - target).',
      source: 'Derived.' } },

  { id: 'e_price', section: 'E', label: 'Assumed price per client per year',
    value: 250000, format: 'currency', kind: 'input', confidence: 'assumption',
    provenance: {
      what: 'Annual contract value per client.',
      why: 'Sets both the margin and the number of clients needed. Review feedback flagged this as optimistic relative to the validation level — with no reference customer there is no evidence any client will pay this.',
      how: 'Enterprise marketing-mix-modelling contracts run roughly $50,000-$300,000 a year, self-service platforms $24,000-$60,000, managed engagements $50,000-$200,000. $250,000 sits at the optimistic end.',
      source: 'Assumption, benchmarked against public MMM pricing guides, 2026.' } },

  { id: 'e_gp_client', section: 'E', label: 'Gross margin per client at that price',
    formula: '(e_price - d_cost_client) / e_price', format: 'percent', kind: 'derived', confidence: 'derived',
    provenance: { what: 'Client-level gross margin, before fixed run cost and before the cost of acquiring the client.', why: 'Flattering by construction — compare against g_margin_after_gtm.', how: '(Price less cost to serve) divided by price.', source: 'Derived.' } },

  { id: 'e_rev_target', section: 'E', label: 'Revenue target, first 12 months',
    value: 2500000, format: 'currency', kind: 'input', confidence: 'sourced',
    provenance: { what: 'Year-one revenue ambition.', why: 'Combined with price, sets the number of clients that must be won.', how: 'Midpoint of the $2-3M range, softened in conversation to "one, two, three, four million... is it worth it?".', source: 'Leadership 1:1, 2026-08-10.' } },

  { id: 'e_clients', section: 'E', label: 'CLIENTS NEEDED to hit revenue target',
    formula: 'e_rev_target / e_price', format: 'number', kind: 'derived', confidence: 'derived', emphasis: true,
    provenance: {
      what: 'How many paying clients the revenue target implies.',
      why: 'The actual question. Sanity-check against reality: currently one unsigned prospect and no second name in the pipeline.',
      how: 'Revenue target divided by price.',
      source: 'Derived.' } },

  { id: 'e_gp_total', section: 'E', label: 'Gross profit at that client count',
    formula: 'e_clients * (e_price - d_cost_client) - c_fixed_yr', format: 'currency', kind: 'derived', confidence: 'derived',
    provenance: { what: 'Total gross profit before the cost of acquiring customers.', why: 'Intermediate. Not the number to defend.', how: 'Client-level profit x clients, less fixed run cost.', source: 'Derived.' } },

  { id: 'e_gp_margin', section: 'E', label: 'Blended margin after fixed run cost',
    formula: 'e_gp_total / e_rev_target', format: 'percent', kind: 'derived', confidence: 'derived',
    provenance: { what: 'Margin once platform overhead is absorbed.', why: 'Always below the client-level margin.', how: 'Gross profit divided by revenue.', source: 'Derived.' } },

  // ─────────────────────────── F · GTM / CAC ───────────────────────────
  { id: 'f_win_rate', section: 'F', label: 'Win rate on qualified opportunities',
    value: 0.20, format: 'percent', kind: 'input', confidence: 'placeholder',
    provenance: {
      what: 'Share of qualified opportunities that become signed clients.',
      why: 'Determines how much pipeline must exist. Review feedback flagged sales assumptions as disconnected from market proof — with zero reference customers a new asset typically wins less than an established one.',
      how: 'Invented at 20%.',
      source: 'PLACEHOLDER. Owner: sales / offering leadership.' } },

  { id: 'f_cycle_mo', section: 'F', label: 'Sales cycle length',
    value: 6, format: 'months', kind: 'input', confidence: 'placeholder',
    provenance: {
      what: 'Months from qualified opportunity to signature.',
      why: 'Interacts brutally with timing. If the sellable release lands with only a few months left in the window, a six-month cycle makes year-one revenue arithmetically unreachable regardless of demand.',
      how: 'Invented. Enterprise deals at this value routinely run 6-12 months.',
      source: 'PLACEHOLDER. Owner: sales.' } },

  { id: 'f_opps', section: 'F', label: 'Qualified opportunities required',
    formula: 'e_clients / f_win_rate', format: 'number', kind: 'derived', confidence: 'derived',
    provenance: { what: 'Pipeline needed to land the required clients.', why: 'Converts a revenue target into a pipeline obligation somebody has to actually create.', how: 'Clients needed divided by win rate.', source: 'Derived.' } },

  { id: 'f_seller_fte', section: 'F', label: 'Seller FTE consumed per pursuit',
    value: 0.15, format: 'number', kind: 'input', confidence: 'placeholder',
    provenance: { what: 'Share of a seller dedicated to one pursuit.', why: 'Selling is a real cost that no earlier version of this model carried.', how: 'Invented.', source: 'PLACEHOLDER. Owner: sales.' } },

  { id: 'f_presales_hrs', section: 'F', label: 'Presales / solutioning hours per pursuit',
    value: 80, format: 'hours', kind: 'input', confidence: 'placeholder',
    provenance: { what: 'Technical presales effort per pursuit.', why: 'A model-heavy product demands heavy presales — demos, data assessment, proof work.', how: 'Invented.', source: 'PLACEHOLDER. Owner: lead architect / sales.' } },

  { id: 'f_marketing', section: 'F', label: 'Marketing & enablement cost per pursuit',
    value: 15000, format: 'currency', kind: 'input', confidence: 'placeholder',
    provenance: { what: 'Demand generation, collateral and events attributable to a pursuit.', why: 'Completes the acquisition cost picture.', how: 'Invented.', source: 'PLACEHOLDER. Owner: marketing.' } },

  { id: 'f_cac_won', section: 'F', label: 'Acquisition cost per pursuit',
    formula: 'f_seller_fte * a_onshore * f_cycle_mo + f_presales_hrs * a_hourly + f_marketing',
    format: 'currency', kind: 'derived', confidence: 'derived',
    provenance: { what: 'Cost of running one pursuit, win or lose.', why: 'Building block for loaded CAC.', how: 'Seller time + presales time + marketing.', source: 'Derived.' } },

  { id: 'f_cac_loaded', section: 'F', label: 'LOADED CAC per won client',
    formula: 'f_cac_won / f_win_rate', format: 'currency', kind: 'derived', confidence: 'derived', emphasis: true,
    provenance: {
      what: 'True cost of acquiring one paying client, including the pursuits that were lost.',
      why: 'The honest acquisition number. Dividing by win rate is what makes it honest — losses are a real cost of the wins.',
      how: 'Cost per pursuit divided by win rate.',
      source: 'Derived.' } },

  { id: 'f_cac_total', section: 'F', label: 'Total acquisition cost at target volume',
    formula: 'f_cac_loaded * e_clients', format: 'currency', kind: 'derived', confidence: 'derived',
    provenance: { what: 'Total spend to land the full client count.', why: 'Subtracted from gross profit in Section G.', how: 'Loaded CAC x clients needed.', source: 'Derived.' } },

  { id: 'f_retention_yrs', section: 'F', label: 'Expected client retention',
    value: 3, format: 'number', kind: 'input', confidence: 'placeholder',
    provenance: { what: 'Years a client stays.', why: 'Drives lifetime value. With no reference customers there is no churn evidence at all.', how: 'Invented.', source: 'PLACEHOLDER.' } },

  { id: 'f_ltv', section: 'F', label: 'Lifetime gross profit per client',
    formula: '(e_price - d_cost_client) * f_retention_yrs', format: 'currency', kind: 'derived', confidence: 'derived',
    provenance: { what: 'Total gross profit one client produces over their life.', why: 'Numerator of the LTV:CAC ratio.', how: 'Annual client profit x retention years.', source: 'Derived.' } },

  { id: 'f_ltv_cac', section: 'F', label: 'LTV : CAC ratio',
    formula: 'f_ltv / f_cac_loaded', format: 'ratio', kind: 'derived', confidence: 'derived', emphasis: true,
    provenance: {
      what: 'Lifetime gross profit per client divided by what it cost to acquire them.',
      why: 'The standard test of whether a subscription business is viable. Below 3:1 the business is generally considered to be buying revenue at an unsustainable price.',
      how: 'Lifetime profit divided by loaded CAC.',
      source: 'Derived. The 3:1 benchmark is a widely used SaaS convention, not an internal standard.' } },

  { id: 'f_cac_payback_mo', section: 'F', label: 'CAC payback period',
    formula: 'f_cac_loaded / ((e_price - d_cost_client) / 12)', format: 'months', kind: 'derived', confidence: 'derived',
    provenance: { what: 'Months of client gross profit needed to repay acquisition cost.', why: 'Under 12 months is generally healthy; over 18 signals a capital-hungry model.', how: 'Loaded CAC divided by monthly client gross profit.', source: 'Derived.' } },

  // ─────────────────────────── G · AFTER GTM ───────────────────────────
  { id: 'g_gp_after_gtm', section: 'G', label: 'Gross profit after acquisition cost',
    formula: 'e_gp_total - f_cac_total', format: 'currency', kind: 'derived', confidence: 'derived', emphasis: true,
    provenance: {
      what: 'What is actually left after serving clients and winning them.',
      why: 'The honest profit figure. Every margin above this line excludes the cost of getting the customer.',
      how: 'Gross profit less total acquisition cost.',
      source: 'Derived. Added in response to review feedback that CAC and GTM economics were missing.' } },

  { id: 'g_margin_after_gtm', section: 'G', label: 'MARGIN AFTER GTM',
    formula: 'g_gp_after_gtm / e_rev_target', format: 'percent', kind: 'derived', confidence: 'derived', emphasis: true,
    provenance: {
      what: 'The margin that survives contact with the cost of selling.',
      why: 'THE NUMBER TO DEFEND. If the 70% target holds before GTM but fails after, the target was being met by excluding customer acquisition rather than by genuine software economics.',
      how: 'Profit after acquisition divided by revenue.',
      source: 'Derived.' } },

  { id: 'g_payback_mo', section: 'G', label: 'Build payback period',
    formula: 'IF(g_gp_after_gtm > 0, b_total / (g_gp_after_gtm / 12), 0)', format: 'months', kind: 'derived', confidence: 'derived',
    provenance: {
      what: 'Months of post-GTM profit needed to recover the build.',
      why: 'Keep this separate from the margin test. The margin test is about cost-to-serve and excludes the build; the payback test asks whether accumulated profit recovers the build, and how fast.',
      how: 'Total build cost divided by monthly profit after GTM.',
      source: 'Derived.' } },

  // ─────────────────────────── H · STAGED ──────────────────────────────
  { id: 'h_client_funded_pct', section: 'H', label: 'Share of build funded by a paid client engagement',
    value: 0.60, format: 'percent', kind: 'input', confidence: 'assumption',
    provenance: {
      what: 'Proportion of build cost recovered by selling early stages as delivery work.',
      why: 'The single configuration in which the economics hold. Client funding cuts capital at risk, produces the real-data validation the asset cannot otherwise obtain, and produces the reference customer that currently does not exist. It is the difference between an investment case and a bet.',
      how: 'Assumed 60%, representing a readiness snapshot plus a charter and single-lever pilot sold as delivery.',
      source: 'Assumption. Consistent with the staged-investment path the review recommended.' } },

  { id: 'h_net_at_risk', section: 'H', label: 'Net investment at risk',
    formula: 'b_total * (1 - h_client_funded_pct)', format: 'currency', kind: 'derived', confidence: 'derived', emphasis: true,
    provenance: { what: 'Capital genuinely exposed after client funding.', why: 'The number a funding decision should actually be taken against.', how: 'Build cost x unfunded share.', source: 'Derived.' } },

  { id: 'h_stage0_cost', section: 'H', label: 'Stage 0 — readiness & value snapshot',
    value: 75000, format: 'currency', kind: 'input', confidence: 'placeholder',
    provenance: { what: 'A short paid diagnostic engagement.', why: 'The cheapest way to buy evidence before committing to a build. Creates a real dataset, a real baseline and a real buyer conversation.', how: 'Invented.', source: 'PLACEHOLDER.' } },

  { id: 'h_stage1_cost', section: 'H', label: 'Stage 1 — charter & single-lever pilot',
    value: 250000, format: 'currency', kind: 'input', confidence: 'placeholder',
    provenance: { what: 'A funded pilot proving one decision on real client data.', why: 'Converts speculative build into billable delivery and produces the reference.', how: 'Invented.', source: 'PLACEHOLDER.' } },

  { id: 'h_payback_net', section: 'H', label: 'Payback on net investment',
    formula: 'IF(g_gp_after_gtm > 0, h_net_at_risk / (g_gp_after_gtm / 12), 0)', format: 'months', kind: 'derived', confidence: 'derived',
    provenance: { what: 'Months to recover only the capital actually at risk.', why: 'Shows how dramatically client funding changes the risk profile.', how: 'Net at risk divided by monthly profit after GTM.', source: 'Derived.' } },

  // ─────────────────────────── I · TIMING ──────────────────────────────
  { id: 'i_window_mo', section: 'I', label: 'Revenue measurement window',
    value: 12, format: 'months', kind: 'input', confidence: 'sourced',
    provenance: { what: 'The period the revenue target is measured over.', why: 'Sets up the timing test.', how: 'Stated as "the first 12 months".', source: 'Leadership 1:1, 2026-08-10.' } },

  { id: 'i_sellable_months', section: 'I', label: 'Sellable months inside the window',
    formula: 'MAX(0, i_window_mo - b_months)', format: 'months', kind: 'derived', confidence: 'derived', emphasis: true,
    provenance: {
      what: 'Months of the measurement window in which a sellable product actually exists.',
      why: 'Perhaps the most under-appreciated finding. A twelve-month revenue target is measured against a window that largely does not exist, because build and hardening consume most of it.',
      how: 'Window less total build duration, floored at zero.',
      source: 'Derived.' } },

  { id: 'i_rev_per_sellable_mo', section: 'I', label: 'Required revenue per sellable month',
    formula: 'IF(i_sellable_months > 0, e_rev_target / i_sellable_months, 0)', format: 'currency', kind: 'derived', confidence: 'derived',
    provenance: { what: 'Run-rate the target implies once the window is corrected for build time.', why: 'A sanity check that usually ends the conversation.', how: 'Revenue target divided by sellable months.', source: 'Derived.' } },

  { id: 'i_deals_closable', section: 'I', label: 'Selling months left after one full sales cycle',
    formula: 'MAX(0, i_window_mo - b_months - f_cycle_mo)', format: 'months', kind: 'derived', confidence: 'derived',
    provenance: {
      what: 'Months remaining once build, hardening and one full sales cycle are deducted.',
      why: 'If this is zero, no deal started after the product exists can close inside the window. Selling must begin before the product is finished, which changes what has to be true today.',
      how: 'Window less build less sales cycle, floored at zero.',
      source: 'Derived.' } },
];

export const PRESET_SCENARIOS = [
  { name: 'Base case — software mode', notes: 'As modelled. Placeholder rate card, no bundled services delivery, flat scaling.', overrides: {} },
  { name: 'Hybrid delivery', notes: 'Two person-months of bundled delivery per client per year, mild scaling pressure.', overrides: { d_delivery_pm: 2, d_scaling: 1.2 } },
  { name: 'Services-led reality', notes: 'The delivery model the value proposition actually implies. Watch gross margin collapse toward consulting levels.', overrides: { d_delivery_pm: 6, d_scaling: 1.4, e_target_gp: 0.35 } },
  { name: 'Pessimistic commercial', notes: 'Lower price, weaker win rate, longer cycle, onboarding absorbed.', overrides: { e_price: 120000, f_win_rate: 0.12, f_cycle_mo: 9, d_onboard_billed_separately: 0 } },
  { name: 'Client-funded staged path', notes: 'The configuration the review recommends: a paid pilot funds most of the build.', overrides: { h_client_funded_pct: 0.8, e_price: 180000, e_rev_target: 1500000 } },
];

// Re-export as DEFAULT_ROWS for compatibility with engine.js and App.jsx
export { MODEL_ROWS as DEFAULT_ROWS };
