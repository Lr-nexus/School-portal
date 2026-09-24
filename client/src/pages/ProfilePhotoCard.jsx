import { useRef, useState } from 'react';
import { FiUpload, FiCamera } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const BASE_URL =
  (process.env.REACT_APP_BACKEND_URL ||
    process.env.REACT_APP_API_URL ||
    'https://school-portal-1-xaio.onrender.com/api'
  ).replace(/\/api\/?$/, '');

export default function ProfilePhotoCard({ currentPhoto, name, onUploaded }) {
  const { user, updateUser } = useAuth();
  const [preview, setPreview] = useState(currentPhoto || null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef(null);

  const pick = () => fileRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage('File too large (max 5 MB)');
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);
    setMessage('');

    try {
      const fd = new FormData();
      fd.append('photo', file);

      const res = await fetch(`${BASE_URL}/api/uploads/avatar`, {
        method: 'POST',
        headers: { 'X-User-Id': String(user?.id || '') },
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');

      setPreview(`${BASE_URL}${data.url}`);
      setMessage('Photo updated');
      updateUser({ photo: `${BASE_URL}${data.url}` });
      onUploaded?.(data.url);
    } catch (err) {
      setMessage(err.message);
      setPreview(currentPhoto);
    } finally {
      setUploading(false);
    }
  };

  const photoSrc = preview?.startsWith('http')
    ? preview
    : preview
      ? `${BASE_URL}${preview}`
      : null;

  return (
    <div className="card">
      <h3><FiCamera size={16} /> Profile Photo</h3>

      <div className="photo-uploader">
        <div className="photo-uploader__preview">
          {photoSrc ? (
            <img src={photoSrc} alt={name} />
          ) : (
            <span>{name?.charAt(0) || 'U'}</span>
          )}
        </div>

        <div className="photo-uploader__info">
          <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
            JPG, PNG, WEBP or GIF · max 5 MB
          </p>

          <button
            className="btn btn--primary"
            onClick={pick}
            disabled={uploading}
          >
            <FiUpload size={14} /> {uploading ? 'Uploading…' : 'Choose Photo'}
          </button>

          {message && (
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              {message}
            </p>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
    </div>
  );
}