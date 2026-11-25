import { Fragment, useMemo, useState } from 'react';
import { get, post, money, pct } from '../api.js';
import { Field, Notice, NationSelect, Source, SvgBox, useLoad, Loading } from '../ui.jsx';
import { lineChart, heatGrid } from '../../../src/area/charts.js';

// Each calculator: its inputs (name, label, kind, default) and the figures to show.
const CALCS = {
  'purchase-tax': {
    title: 'Purchase tax',
    intro: 'LBTT in Scotland, LTT in Wales, SDLT in England and Northern Ireland.',
    inputs: [['price', 'Purchase price (pounds)', 'money', 200000], ['additionalDwelling', 'This is an additional home (second home or buy to let)', 'bool', false]],
    show: (r) => [['Tax', money(r.tax)], ['Effective rate', pct(r.effectiveRate)], ['Which tax', r.taxName], ...(r.surchargeApplied ? [['Surcharge', r.surchargeLabel]] : [])],
  },
  deal: {
    title: 'Deal calculator',
    intro: 'Purchase costs by nation, yields, monthly cashflow and exit profit.',
    inputs: [
      ['price', 'Purchase price', 'money', 150000],
      ['additionalDwelling', 'This is an additional home', 'bool', true],
      ['monthlyRent', 'Monthly rent', 'money', 900],
      ['purchaseFees', 'Purchase fees (legal, survey, other)', 'money', 2500],
      ['refurb', 'Refurbishment', 'money', 10000],
      ['annualRunningCosts', 'Annual running costs', 'money', 2400],
      ['monthlyMortgage', 'Monthly mortgage payment', 'money', 450],
      ['exitValue', 'Exit value', 'money', 185000],
    ],
  },
  refinance: {
    title: 'Refinance test',
    intro: 'How much a lender might lend, by loan to value and interest cover. The lower one wins. Your broker has the lender’s real figures.',
    nation: false,
    inputs: [
      ['value', 'Property value after works', 'money', 185000],
      ['currentLoan', 'Current loan', 'money', 100000],
      ['monthlyRent', 'Monthly rent', 'money', 900],
      ['maxLtv', 'Maximum loan to value (for example 0.75 for 75%)', 'number', 0.75],
      ['minIcr', 'Minimum interest cover (for example 1.25)', 'number', 1.25],
      ['stressRate', 'Stress test rate (for example 0.055 for 5.5%)', 'number', 0.055],
    ],
  },
  auction: {
    title: 'Auction maximum bid',
    intro: 'The highest bid that keeps your target profit, after the buyer’s premium, purchase tax and fees.',
    inputs: [
      ['gdv', 'Value once done (GDV)', 'money', 200000],
      ['targetProfit', 'Target profit', 'money', 25000],
      ['premiumRate', 'Buyer’s premium rate (for example 0.02 for 2%)', 'number', 0.02],
      ['fixedFees', 'Fixed fees (legal pack, admin)', 'money', 1500],
      ['refurb', 'Refurbishment', 'money', 20000],
      ['sellingCostRate', 'Selling costs as a share of GDV', 'number', 0.03],
      ['additionalDwelling', 'This is an additional home', 'bool', true],
    ],
  },
};

function flatten(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj || {})) {
    if (['inputs', 'formulas', 'assumptions', 'breakdown', 'purchaseTax', 'note', 'source', 'asOf', 'checkedOn', 'ratesFrom', 'verified'].includes(k)) continue;
    if (typeof v === 'number') out.push([prefix + k, Math.abs(v) < 5 && !Number.isInteger(v) ? pct(v) : money(v)]);
    else if (typeof v === 'boolean') out.push([prefix + k, v ? 'Yes' : 'No']);
    else if (typeof v === 'string' && v.length < 80) out.push([prefix + k, v]);
  }
  return out;
}

function words(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function Calculator({ id }) {
  const def = CALCS[id];
  const init = Object.fromEntries(def.inputs.map(([k, , , d]) => [k, d]));
  const [values, setValues] = useState({ ...init, nation: 'scotland' });
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const run = async (e) => {
    e.preventDefault();
    setErr(null);
    setResult(null);
    const body = { ...values };
    for (const [k, , kind] of def.inputs) {
      if (kind !== 'bool') body[k] = values[k] === '' ? '' : Number(values[k]);
    }
    if (def.nation === false) delete body.nation;
    try {
      setResult(await post(`/calc/${id}`, body));
    } catch (e2) {
      setErr(e2.message);
    }
  };
  const tax = result && (result.purchaseTax && typeof result.purchaseTax === 'object' ? result.purchaseTax : result.taxName ? result : null);
  const rows = result ? (def.show ? def.show(result) : flatten(result).map(([k, v]) => [words(k), v])) : [];
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      <form className="card" onSubmit={run}>
        <p className="small muted">{def.intro}</p>
        {def.nation === false ? null : <Field label="Where the property is"><NationSelect value={values.nation} onChange={(v) => setValues({ ...values, nation: v })} /></Field>}
        {def.inputs.map(([k, label, kind]) =>
          kind === 'bool' ? (
            <label key={k} className="check"><input type="checkbox" checked={values[k]} onChange={(e) => setValues({ ...values, [k]: e.target.checked })} /> <span>{label}</span></label>
          ) : (
            <Field key={k} label={label}><input inputMode="decimal" value={values[k]} onChange={(e) => setValues({ ...values, [k]: e.target.value })} /></Field>
          ),
        )}
        <button className="btn" type="submit">Work it out</button>
      </form>
      <div className="card result">
        <Notice kind="warn">{err}</Notice>
        {!result && !err ? <p className="muted">Fill in the figures and press Work it out. A blank, zero or absurd input is refused with a reason, never turned into a number.</p> : null}
        {result ? (
          <div className="stack">
            <dl>{rows.map(([k, v], i) => <Fragment key={`${k}-${i}`}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
            {result.formulas ? <><h3>How it was worked out</h3><ul className="small">{Object.values(result.formulas).map((f) => <li key={f}>{f}</li>)}</ul></> : null}
            {result.assumptions ? <><h3>Assumptions</h3><ul className="small">{result.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></> : null}
            {tax ? <Source href={tax.source}>{tax.note}</Source> : null}
            <p className="small muted">Arithmetic on your figures, not advice. Confirm tax with your accountant on your facts.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function HmoCheck() {
  const [nation, setNation] = useState('scotland');
  const [households, setHouseholds] = useState(3);
  const [rooms, setRooms] = useState([{ name: 'Room 1', areaM2: 9, occupants: 1 }, { name: 'Room 2', areaM2: 7, occupants: 1 }, { name: 'Room 3', areaM2: 11, occupants: 2 }]);
  const [r, setR] = useState(null);
  const [err, setErr] = useState(null);
  const run = async () => {
    setErr(null);
    try {
      setR(await post('/calc/hmo', { nation, households: Number(households), rooms: rooms.map((x) => ({ ...x, areaM2: Number(x.areaM2), occupants: Number(x.occupants) })) }));
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <div className="card stack">
      <div className="row">
        <div style={{ minWidth: 200 }}><Field label="Nation"><NationSelect value={nation} onChange={setNation} /></Field></div>
        <div style={{ width: 160 }}><Field label="Households"><input inputMode="numeric" value={households} onChange={(e) => setHouseholds(e.target.value)} /></Field></div>
      </div>
      {rooms.map((room, i) => (
        <div className="row" key={i}>
          <input style={{ maxWidth: 160 }} aria-label="Room name" value={room.name} onChange={(e) => setRooms(rooms.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <input style={{ maxWidth: 120 }} aria-label="Area in square metres" inputMode="decimal" value={room.areaM2} onChange={(e) => setRooms(rooms.map((x, j) => (j === i ? { ...x, areaM2: e.target.value } : x)))} />
          <select style={{ maxWidth: 140 }} aria-label="Sleeping" value={room.occupants} onChange={(e) => setRooms(rooms.map((x, j) => (j === i ? { ...x, occupants: Number(e.target.value) } : x)))}>
            <option value={1}>1 person</option>
            <option value={2}>2 people</option>
          </select>
        </div>
      ))}
      <div className="row">
        <button className="btn secondary" type="button" onClick={() => setRooms([...rooms, { name: `Room ${rooms.length + 1}`, areaM2: 8, occupants: 1 }])}>Add a room</button>
        <button className="btn" type="button" onClick={run}>Check</button>
      </div>
      <Notice kind="warn">{err}</Notice>
      {r ? (
        <div className="stack">
          <p><strong>Licence needed: {r.mandatoryLicenceNeeded === null ? 'check with the council' : r.mandatoryLicenceNeeded ? 'yes' : 'not by the national threshold'}</strong></p>
          {r.failingRooms.length ? <Notice kind="warn">Below the minimum size: {r.failingRooms.join(', ')}.</Notice> : null}
          <Source href={r.source}>{r.note}</Source>
        </div>
      ) : null}
    </div>
  );
}

export function CalculatorsPage() {
  const [tab, setTab] = useState('purchase-tax');
  return (
    <div className="stack">
      <h1>Calculators</h1>
      <div className="tabs" role="tablist">
        {[...Object.entries(CALCS).map(([id, d]) => [id, d.title]), ['hmo', 'HMO rooms']].map(([id, title]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{title}</button>
        ))}
      </div>
      {tab === 'hmo' ? <HmoCheck /> : <Calculator key={tab} id={tab} />}
    </div>
  );
}

// EXAMPLE figures only, made up to show how the charts read. No real area data is
// loaded yet; the sources below are where it will come from.
const EXAMPLE_SERIES = ['2021', '2022', '2023', '2024', '2025'].map((y, i) => ({ label: y, value: 150000 + i * 6500 + (i === 3 ? -4000 : 0) }));
const EXAMPLE_AREAS = [
  ['Example North', 0.051], ['Example Central', 0.024], ['Example East', 0.006], ['Example South', -0.012],
  ['Example West', -0.034], ['Example Coast', 0.038], ['Example Hills', -0.002], ['Example Town', 0.017],
];

export function AreaPage() {
  const sources = useLoad(() => get('/area/sources'), []);
  const chosen = document.documentElement.getAttribute('data-theme');
  const dark = chosen === 'dark' || (!chosen && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const mode = dark ? 'dark' : 'light';
  const line = useMemo(() => lineChart({ title: 'EXAMPLE: average sold price, Example Town', points: EXAMPLE_SERIES, source: 'Example data only, not real prices', mode }), [mode]);
  const heat = useMemo(() => heatGrid({ title: 'EXAMPLE: change in sold prices over one year', cells: EXAMPLE_AREAS.map(([name, value]) => ({ name, value })), source: 'Example data only, not real prices', mode }), [mode]);
  return (
    <div className="stack">
      <h1>Area maps</h1>
      <Notice kind="warn">These charts show EXAMPLE figures so you can see how they read. Real area data is not loaded yet.</Notice>
      <h2>Price over time</h2>
      <SvgBox svg={line} label="Example line chart of average sold price" />
      <h2>Rises and falls by area</h2>
      <SvgBox svg={heat} label="Example heat map of one-year price change" />
      <p className="small muted">Teal shows rises, clay shows falls, grey shows little change. Each area also shows its figure in words.</p>
      <h2>Where the data comes from</h2>
      <Loading state={sources}>
        {(d) => (
          <div className="stack">
            <div className="table-wrap">
              <table>
                <thead><tr><th scope="col">Source</th><th scope="col">Covers</th><th scope="col">Level</th><th scope="col">Licence</th></tr></thead>
                <tbody>
                  {d.sources.map((s) => (
                    <tr key={s.id}>
                      <td><a href={s.url} target="_blank" rel="noreferrer noopener">{s.name}</a><div className="small muted">{s.wording}</div></td>
                      <td>{s.kind}, {s.nation.replace(/_/g, ' ')}</td>
                      <td>{s.level}</td>
                      <td className="small">{s.licence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small">Never used: {d.blocked.map((b) => b.name).join(', ')}.</p>
            <p className="small muted">{d.disclaimer}</p>
          </div>
        )}
      </Loading>
    </div>
  );
}
