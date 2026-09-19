import { useEffect, useState } from 'react';
import { FiUserPlus, FiCopy, FiCheck } from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  phone: '',
  subjects: '',
  formClass: '',
  qualification: '',
  address: ''
};

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api('/admin/teachers')
      .then(setTeachers)
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setCredentials(null);
    try {
      const res = await api('/admin/teachers', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setMessage('Teacher enrolled successfully');
      setCredentials({
        name: res.teacher.name,
        email: res.credentials.email,
        password: res.credentials.password,
        staffNo: res.teacher.staffNo
      });
      setForm(emptyForm);
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const copyCredentials = () => {
    if (!credentials) return;
    const text = `Login credentials\nEmail: ${credentials.email}\nPassword: ${credentials.password}\nStaff No: ${credentials.staffNo}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return <div className="loader">Loading…</div>;

  return (
    <div>
      <PageHeader
        title="Teachers"
        subtitle="Enroll new staff — a login account is created automatically"
      />

      {message && <div className="alert alert--info">{message}</div>}

      {credentials && (
        <div className="card credentials-card">
          <div className="credentials-card__head">
            <h3><FiCheck size={16} /> Account Created — Share These With the Teacher</h3>
            <button className="btn btn--ghost" onClick={copyCredentials}>
              {copied ? <><FiCheck size={14} /> Copied</> : <><FiCopy size={14} /> Copy</>}
            </button>
          </div>
          <div className="credentials-card__body">
            <div><strong>Name:</strong> {credentials.name}</div>
            <div><strong>Email:</strong> <code>{credentials.email}</code></div>
            <div><strong>Password:</strong> <code>{credentials.password}</code></div>
            <div><strong>Staff No:</strong> {credentials.staffNo}</div>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            The teacher can log in immediately with these details.
          </p>
        </div>
      )}

      <div className="card">
        <h3><FiUserPlus size={16} /> Enroll New Teacher</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>Full Name
            <input name="name" value={form.name} onChange={handleChange} required />
          </label>
          <label>Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="teacher@school.com"
              required
            />
          </label>
          <label>Password
            <input
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder=""
            />
          </label>
          <label>Phone
            <input name="phone" value={form.phone} onChange={handleChange} />
          </label>
          <label>Subjects
            <input
              name="subjects"
              value={form.subjects}
              onChange={handleChange}
              placeholder="Mathematics, Further Mathematics"
            />
          </label>
          <label>Form Class
            <input
              name="formClass"
              value={form.formClass}
              onChange={handleChange}
              placeholder="JSS 2A"
            />
          </label>
          <label>Qualification
            <input
              name="qualification"
              value={form.qualification}
              onChange={handleChange}
              placeholder="B.Sc Mathematics, PGDE"
            />
          </label>
          <label className="form-grid__full">Address
            <input name="address" value={form.address} onChange={handleChange} />
          </label>
          <div className="form-grid__full">
            <button className="btn btn--primary">
              <FiUserPlus size={16} /> Enroll Teacher
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>All Teachers ({teachers.length})</h3>
        <table className="table table--striped">
          <thead>
            <tr>
              <th>#</th><th>Name</th><th>Staff No</th><th>Email</th>
              <th>Subjects</th><th>Form Class</th><th>Phone</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t, i) => (
              <tr key={t.id}>
                <td>{i + 1}</td>
                <td>{t.name}</td>
                <td>{t.staffNo}</td>
                <td>{t.email}</td>
                <td>{t.subjects.join(', ') || '—'}</td>
                <td>{t.formClass}</td>
                <td>{t.phone || '—'}</td>
              </tr>
            ))}
            {!teachers.length && (
              <tr><td colSpan="7" className="muted">No teachers enrolled yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}