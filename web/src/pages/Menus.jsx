import { get } from '../api.js';
import { Gated, GATE_MESSAGE, useLoad, Loading } from '../ui.jsx';

function Menu({ menu }) {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{menu.title}</h2>
      <div className="grid">
        {menu.items.map((item) => (
          <div key={item.id} className="stack">
            <h3>{item.label}</h3>
            <p className="small muted">{item.note}</p>
            {item.enabled ? <span className="badge">Being built</span> : <Gated label={item.label} message={GATE_MESSAGE} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MenusPage({ section }) {
  const state = useLoad(() => get(`/menus/${section}`), [section]);
  return (
    <div className="stack">
      <h1>{section === 'estate_agent' ? 'Outreach' : 'Off-Market Finder'}</h1>
      <p className="muted">Leads from lawful public sources and your own network. Owner outreach stays switched off until a solicitor signs it off. Nothing is ever sent, called or posted automatically.</p>
      <Loading state={state}>
        {(d) => (
          <>
            <Menu menu={d.offMarket} />
            <Menu menu={d.outreach} />
          </>
        )}
      </Loading>
    </div>
  );
}
