const BASE_URL =
  (process.env.REACT_APP_BACKEND_URL ||
    process.env.REACT_APP_API_URL ||
    'https://school-portal-1-xaio.onrender.com/api'
  ).replace(/\/api\/?$/, '');

/**
 * Avatar that shows a photo if present, otherwise the initial letter.
 *
 * @param {string}  photo — raw URL (Cloudinary "https://…" or local "/uploads/…")
 * @param {string}  name  — used for alt text and fallback initial
 * @param {string}  size  — 'sm' | 'lg' (default: 'lg')
 */
export default function ProfileAvatar({ photo, name, size = 'lg' }) {
  const src = photo
    ? photo.startsWith('http')
      ? photo
      : `${BASE_URL}${photo}`
    : null;

  return (
    <div className={`avatar avatar--${size}`}>
      {src ? (
        <img src={src} alt={name || ''} />
      ) : (
        name?.charAt(0) || 'U'
      )}
    </div>
  );
}