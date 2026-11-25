import { useEffect, useState, useCallback } from 'react';
import { get, post, getToken, setToken } from './api.js';
import { SignIn, SignUp, Verify, ResetRequest, Reset } from './pages/Auth.jsx';
import { Home, PlanPage, SettingsPage } from './pages/Member.jsx';
import { MentorList, CoursePage, LessonPage, LawPage } from './pages/Learn.jsx';
import { CalculatorsPage, AreaPage } from './pages/Tools.jsx';
import { StudioPage } from './pages/Studio.jsx';
import { MenusPage } from './pages/Menus.jsx';
import { AdminPage } from './pages/Admin.jsx';

// Hash routes keep the site working as plain files in the desktop app too.
function useRoute() {
  const read = () => {
    const raw = window.location.hash.replace(/^#/, '') || '/';
    const [path, query = ''] = raw.split('?');
    return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(query) };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(path) {
  window.location.hash = path;
}

const NAV = {
  developer: [
    ['/', 'Home'],
    ['/mentor', 'Property Mentor'],
    ['/law', 'Law by nation'],
    ['/calculators', 'Calculators'],
    ['/area', 'Area maps'],
    ['/studio', 'Developer Studio'],
    ['/off-market', 'Off-Market Finder'],
  ],
  estate_agent: [
    ['/', 'Home'],
    ['/mentor', 'Property Mentor'],
    ['/law', 'Law by nation'],
    ['/area', 'Area maps'],
    ['/off-market', 'Outreach'],
  ],
};

function applyTheme(settings) {
  const root = document.documentElement;
  if (!settings || settings.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', settings.theme);
  if (settings && settings.textSize === 'large') root.setAttribute('data-text', 'large');
  else root.removeAttribute('data-text');
}

export function App() {
  const route = useRoute();
  const [me, setMe] = useState(null);
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      setChecked(true);
      return;
    }
    try {
      const data = await get('/me');
      setMe(data);
      applyTheme(data.user.settings);
    } catch {
      setMe(null);
    }
    setChecked(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signedIn = async (token) => {
    setToken(token);
    await refresh();
    go('/');
  };

  const signOut = async () => {
    try {
      await post('/auth/sign-out');
    } catch {
      /* already signed out */
    }
    setToken(null);
    setMe(null);
    applyTheme(null);
    go('/sign-in');
  };

  if (!checked) return <main><p className="muted">Loading...</p></main>;

  const open = ['sign-in', 'sign-up', 'verify', 'reset-request', 'reset'];
  const first = route.parts[0] || '';
  if (!me || open.includes(first)) {
    return (
      <>
        <header className="topbar">
          <a className="brand" href="#/sign-in">
            <img src="/favicon.svg" alt="" width="28" height="28" /> Propertymaster
          </a>
        </header>
        <main>
          {first === 'sign-up' ? <SignUp /> : first === 'verify' ? <Verify token={route.query.get('token')} /> : first === 'reset-request' ? <ResetRequest /> : first === 'reset' ? <Reset token={route.query.get('token')} /> : <SignIn onSignedIn={signedIn} />}
        </main>
      </>
    );
  }

  // Staff can open both sections; everyone else sees the section their login gives.
  const staff = me.sections.length > 1;
  const section = staff && route.query.get('section') === 'estate_agent' ? 'estate_agent' : me.home;
  const nav = [...NAV[section]];
  if (staff) nav.push(['/admin', 'Admin']);

  let page;
  switch (first) {
    case '':
      page = <Home me={me} section={section} />;
      break;
    case 'mentor':
      page = route.parts[1] && route.parts[2] === 'lesson' ? <LessonPage courseId={route.parts[1]} lessonId={route.parts[3]} /> : route.parts[1] ? <CoursePage courseId={route.parts[1]} /> : <MentorList />;
      break;
    case 'law':
      page = <LawPage />;
      break;
    case 'calculators':
      page = <CalculatorsPage />;
      break;
    case 'area':
      page = <AreaPage />;
      break;
    case 'studio':
      page = me.sections.includes('developer') ? <StudioPage /> : <p>Developer Studio is part of the developer and investor section.</p>;
      break;
    case 'off-market':
      page = <MenusPage section={section} />;
      break;
    case 'plan':
      page = <PlanPage onChange={refresh} />;
      break;
    case 'settings':
      page = <SettingsPage me={me} onChange={refresh} onDeleted={signOut} />;
      break;
    case 'admin':
      page = staff ? <AdminPage me={me} /> : <p>Admin is for staff accounts.</p>;
      break;
    default:
      page = <p>That page was not found. <a href="#/">Go home</a>.</p>;
  }

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#/">
          <img src="/favicon.svg" alt="" width="28" height="28" /> Propertymaster
          {section === 'estate_agent' ? <small>Estate Agent</small> : null}
        </a>
        <nav aria-label="Main">
          {nav.map(([href, label]) => (
            <a key={href} href={`#${href}`} className={route.path === href || (href !== '/' && route.path.startsWith(href)) ? 'active' : ''}>{label}</a>
          ))}
        </nav>
        <span className="who">{me.user.displayName}</span>
        <a className="btn secondary" style={{ color: 'var(--header-ink)', borderColor: 'var(--header-ink)' }} href="#/settings">Settings</a>
        <button className="btn secondary" style={{ color: 'var(--header-ink)', borderColor: 'var(--header-ink)' }} type="button" onClick={signOut}>Sign out</button>
      </header>
      <main>{page}</main>
    </>
  );
}
