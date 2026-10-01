const BASE_URL =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_API_URL ||
  'https://school-portal-1-xaio.onrender.com/api';

const SERVER_URL = BASE_URL.replace(/\/api\/?$/, '');

const STORAGE_KEY = 'user';

function currentUser() {
  try {
    // ⭐ Check BOTH stores — "remember me" writes to localStorage,
    //   a normal login writes to sessionStorage.
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      sessionStorage.getItem(STORAGE_KEY);
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