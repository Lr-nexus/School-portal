import { useEffect, useState } from 'react';
import {
  FiUserPlus, FiTrash2, FiX, FiCheck, FiAlertCircle, FiSearch, FiUsers
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

const emptyForm = {
  name: '', email: '', password: '', phone: '',
  relationship: 'Guardian', address: '', studentId: '',
};

export default function AdminParents() {
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [credentials, setCredentials] = useState(null);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    try {
      const [p, s] = await Promise.all([
        api('/admin/parents'),
        api('/admin/students'),
      ]);
      setParents(p);
      setStudents(s);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    setErrorMsg('');
    setCredentials(null);
    try {
      const res = await api('/admin/parents', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setMessage(res.message);
      setCredentials({
        name: res.parent.name,
        email: res.credentials.email,
        password: res.credentials.password,
        child: res.parent.childName,
      });
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    try {
      await api(`/admin/parents/${confirmDelete.id}`, { method: 'DELETE' });
      setMessage('Parent removed');
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setErrorMsg(err.message);
      setConfirmDelete(null);
    }
  };

  const filtered = parents.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.childName || '').toLowerCase().includes(q)
    );
  });

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader
        title="Parents / Guardians"
        subtitle="Enroll and manage parent accounts linked to students"
      >
        <button className="btn btn--primary" onClick={() => setShowForm((v) => !v)}>
          {showForm
            ? <><FiX size={16} /> Cancel</>
            : <><FiUserPlus size={16} /> Enroll Parent</>}
        </button>
      </PageHeader>

      {message && <div className="alert alert--info"><FiCheck size={16} /> {message}</div>}
      {errorMsg && <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>}

      {credentials && (
        <div className="card credentials-card">
          <div className="credentials-card__head">
            <h3><FiCheck size={16} /> Account Created</h3>
            <button
              className="btn btn--ghost"
              onClick={() => {
                const text =
                  `Name: ${credentials.name}\nEmail: ${credentials.email}\nPassword: ${credentials.password}\nChild: ${credentials.child}`;
                navigator.clipboard.writeText(text);
              }}
            >
              Copy
            </button>
          </div>
          <div className="credentials-card__body">
            <div><strong>Parent:</strong> {credentials.name}</div>
            <div><strong>Child:</strong> {credentials.child}</div>
            <div><strong>Email:</strong> <code>{credentials.email}</code></div>
            <div><strong>Password:</strong> <code>{credentials.password}</code></div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card">
          <h3><FiUserPlus size={16} /> Enroll New Parent</h3>
          <form className="form-grid" onSubmit={submit}>
            <label>Full Name *
              <input name="name" value={form.name} onChange={handleChange} required />
            </label>
            <label>Email *
              <input type="email" name="email" value={form.email} onChange={handleChange} required />
            </label>
            <label>Password
              <input name="password" value={form.password} onChange={handleChange}
                     placeholder="Leave blank → Parent@123" />
            </label>
            <label>Phone
              <input name="phone" value={form.phone} onChange={handleChange} />
            </label>
            <label>Relationship
              <select name="relationship" value={form.relationship} onChange={handleChange}>
                <option>Father</option>
                <option>Mother</option>
                <option>Guardian</option>
                <option>Other</option>
              </select>
            </label>
            <label>Child (Student) *
              <select name="studentId" value={form.studentId} onChange={handleChange} required>
                <option value="">— Select a student —</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.className} · {s.admissionNo}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-grid__full">Address
              <input name="address" value={form.address} onChange={handleChange} />
            </label>
            <div className="form-grid__full">
              <button className="btn btn--primary">
                <FiUserPlus size={16} /> Create Account
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="table-head">
          <h3><FiUsers size={16} /> All Parents ({parents.length})</h3>
        </div>

        <div className="filters-bar">
          <div className="filters-bar__search">
            <FiSearch size={16} />
            <input
              type="text"
              placeholder="Search by name, email or child…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <table className="table table--striped">
          <thead>
            <tr>
              <th>#</th><th>Name</th><th>Email</th>
              <th>Phone</th><th>Child</th><th>Relationship</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id}>
                <td>{i + 1}</td>
                <td>{p.name}</td>
                <td>{p.email}</td>
                <td>{p.phone || '—'}</td>
                <td>
                  {p.childName
                    ? <>{p.childName} · {p.childClass}</>
                    : <span className="muted">No child linked</span>}
                </td>
                <td>{p.relationship || '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={() => setConfirmDelete(p)}
                  >
                    <FiTrash2 size={14} /> Remove
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan="7" className="muted" style={{ textAlign: 'center' }}>
                No parents enrolled yet.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3><FiAlertCircle size={18} /> Remove Parent?</h3>
              <button className="btn btn--ghost" onClick={() => setConfirmDelete(null)}>
                <FiX size={16} />
              </button>
            </div>
            <p>Permanently remove <strong>{confirmDelete.name}</strong>?</p>
            <p className="muted" style={{ fontSize: 12 }}>
              Their login will be deleted and they will no longer be linked to their child.
            </p>
            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn--danger" onClick={remove}>
                <FiTrash2 size={14} /> Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}