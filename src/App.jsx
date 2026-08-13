/**
 * App.jsx — IBM Carbon Design System UI for the pricing & investment calculator.
 *
 * Interaction model:
 *  - Double-click any value  → provenance panel (what / why / how / source, plus
 *                              the formula, its dependencies and its dependents)
 *  - Single-click an input   → edit in place
 *  - Edit mode               → add, delete, reorder rows and rewrite formulas
 *  - Analysis tab            → deterministic findings + optional LLM critique
 *
 * Requires: @carbon/react, @carbon/icons-react
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Theme, Content, Header, HeaderName, HeaderGlobalBar, HeaderGlobalAction,
  Grid, Column, Tile, Button, TextInput, Select, SelectItem,
  Tabs, TabList, Tab, TabPanels, TabPanel, Tag, InlineNotification,
  Table, TableHead, TableRow, TableHeader, TableBody, TableCell,
  Modal, TextArea, Toggle, Loading, Accordion, AccordionItem, Layer,
  StructuredListWrapper, StructuredListHead, StructuredListBody,
  StructuredListRow, StructuredListCell,
} from '@carbon/react';
import {
  Information, Edit, Add, TrashCan, Download, Upload, Reset,
  ChartLineData, WarningAlt, CheckmarkFilled, Analytics,
} from '@carbon/icons-react';

import { MODEL_ROWS, SECTIONS, FORMATS, PRESET_SCENARIOS } from './model';
import {
  recalculate, runAnalysis, buildSwot, formatValue, humaniseFormula,
  extractDependencies, dependentsOf, serialiseModel, deserialiseModel, toCSV,
  buildAnalysisPrompt, analyseWithLLM,
} from './engine';

const CONFIDENCE_META = {
  sourced:     { type: 'green',      label: 'Sourced' },
  derived:     { type: 'blue',       label: 'Derived' },
  assumption:  { type: 'purple',     label: 'Assumption' },
  placeholder: { type: 'red',        label: 'Placeholder' },
};

const SEVERITY_KIND = { error: 'error', warning: 'warning', info: 'info', success: 'success' };

export default function App() {
  const [rows, setRows] = useState(MODEL_ROWS);
  const [overrides, setOverrides] = useState({});
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [rowModal, setRowModal] = useState(null); // { mode: 'add'|'edit', draft }
  const [llmConfig, setLlmConfig] = useState({ endpoint: '', model: 'ibm/granite-13b-chat-v2' });
  const [llmResult, setLlmResult] = useState(null);
  const [llmBusy, setLlmBusy] = useState(false);
  const [llmError, setLlmError] = useState(null);
  const fileRef = useRef(null);

  const { values, errors, cycles } = useMemo(() => recalculate(rows, overrides), [rows, overrides]);
  const findings = useMemo(() => runAnalysis(rows, values), [rows, values]);
  const swot = useMemo(() => buildSwot(rows, values, findings), [rows, values, findings]);
  const selectedRow = rows.find((r) => r.id === selectedRowId) || null;

  // ── mutations ──────────────────────────────────────────────
  const setOverride = useCallback((id, val) => {
    setOverrides((o) => ({ ...o, [id]: val === '' || val === null ? undefined : Number(val) }));
  }, []);

  const resetOverrides = () => setOverrides({});

  const applyScenario = (name) => {
    const s = PRESET_SCENARIOS.find((x) => x.name === name);
    setOverrides(s ? { ...s.overrides } : {});
  };

  const upsertRow = (draft, mode) => {
    setRows((rs) => {
      if (mode === 'add') {
        const idx = rs.findIndex((r) => r.section === draft.section && r.id === draft.afterId);
        const next = [...rs];
        next.splice(idx >= 0 ? idx + 1 : next.length, 0, cleanDraft(draft));
        return next;
      }
      return rs.map((r) => (r.id === draft.id ? { ...r, ...cleanDraft(draft) } : r));
    });
    setRowModal(null);
  };

  const deleteRow = (id) => {
    const dents = dependentsOf(id, rows);
    if (dents.length && !window.confirm(
      `${dents.length} row(s) depend on this and will break:\n${dents.join(', ')}\n\nDelete anyway?`
    )) return;
    setRows((rs) => rs.filter((r) => r.id !== id));
    if (selectedRowId === id) setSelectedRowId(null);
  };

  const moveRow = (id, dir) => {
    setRows((rs) => {
      const i = rs.findIndex((r) => r.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  // ── import / export ────────────────────────────────────────
  const exportJSON = () => download(
    serialiseModel(rows, overrides, { title: 'APO pricing model' }),
    'apo-pricing-model.json', 'application/json'
  );
  const exportCSV = () => download(toCSV(rows, values, FORMATS), 'apo-pricing-model.csv', 'text/csv');

  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { rows: r, overrides: o } = deserialiseModel(reader.result);
        setRows(r); setOverrides(o);
      } catch (err) { window.alert(`Import failed: ${err.message}`); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── LLM ────────────────────────────────────────────────────
  const runLLM = async () => {
    setLlmBusy(true); setLlmError(null);
    try {
      const prompt = buildAnalysisPrompt(rows, values, findings, swot);
      const result = await analyseWithLLM(prompt, llmConfig.endpoint, llmConfig.model);
      setLlmResult(result);
    } catch (err) {
      setLlmError(err.message);
    } finally { setLlmBusy(false); }
  };

  const copyPrompt = () =>
    navigator.clipboard.writeText(buildAnalysisPrompt(rows, values, findings, swot));

  const placeholderCount = rows.filter((r) => r.confidence === 'placeholder' && r.kind === 'input').length;

  return (
    <Theme theme="g10">
      <Header aria-label="Pricing calculator">
        <HeaderName prefix="">Pricing &amp; Investment Calculator</HeaderName>
        <HeaderGlobalBar>
          <HeaderGlobalAction aria-label="Reset overrides" onClick={resetOverrides}>
            <Reset size={20} />
          </HeaderGlobalAction>
          <HeaderGlobalAction aria-label="Import" onClick={() => fileRef.current?.click()}>
            <Upload size={20} />
          </HeaderGlobalAction>
          <HeaderGlobalAction aria-label="Export JSON" onClick={exportJSON}>
            <Download size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header>
      <input ref={fileRef} type="file" accept="application/json" onChange={importJSON} style={{ display: 'none' }} />

      <Content className="apo-content">
        {cycles.length > 0 && (
          <InlineNotification kind="error" lowContrast hideCloseButton
            title="Circular reference"
            subtitle={`These rows reference each other in a loop: ${cycles.join(' | ')}`}
          />
        )}
        {placeholderCount > 0 && (
          <InlineNotification kind="warning" lowContrast hideCloseButton
            title={`${placeholderCount} unsourced placeholder input${placeholderCount > 1 ? 's' : ''}`}
            subtitle="This model is directional until each is replaced with a sourced figure. Double-click any value to see its provenance."
          />
        )}

        <Grid className="apo-toolbar">
          <Column sm={4} md={4} lg={5}>
            <Select id="scenario" labelText="Scenario" onChange={(e) => applyScenario(e.target.value)} defaultValue="">
              <SelectItem value="" text="— Custom / current —" />
              {PRESET_SCENARIOS.map((s) => (
                <SelectItem key={s.name} value={s.name} text={s.name} />
              ))}
            </Select>
          </Column>
          <Column sm={4} md={4} lg={6}>
            <Toggle id="edit-mode" size="sm" labelText="Structure editing"
              labelA="Locked" labelB="Editing rows &amp; formulas"
              toggled={editMode} onToggle={setEditMode}
            />
          </Column>
          <Column sm={4} md={8} lg={5} className="apo-toolbar__actions">
            {editMode && (
              <Button size="sm" kind="tertiary" renderIcon={Add}
                onClick={() => setRowModal({ mode: 'add', draft: blankDraft() })}>
                Add row
              </Button>
            )}
            <Button size="sm" kind="ghost" renderIcon={Download} onClick={exportCSV}>CSV</Button>
          </Column>
        </Grid>

        <Grid>
          <Column sm={4} md={8} lg={selectedRow ? 10 : 16}>
            <Tabs>
              <TabList aria-label="Views">
                <Tab renderIcon={ChartLineData}>Model</Tab>
                <Tab renderIcon={WarningAlt}>
                  Analysis ({findings.filter((f) => f.severity === 'error').length})
                </Tab>
                <Tab renderIcon={Analytics}>SWOT</Tab>
                <Tab renderIcon={Information}>LLM critique</Tab>
              </TabList>

              <TabPanels>
                {/* ── MODEL ─────────────────────────────────── */}
                <TabPanel>
                  {SECTIONS.map((section) => {
                    const sectionRows = rows.filter((r) => r.section === section.id);
                    if (!sectionRows.length) return null;
                    return (
                      <Layer key={section.id} className="apo-section">
                        <h3 className="apo-section__title">{section.title}</h3>
                        {section.blurb && (
                          <p className="apo-section__blurb">{section.blurb}</p>
                        )}
                        <Table size="sm" useZebraStyles={false}>
                          <TableHead>
                            <TableRow>
                              <TableHeader>Line item</TableHeader>
                              <TableHeader className="apo-num">Value</TableHeader>
                              <TableHeader>Basis</TableHeader>
                              {editMode && <TableHeader>Structure</TableHeader>}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {sectionRows.map((row) => (
                              <ModelRow
                                key={row.id}
                                row={row}
                                value={values[row.id]}
                                error={errors[row.id]}
                                overridden={overrides[row.id] !== undefined}
                                selected={selectedRowId === row.id}
                                editMode={editMode}
                                onSelect={() => setSelectedRowId(
                                  selectedRowId === row.id ? null : row.id
                                )}
                                onChange={(v) => setOverride(row.id, v)}
                                onEditStructure={() => setRowModal({
                                  mode: 'edit',
                                  draft: { ...row, ...(row.provenance || {}) },
                                })}
                                onDelete={() => deleteRow(row.id)}
                                onMove={(d) => moveRow(row.id, d)}
                              />
                            ))}
                          </TableBody>
                        </Table>
                      </Layer>
                    );
                  })}
                </TabPanel>

                {/* ── ANALYSIS ──────────────────────────────── */}
                <TabPanel>
                  <div className="apo-findings">
                    {findings.length === 0 && (
                      <InlineNotification kind="success" lowContrast hideCloseButton
                        title="No findings" subtitle="No deterministic rules fired at current settings." />
                    )}
                    {findings.map((f) => (
                      <InlineNotification
                        key={f.id}
                        kind={SEVERITY_KIND[f.severity] ?? 'info'}
                        lowContrast
                        hideCloseButton
                        title={f.title}
                        subtitle={
                          <span>
                            {f.body ?? f.detail}
                            {f.action && (
                              <><br /><strong>Action: </strong>{f.action}</>
                            )}
                          </span>
                        }
                      />
                    ))}
                  </div>
                </TabPanel>

                {/* ── SWOT ──────────────────────────────────── */}
                <TabPanel>
                  <Grid className="apo-swot">
                    {[
                      ['Strengths',     swot.strengths],
                      ['Weaknesses',    swot.weaknesses],
                      ['Opportunities', swot.opportunities],
                      ['Threats',       swot.threats],
                    ].map(([title, items]) => (
                      <Column key={title} sm={4} md={4} lg={8}>
                        <Tile className={`apo-swot__tile apo-swot__tile--${title.toLowerCase()}`}>
                          <h4>{title}</h4>
                          {(!items || items.length === 0) && (
                            <p className="apo-muted">None flagged at current settings.</p>
                          )}
                          {(items || []).map((it, i) => (
                            <div key={i} className="apo-swot__item">
                              <strong>{typeof it === 'string' ? it : it.title}</strong>
                              {it.detail && <p>{it.detail}</p>}
                            </div>
                          ))}
                        </Tile>
                      </Column>
                    ))}
                  </Grid>
                </TabPanel>

                {/* ── LLM ───────────────────────────────────── */}
                <TabPanel>
                  <Tile className="apo-llm">
                    <p className="apo-muted">
                      Deterministic analysis always runs and is authoritative. The LLM layer adds
                      narrative on top and must never contradict it. Point the endpoint at watsonx or
                      an internal gateway — never embed a key in client code, proxy it server-side.
                    </p>
                    <Grid>
                      <Column sm={4} md={5} lg={8}>
                        <TextInput
                          id="llm-endpoint"
                          labelText="Endpoint URL"
                          value={llmConfig.endpoint}
                          onChange={(e) => setLlmConfig({ ...llmConfig, endpoint: e.target.value })}
                          placeholder="https://your-gateway/v1/chat/completions"
                        />
                      </Column>
                      <Column sm={4} md={3} lg={5}>
                        <TextInput
                          id="llm-model"
                          labelText="Model"
                          value={llmConfig.model}
                          onChange={(e) => setLlmConfig({ ...llmConfig, model: e.target.value })}
                        />
                      </Column>
                      <Column sm={4} md={8} lg={3} className="apo-llm__actions">
                        <Button
                          size="md"
                          onClick={runLLM}
                          disabled={llmBusy || !llmConfig.endpoint}
                        >
                          Analyse
                        </Button>
                        <Button size="md" kind="tertiary" onClick={copyPrompt}>
                          Copy prompt
                        </Button>
                      </Column>
                    </Grid>

                    {llmBusy && (
                      <Loading withOverlay={false} description="Analysing" />
                    )}
                    {llmError && (
                      <InlineNotification kind="error" lowContrast title="LLM error" subtitle={llmError} />
                    )}

                    {llmResult && (
                      <div className="apo-llm__result">
                        <h4>Verdict: {llmResult.verdict}</h4>
                        {llmResult.headline && <p className="apo-llm__headline">{llmResult.headline}</p>}
                        {llmResult.narrative && (
                          <div className="apo-llm__narrative">
                            {llmResult.narrative.split('\n').filter(Boolean).map((p, i) => (
                              <p key={i}>{p}</p>
                            ))}
                          </div>
                        )}
                        <Accordion>
                          {['top_risks', 'recommended_actions'].map((k) =>
                            (llmResult[k]?.length > 0) ? (
                              <AccordionItem
                                key={k}
                                title={`${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} (${llmResult[k].length})`}
                              >
                                <ul className="apo-llm__list">
                                  {llmResult[k].map((it, i) => (
                                    <li key={i}>{typeof it === 'string' ? it : it.detail ?? JSON.stringify(it)}</li>
                                  ))}
                                </ul>
                              </AccordionItem>
                            ) : null
                          )}
                        </Accordion>
                      </div>
                    )}

                    <details className="apo-llm__prompt-preview">
                      <summary>Preview prompt</summary>
                      <pre className="apo-code">{buildAnalysisPrompt(rows, values, findings, swot)}</pre>
                    </details>
                  </Tile>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Column>

          {selectedRow && (
            <Column sm={4} md={8} lg={6}>
              <ProvenancePanel
                row={selectedRow}
                rows={rows}
                value={values[selectedRow.id]}
                overridden={overrides[selectedRow.id] !== undefined}
                onClose={() => setSelectedRowId(null)}
              />
            </Column>
          )}
        </Grid>
      </Content>

      {rowModal && (
        <RowEditorModal
          mode={rowModal.mode}
          draft={rowModal.draft}
          rows={rows}
          onClose={() => setRowModal(null)}
          onSave={(d) => upsertRow(d, rowModal.mode)}
        />
      )}
    </Theme>
  );
}

// ─────────────────────────── ROW ───────────────────────────
function ModelRow({ row, value, error, overridden, selected, editMode, onSelect, onChange, onEditStructure, onDelete, onMove }) {
  const conf = CONFIDENCE_META[row.confidence] || CONFIDENCE_META.assumption;
  const isEditable = (row.kind === 'input' || row.kind === 'constant') && !row.formula;

  return (
    <TableRow
      className={[
        'apo-row',
        selected    ? 'apo-row--selected'     : '',
        row.emphasis ? 'apo-row--emphasis'    : '',
        row.confidence === 'placeholder' ? 'apo-row--placeholder' : '',
      ].filter(Boolean).join(' ')}
      onDoubleClick={onSelect}
      title="Double-click for provenance"
    >
      <TableCell>
        <span className="apo-row__label">{row.label}</span>
        {overridden && <Tag type="teal" size="sm">overridden</Tag>}
        {error    && <Tag type="red"  size="sm">{error}</Tag>}
      </TableCell>

      <TableCell className="apo-num">
        {isEditable ? (
          <input
            className="apo-input"
            type="number"
            step="any"
            value={overridden !== undefined ? value : (row.value ?? value ?? 0)}
            onChange={(e) => onChange(e.target.value)}
            onDoubleClick={(e) => { e.stopPropagation(); onSelect(); }}
            aria-label={row.label}
          />
        ) : (
          <button type="button" className="apo-value" onClick={onSelect}>
            {formatValue(value, row.format)}
          </button>
        )}
      </TableCell>

      <TableCell>
        <Tag type={conf.type} size="sm">{conf.label}</Tag>
        <Button kind="ghost" size="sm" hasIconOnly renderIcon={Information}
          iconDescription="Provenance" onClick={onSelect}
        />
      </TableCell>

      {editMode && (
        <TableCell>
          <div className="apo-rowactions">
            <Button kind="ghost" size="sm" hasIconOnly renderIcon={Edit}
              iconDescription="Edit row" onClick={onEditStructure} />
            <Button kind="ghost" size="sm" hasIconOnly renderIcon={TrashCan}
              iconDescription="Delete row" onClick={onDelete} />
            <Button kind="ghost" size="sm" onClick={() => onMove(-1)}>↑</Button>
            <Button kind="ghost" size="sm" onClick={() => onMove(1)}>↓</Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

// ─────────────────────── PROVENANCE PANEL ───────────────────────
function ProvenancePanel({ row, rows, value, overridden, onClose }) {
  const knownIds = new Set(rows.map((r) => r.id));
  const deps  = extractDependencies(row.formula, knownIds);
  const dents = dependentsOf(row.id, rows);
  const conf  = CONFIDENCE_META[row.confidence] || CONFIDENCE_META.assumption;
  const p     = row.provenance || {};

  return (
    <Tile className="apo-panel">
      <div className="apo-panel__head">
        <div>
          <p className="apo-panel__eyebrow">{row.id}</p>
          <h3>{row.label}</h3>
        </div>
        <Button kind="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>

      <p className="apo-panel__value">{formatValue(value, row.format)}</p>

      <div className="apo-panel__tags">
        <Tag type={conf.type}>{conf.label}</Tag>
        <Tag type="gray">{row.kind}</Tag>
        {overridden && <Tag type="teal">scenario override</Tag>}
      </div>

      {row.confidence === 'placeholder' && (
        <InlineNotification kind="error" lowContrast hideCloseButton
          title="Unsourced placeholder"
          subtitle="This number was invented so the model would run. Replace it before this figure is used in a decision."
        />
      )}

      <StructuredListWrapper isCondensed className="apo-panel__list">
        <StructuredListHead>
          <StructuredListRow head>
            <StructuredListCell head>Aspect</StructuredListCell>
            <StructuredListCell head>Detail</StructuredListCell>
          </StructuredListRow>
        </StructuredListHead>
        <StructuredListBody>
          <ProvenanceRow label="What it is"        text={p.what}   />
          <ProvenanceRow label="Why it matters"    text={p.why}    />
          <ProvenanceRow label="How it was derived" text={p.how}   />
          <ProvenanceRow label="Source"             text={p.source} />
        </StructuredListBody>
      </StructuredListWrapper>

      {row.formula && (
        <>
          <h5 className="apo-panel__h">Formula</h5>
          <code className="apo-code">{row.formula}</code>
          <p className="apo-panel__plain">{humaniseFormula(row.formula, rows)}</p>
        </>
      )}

      {deps.length > 0 && (
        <>
          <h5 className="apo-panel__h">Depends on ({deps.length})</h5>
          <div className="apo-chips">
            {deps.map((d) => (
              <Tag key={d} type="outline">{labelOf(d, rows)}</Tag>
            ))}
          </div>
        </>
      )}

      {dents.length > 0 && (
        <>
          <h5 className="apo-panel__h">Changing this affects ({dents.length})</h5>
          <div className="apo-chips">
            {dents.map((d) => (
              <Tag key={d} type="outline">{labelOf(d, rows)}</Tag>
            ))}
          </div>
        </>
      )}
    </Tile>
  );
}

function ProvenanceRow({ label, text }) {
  return (
    <StructuredListRow>
      <StructuredListCell noWrap>{label}</StructuredListCell>
      <StructuredListCell>{text || '—'}</StructuredListCell>
    </StructuredListRow>
  );
}

const labelOf = (id, rows) => rows.find((r) => r.id === id)?.label || id;

// ─────────────────────── ROW EDITOR ───────────────────────
function RowEditorModal({ mode, draft, rows, onClose, onSave }) {
  const [d, setD] = useState(draft);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });

  const idClash = mode === 'add' && rows.some((r) => r.id === d.id);
  const valid   = d.id && d.label && !idClash;

  return (
    <Modal
      open
      modalHeading={mode === 'add' ? 'Add row' : `Edit ${d.id}`}
      primaryButtonText="Save"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={!valid}
      onRequestClose={onClose}
      onRequestSubmit={() => onSave(d)}
      size="lg"
    >
      <Grid>
        <Column sm={4} md={4} lg={8}>
          <TextInput
            id="r-id" labelText="Row id (used in formulas)"
            value={d.id || ''} onChange={set('id')}
            disabled={mode === 'edit'}
            invalid={idClash} invalidText="That id already exists."
          />
        </Column>
        <Column sm={4} md={4} lg={8}>
          <TextInput id="r-label" labelText="Label" value={d.label || ''} onChange={set('label')} />
        </Column>
        <Column sm={4} md={4} lg={5}>
          <Select id="r-section" labelText="Section" value={d.section || 'A'} onChange={set('section')}>
            {SECTIONS.map((s) => (
              <SelectItem key={s.id} value={s.id} text={s.title} />
            ))}
          </Select>
        </Column>
        <Column sm={4} md={4} lg={5}>
          <Select id="r-kind" labelText="Kind" value={d.kind || 'input'} onChange={set('kind')}>
            <SelectItem value="input"   text="Input (editable)" />
            <SelectItem value="derived" text="Derived (formula)" />
            <SelectItem value="constant" text="Constant" />
          </Select>
        </Column>
        <Column sm={4} md={4} lg={6}>
          <Select id="r-format" labelText="Format" value={d.format || 'number'} onChange={set('format')}>
            {Object.keys(FORMATS).map((f) => (
              <SelectItem key={f} value={f} text={f} />
            ))}
          </Select>
        </Column>
        <Column sm={4} md={4} lg={8}>
          <TextInput
            id="r-value" labelText="Value (ignored if a formula is set)"
            value={d.value ?? ''} onChange={set('value')}
          />
        </Column>
        <Column sm={4} md={4} lg={8}>
          <Select id="r-conf" labelText="Confidence" value={d.confidence || 'assumption'} onChange={set('confidence')}>
            {Object.keys(CONFIDENCE_META).map((c) => (
              <SelectItem key={c} value={c} text={CONFIDENCE_META[c].label} />
            ))}
          </Select>
        </Column>
        <Column sm={4} md={8} lg={16}>
          <TextArea
            id="r-formula" labelText="Formula" rows={2}
            value={d.formula || ''} onChange={set('formula')}
            helperText="Reference other rows by id. Supported: + - * / ( ), comparisons, IF(cond,a,b), MIN, MAX, ROUND, ABS, SUM."
          />
        </Column>
        <Column sm={4} md={8} lg={16}>
          <h5 className="apo-panel__h" style={{ marginTop: '1rem' }}>Provenance — required for every row</h5>
        </Column>
        <Column sm={4} md={4} lg={8}>
          <TextArea id="p-what" labelText="What it is"        rows={2} value={d.what   || ''} onChange={set('what')} />
        </Column>
        <Column sm={4} md={4} lg={8}>
          <TextArea id="p-why"  labelText="Why it matters"    rows={2} value={d.why    || ''} onChange={set('why')} />
        </Column>
        <Column sm={4} md={4} lg={8}>
          <TextArea id="p-how"  labelText="How it was derived" rows={2} value={d.how   || ''} onChange={set('how')} />
        </Column>
        <Column sm={4} md={4} lg={8}>
          <TextArea id="p-source" labelText="Source"           rows={2} value={d.source || ''} onChange={set('source')} />
        </Column>
      </Grid>
    </Modal>
  );
}

// ─────────────────────── helpers ───────────────────────
function blankDraft() {
  return {
    id: '', label: '', section: 'A', kind: 'input', format: 'currency',
    value: 0, confidence: 'placeholder', formula: '',
    what: '', why: '', how: '', source: '',
  };
}

function cleanDraft(d) {
  return {
    id:         d.id,
    label:      d.label,
    section:    d.section,
    kind:       d.kind,
    format:     d.format,
    value:      d.formula ? undefined : Number(d.value ?? 0),
    formula:    d.formula || undefined,
    confidence: d.confidence,
    emphasis:   d.emphasis || false,
    provenance: { what: d.what, why: d.why, how: d.how, source: d.source },
  };
}

function download(text, filename, mime) {
  const blob = new Blob([text], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
