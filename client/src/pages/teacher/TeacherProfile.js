import { useEffect, useState } from 'react';
import { FiEdit2, FiSave, FiX, FiUser } from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';
import ChangePasswordCard from '../../components/ChangePasswordCard';

export default function TeacherProfile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = () =>
    api('/teachers/me').then((data) => {
      setProfile(data);
      setForm({ ...data, subjects: (data.subjects || []).join(', ') });
    });

  useEffect(() => { load(); }, []);

  if (!profile) return <Loader />;

  const startEdit = () => {
    setForm({ ...profile, subjects: (profile.subjects || []).join(', ') });
    setEditing(true);
    setMessage('');
  };

  const cancelEdit = () => {
    setForm({ ...profile, subjects: (profile.subjects || []).join(', ') });
    setEditing(false);
    setMessage('');
  };

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api('/teachers/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          subjects: form.subjects,
          formClass: form.formClass,
          qualification: form.qualification,
          address: form.address
        })
      });
      setProfile(res.teacher);
      setForm({ ...res.teacher, subjects: (res.teacher.subjects || []).join(', ') });
      setEditing(false);
      setMessage('Profile updated');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const viewRows = [
    ['Full Name', profile.name],
    ['Staff Number', profile.staffNo],
    ['Email', profile.email],
    ['Phone', profile.phone || '—'],
    ['Subjects', (profile.subjects || []).join(', ') || '—'],
    ['Form Class', profile.formClass || '—'],
    ['Qualification', profile.qualification || '—'],
    ['Address', profile.address || '—'],
    ['Date Joined', profile.joined]
  ];

  return (
    <div>
      <PageHeader
        title="My Profile"
        subtitle={editing ? 'Edit your staff details below' : 'Your staff information'}
      >
        {!editing && (
          <button className="btn btn--primary" onClick={startEdit}>
            <FiEdit2 size={16} /> Edit Profile
          </button>
        )}
      </PageHeader>

      {message && <div className="alert alert--info">{message}</div>}

      <div className="card profile-card">
        <div className="profile-card__head">
          <div className="avatar avatar--lg">{profile.name.charAt(0)}</div>
          <div>
            <h3>{profile.name}</h3>
            <p>{(profile.subjects || []).join(' · ')}</p>
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
              <label>Full Name
                <input name="name" value={form.name} onChange={handleChange} required />
              </label>
              <label>Email
                <input type="email" name="email" value={form.email} onChange={handleChange} required />
              </label>
              <label>Phone
                <input name="phone" value={form.phone || ''} onChange={handleChange} />
              </label>
              <label>Subjects (comma separated)
                <input name="subjects" value={form.subjects || ''} onChange={handleChange} />
              </label>
              <label>Form Class
                <input name="formClass" value={form.formClass || ''} onChange={handleChange} />
              </label>
              <label>Qualification
                <input name="qualification" value={form.qualification || ''} onChange={handleChange} />
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
              <FiUser size={12} /> Staff number and date joined are managed by the school office.
            </p>
          </form>
        )}
      </div>

      <ChangePasswordCard />
    </div>
  );
}