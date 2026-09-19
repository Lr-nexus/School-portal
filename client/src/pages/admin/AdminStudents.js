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
  className: 'JSS 2A',
  gender: 'Female',
  guardianName: '',
  guardianPhone: '',
  address: ''
};

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () =>
    api('/admin/students')
      .then(setStudents)
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
      const res = await api('/admin/students', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setMessage('Student enrolled successfully');
      setCredentials({
        name: res.student.name,
        email: res.credentials.email,
        password: res.credentials.password,
        admissionNo: res.student.admissionNo
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
      `Admission No: ${credentials.admissionNo}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const performDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api(`/admin/students/${confirmDelete.id}`, { method: 'DELETE' });
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
        title="Students"
        subtitle="Enroll new students — a login account is created automatically"
      />

      {message && <div className="alert alert--info">{message}</div>}

      {credentials && (
        <div className="card credentials-card">
          <div className="credentials-card__head">
            <h3><FiCheck size={16} /> Account Created — Share With the Student</h3>
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
            <div><strong>Admission No:</strong> {credentials.admissionNo}</div>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            The student can log in immediately at the login page with these details.
          </p>
        </div>
      )}

      <div className="card">
        <h3><FiUserPlus size={16} /> Enroll New Student</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>Full Name *
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Ada Obi"
              required
            />
          </label>
          <label>Email *
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="ada@school.com"
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
          <label>Class *
            <input
              name="className"
              value={form.className}
              onChange={handleChange}
              placeholder="JSS 2A"
              required
            />
          </label>
          <label>Gender
            <select name="gender" value={form.gender} onChange={handleChange}>
              <option>Female</option>
              <option>Male</option>
            </select>
          </label>
          <label>Guardian Name
            <input
              name="guardianName"
              value={form.guardianName}
              onChange={handleChange}
              placeholder="Mr. Peter Obi"
            />
          </label>
          <label>Guardian Phone
            <input
              name="guardianPhone"
              value={form.guardianPhone}
              onChange={handleChange}
              placeholder="0803 111 2222"
            />
          </label>
          <label className="form-grid__full">Address
            <input
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="12 Allen Avenue, Ikeja, Lagos"
            />
          </label>
          <div className="form-grid__full">
            <button className="btn btn--primary">
              <FiUserPlus size={16} /> Enroll Student
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>All Students ({students.length})</h3>
        <table className="table table--striped">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Admission No</th>
              <th>Class</th>
              <th>Email</th>
              <th>Gender</th>
              <th>Guardian</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={s.id}>
                <td>{i + 1}</td>
                <td>{s.name}</td>
                <td>{s.admissionNo}</td>
                <td>{s.className}</td>
                <td>{s.email || '—'}</td>
                <td>{s.gender}</td>
                <td>{s.guardianName || '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={() => setConfirmDelete(s)}
                    title="Remove student"
                  >
                    <FiTrash2 size={14} /> Remove
                  </button>
                </td>
              </tr>
            ))}
            {!students.length && (
              <tr>
                <td colSpan="8" className="muted">
                  No students enrolled yet.
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
              <h3><FiAlertTriangle size={18} /> Remove Student?</h3>
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
              <strong>{confirmDelete.name}</strong> ({confirmDelete.admissionNo}).
            </p>

            <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
              This will delete:
            </p>
            <ul
              className="muted"
              style={{ fontSize: 13, marginLeft: 20, marginBottom: 16 }}
            >
              <li>The student's login account</li>
              <li>Their results</li>
              <li>Their fee records</li>
              <li>Their quiz submissions</li>
              <li>Their assignment submissions</li>
              <li>Their notifications and comments</li>
            </ul>

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
                {deleting ? 'Removing…' : 'Yes, Remove Student'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}