const BASE_URL = 'https://school-portal-1-xaio.onrender.com/api';
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
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || 'Something went wrong');
  }
  return data;
}