/* Support both env var names — whichever is set will be used */
const BASE_URL =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_API_URL ||
  'https://school-portal-1-xaio.onrender.com/api';

/* Backend origin without the trailing `/api` — used for static files
   like `/uploads/xyz.pdf`, avatar URLs, etc. */
const SERVER_URL = BASE_URL.replace(/\/api\/?$/, '');

const STORAGE_KEY = 'user';

function currentUser() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function api(path, options = {}) {
  const user = currentUser();

  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  const res = await fetch(BASE_URL + path, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(user ? { 'X-User-Id': String(user.id) } : {}),
      ...(options.headers || {}),
    },
  });

  /* Some error paths return an empty body — guard against that */
  const text = await res.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = { message: text }; }
  }

  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

export { BASE_URL, SERVER_URL };