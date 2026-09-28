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

export default function StudentProfile() {
  const { updateUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api('/students/me').then((data) => {
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
      const payload = {
        name: form.name,
        gender: form.gender,
        dob: form.dob,
        email: form.email,
        guardianName: form.guardianName,
        guardianPhone: form.guardianPhone,
        address: form.address,
      };
      const res = await api('/students/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setProfile(res.student);
      setForm(res.student);
      setEditing(false);
      toast.success('Profile updated');
      updateUser({ name: res.student.name, email: res.student.email });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const viewRows = [
    ['Full Name', profile.name],
    ['Admission Number', profile.admissionNo],
    ['Class', profile.className],
    ['House', profile.house],
    ['Gender', profile.gender],
    ['Date of Birth', profile.dob || '—'],
    ['Email', profile.email || '—'],
    ['Guardian', profile.guardianName || '—'],
    ['Guardian Phone', profile.guardianPhone || '—'],
    ['Address', profile.address || '—'],
  ];

  return (
    <div>
      <PageHeader
        title="My Profile"
        subtitle={editing ? 'Edit your details below' : 'Your personal and academic information'}
      >
        {!editing && (
          <button className="btn btn--primary" onClick={startEdit}>
            <FiEdit2 size={16} /> Edit Profile
          </button>
        )}
      </PageHeader>

      {/* ⭐ Profile photo uploader */}
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
            <p>{profile.className} · {profile.admissionNo}</p>
          </div>
        </div>

        {!editing ? (
          <table className="table table--striped">
            <tbody>
              {viewRows.map(([label, value]) => (
                <tr key={label}>
                  <td className="table__label">{label}</td>
                  <td>{value}</td>
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
              <label>Gender
                <select name="gender" value={form.gender} onChange={handleChange}>
                  <option>Female</option>
                  <option>Male</option>
                </select>
              </label>
              <label>Date of Birth
                <input type="date" name="dob" value={form.dob || ''} onChange={handleChange} />
              </label>
              <label>Email
                <input type="email" name="email" value={form.email || ''} onChange={handleChange} />
              </label>
              <label>Guardian Name
                <input name="guardianName" value={form.guardianName || ''} onChange={handleChange} />
              </label>
              <label>Guardian Phone
                <input name="guardianPhone" value={form.guardianPhone || ''} onChange={handleChange} />
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
              <FiUser size={12} /> Admission number, class and house are managed by the school office.
            </p>
          </form>
        )}
      </div>
      
      <NotificationSettings />
      <ChangePasswordCard />
    </div>
  );
}