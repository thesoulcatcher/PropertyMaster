import { useEffect, useState } from 'react';
import { post } from '../api.js';
import { Field, Notice, NationSelect } from '../ui.jsx';

function Narrow({ children }) {
  return <div style={{ maxWidth: 460, margin: '1rem auto' }} className="card">{children}</div>;
}

export function SignIn({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await post('/auth/sign-in', { email, password });
      await onSignedIn(r.token);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  return (
    <Narrow>
      <h1>Sign in</h1>
      <form onSubmit={submit}>
        <Field label="Email"><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Password"><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <Notice kind="warn">{error}</Notice>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
      </form>
      <p className="small" style={{ marginTop: '1rem' }}>
        New here? <a href="#/sign-up">Open an account</a>. Forgotten your password? <a href="#/reset-request">Reset it</a>.
      </p>
    </Narrow>
  );
}

export function SignUp() {
  const [f, setF] = useState({ displayName: '', email: '', password: '', accountType: 'member', nation: 'scotland', referralCode: '', terms: false, privacy: false, marketing: false });
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await post('/auth/sign-up', {
        displayName: f.displayName,
        email: f.email,
        password: f.password,
        accountType: f.accountType,
        nation: f.nation,
        referralCode: f.referralCode || undefined,
        consents: { terms: f.terms, privacy: f.privacy, marketing_email: f.marketing },
        source: 'website sign-up form',
      });
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
  };
  if (done) {
    return (
      <Narrow>
        <h1>Check your email</h1>
        <p>We have written you a message with a link to confirm your address. Your 14-day free trial has started.</p>
        <p className="small muted">While Propertymaster is being built, no email is sent: the message waits in the server's outbox.</p>
        <a className="btn" href="#/sign-in">Go to sign in</a>
      </Narrow>
    );
  }
  return (
    <Narrow>
      <h1>Open an account</h1>
      <form onSubmit={submit}>
        <Field label="I am">
          <select value={f.accountType} onChange={set('accountType')}>
            <option value="member">A developer or investor (Propertymaster)</option>
            <option value="estate_agent">An estate agent (Propertymaster Estate Agent)</option>
          </select>
        </Field>
        <Field label="Your name"><input value={f.displayName} onChange={set('displayName')} autoComplete="name" required /></Field>
        <Field label="Email"><input type="email" value={f.email} onChange={set('email')} autoComplete="email" required /></Field>
        <Field label="Password" hint="At least 10 characters."><input type="password" value={f.password} onChange={set('password')} autoComplete="new-password" required minLength={10} /></Field>
        <Field label="Where you invest most"><NationSelect value={f.nation} onChange={(v) => setF({ ...f, nation: v })} /></Field>
        <Field label="Friend's code (optional)" hint="You and your friend each get one free month when you make your first payment."><input value={f.referralCode} onChange={set('referralCode')} /></Field>
        <label className="check"><input type="checkbox" checked={f.terms} onChange={set('terms')} /> <span>I agree to the terms of use.</span></label>
        <label className="check"><input type="checkbox" checked={f.privacy} onChange={set('privacy')} /> <span>I have read the privacy notice.</span></label>
        <label className="check"><input type="checkbox" checked={f.marketing} onChange={set('marketing')} /> <span>Send me emails about offers and news (optional, you can stop them at any time).</span></label>
        <Notice kind="warn">{error}</Notice>
        <button className="btn" type="submit">Open my account</button>
      </form>
      <p className="small" style={{ marginTop: '1rem' }}>Already have an account? <a href="#/sign-in">Sign in</a>.</p>
    </Narrow>
  );
}

export function Verify({ token }) {
  const [state, setState] = useState('working');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!token) {
      setState('error');
      setMsg('This link has no code in it. Open the link from your email again.');
      return;
    }
    post('/auth/verify', { token })
      .then(() => setState('ok'))
      .catch((e) => {
        setState('error');
        setMsg(e.message);
      });
  }, [token]);
  return (
    <Narrow>
      <h1>Confirm your email</h1>
      {state === 'working' ? <p>Checking...</p> : state === 'ok' ? <><p>Thank you, your email is confirmed.</p><a className="btn" href="#/sign-in">Sign in</a></> : <Notice kind="warn">{msg}</Notice>}
    </Narrow>
  );
}

export function ResetRequest() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    await post('/auth/reset-request', { email }).catch(() => {});
    setSent(true);
  };
  return (
    <Narrow>
      <h1>Reset your password</h1>
      {sent ? (
        <p>If that email has an account, a reset link is on its way. It works for one hour.</p>
      ) : (
        <form onSubmit={submit}>
          <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <button className="btn" type="submit">Send the link</button>
        </form>
      )}
    </Narrow>
  );
}

export function Reset({ token }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await post('/auth/reset', { token, password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Narrow>
      <h1>Choose a new password</h1>
      {done ? (
        <><p>Your password is changed and you are signed out everywhere.</p><a className="btn" href="#/sign-in">Sign in</a></>
      ) : (
        <form onSubmit={submit}>
          <Field label="New password" hint="At least 10 characters."><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} autoComplete="new-password" /></Field>
          <Notice kind="warn">{error}</Notice>
          <button className="btn" type="submit">Save</button>
        </form>
      )}
    </Narrow>
  );
}
