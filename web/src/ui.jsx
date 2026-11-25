import { useEffect, useState, useCallback } from 'react';
import { NATIONS } from './api.js';

export const GATE_MESSAGE = 'This feature needs sign-off before it opens. Your Propertymaster team will tell you when it is ready.';

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function NationSelect({ value, onChange, id }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {NATIONS.map((n) => (
        <option key={n.id} value={n.id}>{n.label}</option>
      ))}
    </select>
  );
}

export function Notice({ kind = 'info', children }) {
  if (!children) return null;
  return <div className={`notice ${kind}`} role={kind === 'warn' ? 'alert' : 'status'}>{children}</div>;
}

// A control that is shown but switched off until its sign-off is recorded.
export function Gated({ label, message = GATE_MESSAGE }) {
  return (
    <div className="gate">
      <button className="btn secondary" type="button" disabled aria-disabled="true">{label}</button>
      <div style={{ marginTop: '0.4rem' }}>{message}</div>
    </div>
  );
}

export function Source({ href, children }) {
  return (
    <div className="source">
      {children}
      {href ? <> Source: <a href={href} target="_blank" rel="noreferrer noopener">{href}</a></> : null}
    </div>
  );
}

// Loads data once, with loading and error states, and a reload function.
export function useLoad(loader, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    loader()
      .then((data) => setState({ loading: false, data, error: null }))
      .catch((error) => setState({ loading: false, data: null, error }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(run, [run]);
  return { ...state, reload: run };
}

export function Loading({ state, children }) {
  if (state.loading && !state.data) return <p className="muted">Loading...</p>;
  if (state.error) return <Notice kind="warn">{state.error.message}</Notice>;
  return children(state.data);
}

export function SvgBox({ svg, label }) {
  return <div className="svg-box" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />;
}
