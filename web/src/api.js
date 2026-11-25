// Talks to the Propertymaster API on this machine. The sign-in token is kept for
// this browser only; if storage is blocked it lives in memory until the tab closes.

let memoryToken = null;
const KEY = 'pm.session';

export function getToken() {
  try {
    return window.localStorage.getItem(KEY) || memoryToken;
  } catch {
    return memoryToken;
  }
}

export function setToken(token) {
  memoryToken = token;
  try {
    if (token) window.localStorage.setItem(KEY, token);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: memory only */
  }
}

export class ApiError extends Error {
  constructor(status, error) {
    super(error?.message || 'Something went wrong. Please try again.');
    this.status = status;
    this.code = error?.code;
    this.reason = error?.reason;
  }
}

export async function api(method, path, body) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, { message: 'The Propertymaster server is not answering. Check it is running on this computer.' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && path !== '/auth/sign-in') setToken(null);
    throw new ApiError(res.status, data.error);
  }
  return data;
}

export const get = (p) => api('GET', p);
export const post = (p, b = {}) => api('POST', p, b);
export const patch = (p, b = {}) => api('PATCH', p, b);

export function money(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return 'not yet supplied';
  return `£${Number(n).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
}

export function pence(p) {
  return p === null || p === undefined ? 'price to be set' : money(p / 100);
}

export function pct(r) {
  return Number.isFinite(r) ? `${Math.round(r * 10000) / 100}%` : 'not yet supplied';
}

export const NATIONS = [
  { id: 'scotland', label: 'Scotland' },
  { id: 'england', label: 'England' },
  { id: 'wales', label: 'Wales' },
  { id: 'northern_ireland', label: 'Northern Ireland' },
];
