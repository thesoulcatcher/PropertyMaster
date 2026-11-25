import { useState } from 'react';
import { get, post, patch, pence } from '../api.js';
import { Field, Notice, NationSelect, useLoad, Loading } from '../ui.jsx';

export function Home({ me, section }) {
  const plan = me.plan;
  const dev = section === 'developer';
  const tiles = dev
    ? [
        ['#/mentor', 'Property Mentor', 'Courses on strategies by nation, auctions, marketing, conveyancing, surveying and brokers.'],
        ['#/calculators', 'Calculators', 'Purchase tax by nation, deal, refinance, auction and HMO checks, with every step shown.'],
        ['#/law', 'Law by nation', 'Scotland, England, Wales and Northern Ireland side by side, each rule with its source and date.'],
        ['#/area', 'Area maps', 'House price trends, crime and flood information by area.'],
        ['#/studio', 'Developer Studio', 'Draft plans and scope for extensions, HMO refurbs, BRRR and more, with 3D floorplans.'],
        ['#/off-market', 'Off-Market Finder', 'Leads from lawful public sources and your own network.'],
      ]
    : [
        ['#/mentor', 'Property Mentor', 'Training for you and your team.'],
        ['#/area', 'Area maps', 'House price trends, crime and flood information by area, for your listings.'],
        ['#/law', 'Law by nation', 'Lettings and sales rules for each nation, with sources.'],
        ['#/off-market', 'Outreach', 'Vendor outreach tools, switched off until sign-off.'],
      ];
  return (
    <div className="stack">
      <h1>Welcome, {me.user.displayName}</h1>
      <p className="muted">{dev ? 'Propertymaster: for developers and investors.' : 'Propertymaster Estate Agent: for agencies and branches.'}</p>
      {!me.user.emailVerified ? <Notice kind="info">Please confirm your email address using the link we sent you.</Notice> : null}
      <Notice kind={plan.access ? 'info' : 'warn'}>{plan.message} <a href="#/plan">Your plan</a></Notice>
      <div className="grid">
        {tiles.map(([href, title, text]) => (
          <a key={href} className="card link" href={href}>
            <h3>{title}</h3>
            <p className="small muted">{text}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

export function PlanPage({ onChange }) {
  const plan = useLoad(() => get('/plan'), []);
  const tiers = useLoad(() => get('/plan/tiers'), []);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [code, setCode] = useState('');
  const act = async (fn) => {
    setMsg(null);
    setErr(null);
    try {
      const r = await fn();
      setMsg(r.message || r.reward || 'Done.');
      plan.reload();
      onChange();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <div className="stack">
      <h1>Your plan</h1>
      <Loading state={plan}>
        {(p) => (
          <div className="card stack">
            <p><strong>{p.message}</strong></p>
            {p.freeMonthsCredit ? <p>You have {p.freeMonthsCredit} free month{p.freeMonthsCredit > 1 ? 's' : ''} to use.</p> : null}
            <div className="row">
              {['trialing', 'active'].includes(p.state) ? <button className="btn secondary" type="button" onClick={() => act(() => post('/plan/cancel'))}>Cancel</button> : null}
              {['cancelling', 'trial_cancelled'].includes(p.state) ? <button className="btn" type="button" onClick={() => act(() => post('/plan/resume'))}>Keep my plan</button> : null}
              {p.state === 'active' || p.state === 'cancelling' ? <button className="btn secondary" type="button" onClick={() => act(() => post('/plan/refund', { reason: '' }))}>Ask for a refund</button> : null}
            </div>
            <p className="small muted">Cancelling takes one click. You keep access until the end of what you have paid for, or the end of your trial, and nothing more is charged.</p>
          </div>
        )}
      </Loading>
      <Notice kind="info">{msg}</Notice>
      <Notice kind="warn">{err}</Notice>
      <h2>Plans</h2>
      <Loading state={tiers}>
        {(list) => (
          <div className="grid">
            {list.map((t) => (
              <div key={t.id} className="card">
                <h3>{t.label}</h3>
                <p><strong>{t.priceSet ? `${pence(t.pricePenceMonthly)} a month` : 'Price to be set'}</strong></p>
                <ul className="small">{t.features.map((f) => <li key={f}>{f}</li>)}</ul>
                <button className="btn" type="button" disabled={!t.availability.available} aria-disabled={!t.availability.available}>Choose</button>
                {!t.availability.available ? <p className="small muted" style={{ marginTop: '0.4rem' }}>{t.availability.reason}</p> : null}
              </div>
            ))}
          </div>
        )}
      </Loading>
      <h2>Recommend a friend</h2>
      <div className="card">
        <p className="small">Got a code from a friend? Add it before your first payment. You each get one free month when you pay for the first time.</p>
        <div className="row">
          <input style={{ maxWidth: 220 }} value={code} onChange={(e) => setCode(e.target.value)} aria-label="Friend's code" />
          <button className="btn" type="button" onClick={() => act(() => post('/plan/referral', { code }))}>Add code</button>
        </div>
      </div>
    </div>
  );
}

function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SettingsPage({ me, onChange, onDeleted }) {
  const [name, setName] = useState(me.user.displayName);
  const [nation, setNation] = useState(me.user.nation || 'scotland');
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [delPw, setDelPw] = useState('');
  const s = me.user.settings;
  const run = async (fn, ok) => {
    setMsg(null);
    setErr(null);
    try {
      await fn();
      setMsg(ok);
      onChange();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <div className="stack">
      <h1>Settings</h1>
      <Notice kind="info">{msg}</Notice>
      <Notice kind="warn">{err}</Notice>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Profile</h2>
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Where you invest most"><NationSelect value={nation} onChange={setNation} /></Field>
        <button className="btn" type="button" onClick={() => run(() => patch('/me/profile', { displayName: name, nation }), 'Profile saved.')}>Save profile</button>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Display</h2>
        <Field label="Theme">
          <select value={s.theme} onChange={(e) => run(() => patch('/me/settings', { theme: e.target.value }), 'Theme saved.')}>
            <option value="system">Match my computer</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Field>
        <Field label="Text size">
          <select value={s.textSize} onChange={(e) => run(() => patch('/me/settings', { textSize: e.target.value }), 'Text size saved.')}>
            <option value="normal">Normal</option>
            <option value="large">Large</option>
          </select>
        </Field>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Your choices</h2>
        {[
          ['marketing_email', 'Emails about offers and news'],
          ['analytics', 'Share usage analytics with a third party'],
          ['ai_processing', 'Let the AI chat and roleplay process what I type'],
        ].map(([kind, label]) => (
          <label key={kind} className="check">
            <input type="checkbox" checked={me.consents[kind].granted} onChange={(e) => run(() => post('/me/consents', { kind, granted: e.target.checked }), 'Choice saved.')} />
            <span>{label}{me.consents[kind].at ? <span className="small muted"> (last changed {me.consents[kind].at.slice(0, 10)})</span> : null}</span>
          </label>
        ))}
        <p className="small muted">These are off unless you switch them on. Every change is recorded with its date.</p>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Password</h2>
        <Field label="Current password"><input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
        <Field label="New password" hint="At least 10 characters."><input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
        <button className="btn" type="button" onClick={() => run(() => post('/me/password', pw), 'Password changed.')}>Change password</button>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Your data</h2>
        <p className="small">Download everything Propertymaster holds about you, as one file.</p>
        <button className="btn secondary" type="button" onClick={() => run(async () => download('propertymaster-my-data.json', await get('/me/export')), 'Your data file is downloading.')}>Download my data</button>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Delete my account</h2>
        <p className="small">This erases your name, email, password, progress and projects, and ends your plan. It cannot be undone.</p>
        <Field label="Type your password to confirm"><input type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} autoComplete="current-password" /></Field>
        <button className="btn danger" type="button" disabled={!delPw} onClick={() => run(async () => { await post('/me/delete', { password: delPw }); onDeleted(); }, 'Your account is deleted.')}>Delete my account</button>
      </div>
    </div>
  );
}
