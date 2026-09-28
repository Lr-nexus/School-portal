import { useEffect, useState } from 'react';
import { FiEdit2, FiSave, FiX, FiUser } from 'react-icons/fi';
import { api } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';
import ProfilePhotoCard from '../ProfilePhotoCard';
import ChangePasswordCard from '../../components/ChangePasswordCard';
import NotificationSettings from '../../components/NotificationSettings';

export default function AdminProfile() {
  const { updateUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api('/admin/me').then((data) => {
      setProfile(data);
      setForm(data);
    });

  useEffect(() => { load(); }, []);

  if (!profile) return <Loader />;

  const startEdit = () => { setForm(profile); setEditing(true); };
  const cancelEdit = () => { setForm(profile); setEditing(false); };
  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api('/admin/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          office: form.office,
          title: form.title,
        }),
      });
      setProfile(res.admin);
      setForm(res.admin);
      setEditing(false);
      toast.success('Profile updated');
      updateUser({ name: res.admin.name, email: res.admin.email });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const viewRows = [
    ['Name', profile.name],
    ['Title', profile.title],
    ['Email', profile.email],
    ['Phone', profile.phone || '—'],
    ['Office', profile.office || '—'],
    ['Date Appointed', profile.joined],
  ];

  return (
    <div>
      <PageHeader
        title="My Profile"
        subtitle={editing ? 'Edit your administrator details below' : 'Administrator account details'}
      >
        {!editing && (
          <button className="btn btn--primary" onClick={startEdit}>
            <FiEdit2 size={16} /> Edit Profile
          </button>
        )}
      </PageHeader>

      <ProfilePhotoCard
        currentPhoto={profile.photo}
        name={profile.name}
        onUploaded={(url) => {
          setProfile({ ...profile, photo: url });
          setForm({ ...form, photo: url });
          toast.success('Photo updated');
        }}
      />

      <div className="card profile-card">
        <div className="profile-card__head">
          <div className="avatar avatar--lg">{profile.name.charAt(0)}</div>
          <div>
            <h3>{profile.name}</h3>
            <p>{profile.title}</p>
          </div>
        </div>

        {!editing ? (
          <table className="table table--striped">
            <tbody>
              {viewRows.map(([k, v]) => (
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
              <label>Name
                <input name="name" value={form.name} onChange={handleChange} required />
              </label>
              <label>Title
                <input name="title" value={form.title || ''} onChange={handleChange}
                       placeholder="Principal" />
              </label>
              <label>Email
                <input type="email" name="email" value={form.email} onChange={handleChange} required />
              </label>
              <label>Phone
                <input name="phone" value={form.phone || ''} onChange={handleChange} />
              </label>
              <label className="form-grid__full">Office
                <input name="office" value={form.office || ''} onChange={handleChange}
                       placeholder="Principal's Office, Admin Block" />
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
              <FiUser size={12} /> Date appointed is managed by the school records office.
            </p>
          </form>
        )}
      </div>

      <NotificationSettings />
      <ChangePasswordCard />
    </div>
  );
}