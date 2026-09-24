import { useEffect, useState } from 'react';
import { FiEdit2, FiSave, FiX, FiUser } from 'react-icons/fi';
import { api } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';
import ProfilePhotoCard from '../ProfilePhotoCard';
import ChangePasswordCard from '../../components/ChangePasswordCard';

export default function ParentProfile() {
  const { updateUser } = useAuth();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = () =>
    api('/parents/me').then((res) => {
      setData(res);
      setForm(res.parent);
    });

  useEffect(() => { load(); }, []);

  if (!data) return <Loader />;

  const startEdit = () => { setForm(data.parent); setEditing(true); setMessage(''); };
  const cancelEdit = () => { setForm(data.parent); setEditing(false); setMessage(''); };
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api('/parents/me', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setData({ ...data, parent: res.parent });
      setForm(res.parent);
      setEditing(false);
      setMessage('Profile updated');
      updateUser({ name: res.parent.name, email: res.parent.email });
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const p = data.parent;
  const rows = [
    ['Full Name', p.name],
    ['Email', p.email],
    ['Phone', p.phone || '—'],
    ['Relationship', p.relationship || '—'],
    ['Address', p.address || '—'],
  ];

  return (
    <div>
      <PageHeader
        title="My Profile"
        subtitle={editing ? 'Edit your details' : 'Parent / Guardian account'}
      >
        {!editing && (
          <button className="btn btn--primary" onClick={startEdit}>
            <FiEdit2 size={16} /> Edit Profile
          </button>
        )}
      </PageHeader>

      {message && <div className="alert alert--info">{message}</div>}

      <ProfilePhotoCard
        currentPhoto={p.photo}
        name={p.name}
        onUploaded={(url) => setData({ ...data, parent: { ...p, photo: url } })}
      />

      <div className="card profile-card">
        <div className="profile-card__head">
          <div className="avatar avatar--lg">{p.name.charAt(0)}</div>
          <div>
            <h3>{p.name}</h3>
            <p>{p.relationship || 'Guardian'}</p>
          </div>
        </div>

        {!editing ? (
          <table className="table table--striped">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td className="table__label">{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <form onSubmit={save}>
            <div className="form-grid">
              <label>Full Name
                <input name="name" value={form.name} onChange={handleChange} required />
              </label>
              <label>Email
                <input type="email" name="email" value={form.email} onChange={handleChange} required />
              </label>
              <label>Phone
                <input name="phone" value={form.phone || ''} onChange={handleChange} />
              </label>
              <label>Relationship
                <select name="relationship" value={form.relationship || 'Guardian'} onChange={handleChange}>
                  <option>Father</option>
                  <option>Mother</option>
                  <option>Guardian</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="form-grid__full">Address
                <input name="address" value={form.address || ''} onChange={handleChange} />
              </label>
            </div>

            <div className="profile-form__actions">
              <button type="button" className="btn btn--ghost" onClick={cancelEdit}>
                <FiX size={16} /> Cancel
              </button>
              <button className="btn btn--primary" disabled={saving}>
                <FiSave size={16} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>

            <p className="muted" style={{ marginTop: 8 }}>
              <FiUser size={12} /> Your child's academic records are managed by the school office.
            </p>
          </form>
        )}
      </div>

      <ChangePasswordCard />
    </div>
  );
}