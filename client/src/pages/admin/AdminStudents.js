import { useEffect, useState, useRef } from 'react';
import {
  FiUserPlus, FiCopy, FiCheck, FiTrash2, FiX, FiAlertTriangle,
  FiUpload, FiDownload, FiCheckSquare, FiSquare, FiMinusSquare, FiUsers
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';

const emptyForm = {
  name: '', email: '', password: '', className: 'JSS 2A',
  gender: 'Female', guardianName: '', guardianPhone: '', address: ''
};

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

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
    if (!form.email.trim()) return setMessage('Email is required');

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

  const toggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allSelected = students.length > 0 && selected.length === students.length;
  const someSelected = selected.length > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) setSelected([]);
    else setSelected(students.map((s) => s.id));
  };

  const performDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      if (confirmDelete.mode === 'single') {
        await api(`/admin/students/${confirmDelete.items[0].id}`, { method: 'DELETE' });
        setMessage(`Removed ${confirmDelete.items[0].name}`);
      } else {
        const ids = confirmDelete.items.map((s) => s.id);
        const res = await api('/admin/students/bulk-delete', {
          method: 'POST',
          body: JSON.stringify({ ids })
        });
        setMessage(res.message);
        setSelected([]);
      }
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setImportFile(f);
    setImportResult(null);
  };

  const runImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const res = await api('/admin/students/bulk-import', {
        method: 'POST',
        body: fd
      });
      setImportResult(res);
      setMessage(res.message);
      setImportFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = 'name,email,password,classname,gender,guardianname,guardianphone,address';
    const sample = 'Ada Obi,ada@school.com,changeme123,JSS 2A,Female,Mr. Peter Obi,0803 111 2222,12 Allen Avenue';
    const blob = new Blob([headers + '\n' + sample + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="loader">Loading…</div>;

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle="Enroll individually, bulk import, or select multiple to remove"
      />

      {message && <div className="alert alert--info">{message}</div>}

      {credentials && (
        <div className="card credentials-card">
          <div className="credentials-card__head">
            <h3><FiCheck size={16} /> Account Created — Share With the Student</h3>
            <button className="btn btn--ghost" onClick={copyCredentials}>
              {copied ? <><FiCheck size={14} /> Copied</> : <><FiCopy size={14} /> Copy</>}
            </button>
          </div>
          <div className="credentials-card__body">
            <div><strong>Name:</strong> {credentials.name}</div>
            <div><strong>Email:</strong> <code>{credentials.email}</code></div>
            <div><strong>Password:</strong> <code>{credentials.password}</code></div>
            <div><strong>Admission No:</strong> {credentials.admissionNo}</div>
          </div>
        </div>
      )}

      <div className="card">
        <h3><FiUpload size={16} /> Bulk Import Students</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Upload an <strong>.xlsx</strong>, <strong>.xls</strong> or <strong>.csv</strong> file.
          Required columns: <code>name, email, classname</code>.
          Optional: <code>password, gender, guardianname, guardianphone, address</code>.
        </p>
        <div className="bulk-import-row">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
          />
          <button className="btn btn--ghost" type="button" onClick={downloadTemplate}>
            <FiDownload size={14} /> Template
          </button>
          <button
            className="btn btn--primary"
            type="button"
            onClick={runImport}
            disabled={!importFile || importing}
          >
            <FiUpload size={14} /> {importing ? 'Importing…' : 'Upload & Import'}
          </button>
        </div>

        {importResult && (
          <div className="import-result">
            <p><strong>{importResult.message}</strong> (total rows: {importResult.totalRows})</p>

            {importResult.created.length > 0 && (
              <details>
                <summary>✅ Created ({importResult.created.length})</summary>
                <ul>
                  {importResult.created.map((s, i) => (
                    <li key={i}>{s.name} — {s.email} — {s.className} — {s.admissionNo}</li>
                  ))}
                </ul>
              </details>
            )}

            {importResult.failed.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary>❌ Failed ({importResult.failed.length})</summary>
                <ul>
                  {importResult.failed.map((f, i) => (
                    <li key={i}>Row {f.line}: {f.name || '?'} — {f.reason}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h3><FiUserPlus size={16} /> Enroll New Student</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>Full Name *
            <input name="name" value={form.name} onChange={handleChange} required />
          </label>
          <label>Email *
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </label>
          <label>Password
            <input name="password" value={form.password} onChange={handleChange}
                   placeholder="Leave blank → changeme123" />
          </label>
          <label>Class *
            <input name="className" value={form.className} onChange={handleChange} required />
          </label>
          <label>Gender
            <select name="gender" value={form.gender} onChange={handleChange}>
              <option>Female</option>
              <option>Male</option>
            </select>
          </label>
          <label>Guardian Name
            <input name="guardianName" value={form.guardianName} onChange={handleChange} />
          </label>
          <label>Guardian Phone
            <input name="guardianPhone" value={form.guardianPhone} onChange={handleChange} />
          </label>
          <label className="form-grid__full">Address
            <input name="address" value={form.address} onChange={handleChange} />
          </label>
          <div className="form-grid__full">
            <button className="btn btn--primary">
              <FiUserPlus size={16} /> Enroll Student
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="table-head">
          <h3><FiUsers size={16} /> All Students ({students.length})</h3>
          {selected.length > 0 && (
            <div className="table-head__actions">
              <span className="pill">{selected.length} selected</span>
              <button
                className="btn btn--danger btn--sm"
                onClick={() => setConfirmDelete({
                  mode: 'bulk',
                  items: students.filter((s) => selected.includes(s.id))
                })}
              >
                <FiTrash2 size={14} /> Remove Selected
              </button>
            </div>
          )}
        </div>

        <table className="table table--striped">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <button
                  className="checkbox-btn"
                  onClick={toggleAll}
                  title={allSelected ? 'Deselect all' : 'Select all'}
                >
                  {allSelected ? <FiCheckSquare size={18} /> :
                   someSelected ? <FiMinusSquare size={18} /> :
                   <FiSquare size={18} />}
                </button>
              </th>
              <th>#</th>
              <th>Name</th>
              <th>Admission No</th>
              <th>Class</th>
              <th>Email</th>
              <th>Gender</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => {
              const isChecked = selected.includes(s.id);
              return (
                <tr key={s.id} className={isChecked ? 'row--selected' : ''}>
                  <td>
                    <button
                      className="checkbox-btn"
                      onClick={() => toggle(s.id)}
                    >
                      {isChecked ? <FiCheckSquare size={18} /> : <FiSquare size={18} />}
                    </button>
                  </td>
                  <td>{i + 1}</td>
                  <td>{s.name}</td>
                  <td>{s.admissionNo}</td>
                  <td>{s.className}</td>
                  <td>{s.email || '—'}</td>
                  <td>{s.gender}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => setConfirmDelete({ mode: 'single', items: [s] })}
                    >
                      <FiTrash2 size={14} /> Remove
                    </button>
                  </td>
                </tr>
              );
            })}
            {!students.length && (
              <tr><td colSpan="8" className="muted" style={{ textAlign: 'center' }}>
                No students enrolled yet.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>
                <FiAlertTriangle size={18} />{' '}
                {confirmDelete.mode === 'bulk'
                  ? `Remove ${confirmDelete.items.length} Students?`
                  : 'Remove Student?'}
              </h3>
              <button className="btn btn--ghost" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                <FiX size={16} />
              </button>
            </div>

            {confirmDelete.mode === 'single' ? (
              <p style={{ marginBottom: 12 }}>
                Permanently remove <strong>{confirmDelete.items[0].name}</strong>{' '}
                ({confirmDelete.items[0].admissionNo})?
              </p>
            ) : (
              <>
                <p style={{ marginBottom: 8 }}>
                  Permanently remove <strong>{confirmDelete.items.length} students</strong>?
                </p>
                <div className="confirm-list">
                  {confirmDelete.items.map((s) => (
                    <div key={s.id} className="confirm-list__row">
                      <strong>{s.name}</strong> · {s.className} · {s.admissionNo}
                    </div>
                  ))}
                </div>
              </>
            )}

            <p className="muted" style={{ fontSize: 12, color: 'var(--red)', marginTop: 12 }}>
              Each student's login, results, fees, submissions, and comments will be deleted.
              This cannot be undone.
            </p>

            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn btn--danger" onClick={performDelete} disabled={deleting}>
                <FiTrash2 size={14} />{' '}
                {deleting
                  ? 'Removing…'
                  : confirmDelete.mode === 'bulk'
                    ? `Yes, Remove ${confirmDelete.items.length}`
                    : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}