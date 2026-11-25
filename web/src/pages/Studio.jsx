import { useState } from 'react';
import { get, post } from '../api.js';
import { Field, Notice, NationSelect, Gated, SvgBox, useLoad, Loading } from '../ui.jsx';

const ROOM_TYPES = [['bedroom', 'Bedroom'], ['living', 'Living room'], ['kitchen', 'Kitchen'], ['bathroom', 'Bathroom'], ['other', 'Other']];

const TAB_GUIDE = {
  land: ['Title: who owns it, and any rights or burdens on it', 'Access to the road and services', 'Ground conditions to ask the engineer about', 'Planning history on the council’s portal'],
  planning: ['What the project needs: see each project’s draft scope', 'Pre-application advice from the council', 'Neighbours and any conservation area', 'Who submits: your architect or agent'],
  foundations: ['Soil and ground water questions for the structural engineer', 'Drainage runs and connections', 'Trees and boundaries near the work'],
  building: ['Approvals before work starts (building warrant in Scotland)', 'Order of works and who does each part', 'Inspections and the completion sign-off'],
  development: ['All costs with a contingency', 'Timeline and finance costs', 'Exit: sell, rent or refinance, each tested in the calculators'],
};

function Project({ id, onBack }) {
  const p = useLoad(() => get(`/studio/projects/${id}`), [id]);
  const scope = useLoad(() => get(`/studio/projects/${id}/scope`), [id]);
  const [view, setView] = useState('scope');
  const [extra, setExtra] = useState(null);
  const [err, setErr] = useState(null);
  const [exportErr, setExportErr] = useState(null);
  const show = async (which) => {
    setView(which);
    setErr(null);
    setExtra(null);
    try {
      if (which === 'preview') setExtra(await get(`/studio/projects/${id}/preview`));
      if (which === 'model') setExtra(await get(`/studio/projects/${id}/model`));
      if (which === 'walk') setExtra({ bare: await get(`/studio/projects/${id}/walkthrough`), full: await get(`/studio/projects/${id}/walkthrough?furnished=true`) });
    } catch (e) {
      setErr(e.message);
    }
  };
  const exportPlan = async () => {
    setExportErr(null);
    try {
      await post(`/studio/projects/${id}/export`);
    } catch (e) {
      setExportErr(`${e.message}${e.reason ? ` ${e.reason}` : ''}`);
    }
  };
  const hasRooms = p.data?.inputs?.rooms?.length;
  return (
    <Loading state={p}>
      {(proj) => (
        <div className="stack">
          <button className="btn secondary" type="button" onClick={onBack}>Back to projects</button>
          <h2>{proj.title}</h2>
          <div className="tabs" role="tablist">
            {[['scope', 'Draft scope'], ['preview', 'Plan'], ['model', '3D floorplan'], ['walk', '3D walkthrough']].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={view === k} disabled={k !== 'scope' && !hasRooms} onClick={() => show(k)}>{label}</button>
            ))}
          </div>
          <Notice kind="warn">{err}</Notice>
          {view === 'scope' ? (
            <Loading state={scope}>
              {(s) => (
                <div className="stack">
                  <Notice kind="warn">{s.label}</Notice>
                  <p><strong>{s.project.type}</strong>{s.totalArea ? `, about ${s.totalArea} square metres in the plan` : ''}</p>
                  <h3>What the work involves</h3>
                  <ul>{s.scope.map((x) => <li key={x}>{x}</li>)}</ul>
                  <h3>Approvals in this nation</h3>
                  <p>{s.permissions.planning}</p>
                  <p>{s.permissions.building}</p>
                  <p className="small"><span className="badge off">To check</span> <a href={s.permissions.source} target="_blank" rel="noreferrer noopener">{s.permissions.source}</a></p>
                  <h3>Who you will need</h3>
                  <ul>{s.professionals.map((x) => <li key={x}>{x}</li>)}</ul>
                  {s.solicitorGate ? <Notice kind="info">Title splitting is a legal step. It stays locked until a solicitor’s sign-off is recorded for this project.</Notice> : null}
                </div>
              )}
            </Loading>
          ) : null}
          {view === 'preview' && extra?.svg ? <SvgBox svg={extra.svg} label="Draft floor plan" /> : null}
          {view === 'model' && extra?.boxes ? (
            <div className="card small">
              <p>{extra.label}</p>
              <p>{extra.rooms.length} rooms built as {extra.boxes.length} parts (floors and walls), in metres. {extra.note}</p>
              <p className="muted">The 3D viewer comes next. This is the model it will show.</p>
            </div>
          ) : null}
          {view === 'walk' && extra?.bare ? (
            <div className="grid">
              {[extra.bare, extra.full].map((w) => (
                <div key={w.version} className="card small">
                  <h3 style={{ textTransform: 'capitalize' }}>{w.version}</h3>
                  <p>{w.label}</p>
                  <ol>{w.stops.map((s) => <li key={s.room}>{s.room}</li>)}</ol>
                  {w.furniture.length ? <p>{w.furniture.length} pieces of illustrative furniture.</p> : null}
                </div>
              ))}
            </div>
          ) : null}
          <h3>Export</h3>
          <button className="btn" type="button" onClick={exportPlan}>Export the plan</button>
          <Notice kind="warn">{exportErr}</Notice>
          <p className="small muted">Export opens only once a qualified person (architect, structural engineer or building control) has signed off this project in the compliance register.</p>
        </div>
      )}
    </Loading>
  );
}

function NewProject({ types, onCreated }) {
  const [f, setF] = useState({ type: types[0]?.id || 'loft', title: '', nation: 'scotland' });
  const [rooms, setRooms] = useState([{ name: 'Room 1', type: 'bedroom', x: 0, y: 0, w: 4, d: 3.5 }]);
  const [err, setErr] = useState(null);
  const setRoom = (i, k, v) => setRooms(rooms.map((r, j) => (j === i ? { ...r, [k]: k === 'name' || k === 'type' ? v : v } : r)));
  const create = async () => {
    setErr(null);
    try {
      const p = await post('/studio/projects', { ...f, rooms: rooms.map((r) => ({ ...r, x: Number(r.x), y: Number(r.y), w: Number(r.w), d: Number(r.d) })) });
      onCreated(p.id);
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <div className="card stack">
      <h2 style={{ marginTop: 0 }}>New project</h2>
      <div className="grid">
        <Field label="Project type">
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Name"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Where the property is"><NationSelect value={f.nation} onChange={(v) => setF({ ...f, nation: v })} /></Field>
      </div>
      <h3>Floor plan</h3>
      <p className="small muted">One line per room, in metres. Across and down give the room’s top-left corner on the plan.</p>
      {rooms.map((r, i) => (
        <div className="row" key={i}>
          <input style={{ maxWidth: 140 }} aria-label="Room name" value={r.name} onChange={(e) => setRoom(i, 'name', e.target.value)} />
          <select style={{ maxWidth: 140 }} aria-label="Room type" value={r.type} onChange={(e) => setRoom(i, 'type', e.target.value)}>
            {ROOM_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {[['x', 'Across'], ['y', 'Down'], ['w', 'Width'], ['d', 'Depth']].map(([k, l]) => (
            <input key={k} style={{ maxWidth: 80 }} aria-label={`${l} in metres`} title={l} inputMode="decimal" value={r[k]} onChange={(e) => setRoom(i, k, e.target.value)} />
          ))}
        </div>
      ))}
      <div className="row">
        <button className="btn secondary" type="button" onClick={() => setRooms([...rooms, { name: `Room ${rooms.length + 1}`, type: 'other', x: 0, y: rooms.reduce((m, r) => Math.max(m, Number(r.y) + Number(r.d)), 0), w: 3, d: 3 }])}>Add a room</button>
        <button className="btn" type="button" onClick={create}>Create project</button>
      </div>
      <Notice kind="warn">{err}</Notice>
    </div>
  );
}

export function StudioPage() {
  const home = useLoad(() => get('/studio'), []);
  const list = useLoad(() => get('/studio/projects'), []);
  const [open, setOpen] = useState(null);
  const [tab, setTab] = useState(null);
  const [mode, setMode] = useState(null);
  if (open) return <Project id={open} onBack={() => { setOpen(null); list.reload(); }} />;
  return (
    <Loading state={home}>
      {(h) => (
        <div className="stack">
          <h1>Developer Studio</h1>
          <Notice kind="warn">{h.draftLabel}</Notice>
          <div className="grid">
            {h.buttons.map((b) =>
              b.enabled ? (
                <button key={b.id} type="button" className="card link" style={{ textAlign: 'left', font: 'inherit', cursor: 'pointer' }} onClick={() => { setMode(b.id); setTab(null); }}>
                  <h3>{b.label}</h3>
                  <p className="small muted">{b.note}</p>
                </button>
              ) : (
                <div key={b.id} className="card">
                  <h3>{b.label}</h3>
                  <p className="small muted">{b.note}</p>
                  <Gated label="Locked" message={b.gate} />
                </div>
              ),
            )}
          </div>
          <div className="tabs" role="tablist">
            {h.tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setMode(null); }}>{t.label}</button>
            ))}
          </div>
          {tab ? (
            <div className="card">
              <h2 style={{ marginTop: 0 }}>{h.tabs.find((t) => t.id === tab).label}</h2>
              <p className="muted">{h.tabs.find((t) => t.id === tab).note}</p>
              <ul>{TAB_GUIDE[tab].map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ) : null}
          {mode ? <NewProject types={h.projectTypes} onCreated={(id) => { setOpen(id); list.reload(); }} /> : null}
          <h2>Your projects</h2>
          <Loading state={list}>
            {(items) => (items.length ? (
              <ul>{items.map((p) => <li key={p.id}><button type="button" className="btn secondary" onClick={() => setOpen(p.id)}>{p.title}</button> <span className="small muted">{p.type}, {p.nation.replace('_', ' ')}</span></li>)}</ul>
            ) : <p className="muted">No projects yet. Choose Extension planning, 3D floorplan or 3D walkthrough above to start one.</p>)}
          </Loading>
        </div>
      )}
    </Loading>
  );
}
