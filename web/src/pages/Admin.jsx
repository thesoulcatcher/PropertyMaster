import { useState } from 'react';
import { get, post, pence } from '../api.js';
import { Field, Notice, useLoad, Loading } from '../ui.jsx';

function Flags({ me }) {
  const state = useLoad(() => get('/admin/flags'), []);
  const [form, setForm] = useState({ row: 1, flag: '', professionalName: '', professionalRole: '', reference: '', signedOn: '' });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const owner = me.user.role === 'owner';
  const run = async (fn, ok) => {
    setMsg(null);
    setErr(null);
    try {
      await fn();
      setMsg(ok);
      state.reload();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Loading state={state}>
      {(d) => (
        <div className="stack">
          <Notice kind="info">{msg}</Notice>
          <Notice kind="warn">{err}</Notice>
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Feature</th><th scope="col">State</th><th scope="col">Gate</th></tr></thead>
              <tbody>
                {d.flags.map((f) => {
                  const signoff = d.signoffs.find((s) => s.flag === f.name);
                  return (
                    <tr key={f.name}>
                      <td>{f.name}</td>
                      <td>
                        <span className={`badge ${f.on ? 'ok' : 'off'}`}>{f.on ? 'On' : 'Off'}</span>
                        {owner && f.on ? <button className="btn secondary" type="button" style={{ marginLeft: 8 }} onClick={() => run(() => post(`/admin/flags/${f.name}`, { on: false }), `${f.name} switched off.`)}>Switch off</button> : null}
                        {owner && !f.on && signoff ? <button className="btn" type="button" style={{ marginLeft: 8 }} onClick={() => run(() => post(`/admin/flags/${f.name}`, { on: true, signoffId: signoff.id }), `${f.name} switched on.`)}>Switch on</button> : null}
                      </td>
                      <td className="small">{f.gate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {owner ? (
            <div className="card">
              <h3>Record a sign-off</h3>
              <p className="small muted">Only once the professional has signed. A feature can be switched on only with its sign-off recorded here.</p>
              <div className="grid">
                <Field label="Compliance row">
                  <select value={form.row} onChange={(e) => setForm({ ...form, row: Number(e.target.value) })}>
                    {d.register.map((r) => <option key={r.row} value={r.row}>{r.row}: {r.title}</option>)}
                  </select>
                </Field>
                <Field label="Feature">
                  <select value={form.flag} onChange={(e) => setForm({ ...form, flag: e.target.value })}>
                    <option value="">Choose</option>
                    {d.flags.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                  </select>
                </Field>
                <Field label="Professional's name"><input value={form.professionalName} onChange={(e) => setForm({ ...form, professionalName: e.target.value })} /></Field>
                <Field label="Their role"><input value={form.professionalRole} onChange={(e) => setForm({ ...form, professionalRole: e.target.value })} /></Field>
                <Field label="Reference of the signed document"><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
                <Field label="Date signed"><input type="date" value={form.signedOn} onChange={(e) => setForm({ ...form, signedOn: e.target.value })} /></Field>
              </div>
              <button className="btn" type="button" onClick={() => run(() => post('/admin/signoffs', { ...form, flag: form.flag || undefined }), 'Sign-off recorded.')}>Record sign-off</button>
            </div>
          ) : null}
          <h3>Compliance register</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Row</th><th scope="col">Area</th><th scope="col">Who signs it off</th><th scope="col">Check at</th></tr></thead>
              <tbody>{d.register.map((r) => <tr key={r.row}><td>{r.row}</td><td>{r.title}</td><td className="small">{r.who}</td><td className="small">{r.check}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
    </Loading>
  );
}

function Members() {
  const state = useLoad(() => get('/admin/members'), []);
  return (
    <Loading state={state}>
      {(list) => (
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Confirmed</th><th scope="col">Joined</th></tr></thead>
            <tbody>{list.map((u) => <tr key={u.id}><td>{u.displayName}</td><td>{u.email}</td><td>{u.role}</td><td>{u.emailVerified ? 'Yes' : 'No'}</td><td>{u.createdAt.slice(0, 10)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </Loading>
  );
}

function Audit() {
  const state = useLoad(() => get('/admin/audit?limit=200'), []);
  return (
    <Loading state={state}>
      {(rows) => (
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">When (UTC)</th><th scope="col">What</th><th scope="col">Target</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id}><td className="small">{r.at.replace('T', ' ').slice(0, 19)}</td><td>{r.action}</td><td className="small">{r.target || ''}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </Loading>
  );
}

function Revenue() {
  const state = useLoad(() => get('/admin/revenue'), []);
  return (
    <Loading state={state}>
      {(r) => (
        <div className="card result">
          <dl>
            <dt>Payments</dt><dd>{pence(r.paymentsPence)} from {r.paymentCount}</dd>
            <dt>Refunds approved</dt><dd>{pence(r.refundsPence)}</dd>
            <dt>Net</dt><dd>{pence(r.netPence)}</dd>
            <dt>Recommendations</dt><dd>{r.referrals.made} made, {r.referrals.rewarded} rewarded</dd>
          </dl>
          <p className="small muted" style={{ marginTop: '0.75rem' }}>{r.note}</p>
        </div>
      )}
    </Loading>
  );
}

export function AdminPage({ me }) {
  const [tab, setTab] = useState('flags');
  const tabs = [['flags', 'Features and sign-offs'], ['members', 'Members'], ['audit', 'Audit log'], ['revenue', 'Revenue']];
  return (
    <div className="stack">
      <h1>Admin</h1>
      <p className="small">Open the agent section as staff: <a href="#/?section=estate_agent">Propertymaster Estate Agent</a>.</p>
      <div className="tabs" role="tablist">
        {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'flags' ? <Flags me={me} /> : tab === 'members' ? <Members /> : tab === 'audit' ? <Audit /> : <Revenue />}
    </div>
  );
}
