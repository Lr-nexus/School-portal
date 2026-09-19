import { useEffect, useState } from 'react';
import {
  FiUserPlus, FiCopy, FiCheck,
  FiTrash2, FiX, FiAlertTriangle
} from 'react-icons/fi';
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
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

    if (!form.email.trim()) {
      setMessage('Email is required');
      return;
    }

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
    const text =
      `Login credentials\n` +
      `Name: ${credentials.name}\n` +
      `Email: ${credentials.email}\n` +
      `Password: ${credentials.password}\n` +
      `Staff No: ${credentials.staffNo}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const performDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api(`/admin/teachers/${confirmDelete.id}`, { method: 'DELETE' });
      setMessage(`Removed ${confirmDelete.name}`);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setDeleting(false);
    }
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
            <h3><FiCheck size={16} /> Account Created — Share With the Teacher</h3>
            <button className="btn btn--ghost" onClick={copyCredentials}>
              {copied
                ? <><FiCheck size={14} /> Copied</>
                : <><FiCopy size={14} /> Copy</>}
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
          <label>Full Name *
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="John Bello"
              required
            />
          </label>
          <label>Email *
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="john@school.com"
              required
            />
          </label>
          <label>Password
            <input
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Leave blank → changeme123"
            />
          </label>
          <label>Phone
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="0802 000 1111"
            />
          </label>
          <label>Subjects (comma separated)
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
            <input
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="5 Unity Close, Ibadan"
            />
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
              <th>#</th>
              <th>Name</th>
              <th>Staff No</th>
              <th>Email</th>
              <th>Subjects</th>
              <th>Form Class</th>
              <th>Phone</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
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
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={() => setConfirmDelete(t)}
                    title="Remove teacher"
                  >
                    <FiTrash2 size={14} /> Remove
                  </button>
                </td>
              </tr>
            ))}
            {!teachers.length && (
              <tr>
                <td colSpan="8" className="muted">
                  No teachers enrolled yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div
          className="modal-backdrop"
          onClick={() => !deleting && setConfirmDelete(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3><FiAlertTriangle size={18} /> Remove Teacher?</h3>
              <button
                className="btn btn--ghost"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                <FiX size={16} />
              </button>
            </div>

            <p style={{ marginBottom: 8 }}>
              You are about to permanently remove{' '}
              <strong>{confirmDelete.name}</strong> ({confirmDelete.staffNo}).
            </p>

            <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
              This will delete:
            </p>
            <ul
              className="muted"
              style={{ fontSize: 13, marginLeft: 20, marginBottom: 16 }}
            >
              <li>The teacher's login account</li>
              <li>Their uploaded notes and their comments</li>
              <li>Their assignments and student submissions</li>
              <li>Their quizzes and student submissions</li>
              <li>Their scheduled/live class sessions</li>
            </ul>

            <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
              Classes they were a form teacher of stay in the system with no teacher assigned.
            </p>

            <p className="muted" style={{ fontSize: 12, color: 'var(--red)' }}>
              This action cannot be undone.
            </p>

            <div className="modal__actions">
              <button
                className="btn btn--ghost"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn--danger"
                onClick={performDelete}
                disabled={deleting}
              >
                <FiTrash2 size={14} />{' '}
                {deleting ? 'Removing…' : 'Yes, Remove Teacher'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}