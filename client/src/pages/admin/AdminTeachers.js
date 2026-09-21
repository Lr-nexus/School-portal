import { useEffect, useState, useRef } from 'react';
import {
  FiUserPlus, FiCopy, FiCheck, FiTrash2, FiX, FiAlertTriangle,
  FiUpload, FiDownload, FiCheckSquare, FiSquare, FiMinusSquare, FiUsers
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';

const emptyForm = {
  name: '', email: '', password: '', phone: '',
  subjects: '', formClass: '', qualification: '', address: ''
};

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState([]);
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
    if (!form.email.trim()) return setMessage('Email is required');

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

  const toggle = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const allSelected = teachers.length > 0 && selected.length === teachers.length;
  const someSelected = selected.length > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) setSelected([]);
    else setSelected(teachers.map((t) => t.id));
  };

  const performDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      if (confirmDelete.mode === 'single') {
        await api(`/admin/teachers/${confirmDelete.items[0].id}`, { method: 'DELETE' });
        setMessage(`Removed ${confirmDelete.items[0].name}`);
      } else {
        const ids = confirmDelete.items.map((t) => t.id);
        const res = await api('/admin/teachers/bulk-delete', {
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
      const res = await api('/admin/teachers/bulk-import', {
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
    const headers = 'name,email,password,phone,subjects,formclass,qualification,address';
    const sample = 'Adewale Johnson,adewale@school.com,Teacher@123,0802 111 0001,"Mathematics, Further Mathematics",JSS 1A,"B.Sc Mathematics, PGDE","12 Adeniyi Jones, Ikeja"';
    const blob = new Blob([headers + '\n' + sample + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teachers-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="loader">Loading…</div>;

  return (
    <div>
      <PageHeader
        title="Teachers"
        subtitle="Enroll individually, bulk import, or select multiple to remove"
      />

      {message && <div className="alert alert--info">{message}</div>}

      {credentials && (
        <div className="card credentials-card">
          <div className="credentials-card__head">
            <h3><FiCheck size={16} /> Account Created — Share With the Teacher</h3>
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
        </div>
      )}

      {/* ============ BULK IMPORT SECTION ============ */}
      <div className="card">
        <h3><FiUpload size={16} /> Bulk Import Teachers</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Upload an <strong>.xlsx</strong>, <strong>.xls</strong> or <strong>.csv</strong> file.
          Required columns: <code>name, email</code>.
          Optional: <code>password, phone, subjects, formclass, qualification, address</code>.
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
                  {importResult.created.map((t, i) => (
                    <li key={i}>{t.name} — {t.email} — {t.formClass} — {t.staffNo}</li>
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

      {/* ============ SINGLE ENROLLMENT ============ */}
      <div className="card">
        <h3><FiUserPlus size={16} /> Enroll New Teacher</h3>
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
          <label>Phone
            <input name="phone" value={form.phone} onChange={handleChange} />
          </label>
          <label>Subjects (comma separated)
            <input name="subjects" value={form.subjects} onChange={handleChange}
                   placeholder="Mathematics, Further Mathematics" />
          </label>
          <label>Form Class
            <input name="formClass" value={form.formClass} onChange={handleChange}
                   placeholder="JSS 2A" />
          </label>
          <label>Qualification
            <input name="qualification" value={form.qualification} onChange={handleChange} />
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

      {/* ============ TABLE ============ */}
      <div className="card">
        <div className="table-head">
          <h3><FiUsers size={16} /> All Teachers ({teachers.length})</h3>
          {selected.length > 0 && (
            <div className="table-head__actions">
              <span className="pill">{selected.length} selected</span>
              <button
                className="btn btn--danger btn--sm"
                onClick={() => setConfirmDelete({
                  mode: 'bulk',
                  items: teachers.filter((t) => selected.includes(t.id))
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
                <button className="checkbox-btn" onClick={toggleAll}>
                  {allSelected ? <FiCheckSquare size={18} /> :
                   someSelected ? <FiMinusSquare size={18} /> :
                   <FiSquare size={18} />}
                </button>
              </th>
              <th>#</th>
              <th>Name</th>
              <th>Staff No</th>
              <th>Email</th>
              <th>Subjects</th>
              <th>Form Class</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t, i) => {
              const isChecked = selected.includes(t.id);
              return (
                <tr key={t.id} className={isChecked ? 'row--selected' : ''}>
                  <td>
                    <button className="checkbox-btn" onClick={() => toggle(t.id)}>
                      {isChecked ? <FiCheckSquare size={18} /> : <FiSquare size={18} />}
                    </button>
                  </td>
                  <td>{i + 1}</td>
                  <td>{t.name}</td>
                  <td>{t.staffNo}</td>
                  <td>{t.email}</td>
                  <td>{t.subjects.join(', ') || '—'}</td>
                  <td>{t.formClass}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => setConfirmDelete({ mode: 'single', items: [t] })}
                    >
                      <FiTrash2 size={14} /> Remove
                    </button>
                  </td>
                </tr>
              );
            })}
            {!teachers.length && (
              <tr><td colSpan="8" className="muted" style={{ textAlign: 'center' }}>
                No teachers enrolled yet.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ============ DELETE MODAL ============ */}
      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>
                <FiAlertTriangle size={18} />{' '}
                {confirmDelete.mode === 'bulk'
                  ? `Remove ${confirmDelete.items.length} Teachers?`
                  : 'Remove Teacher?'}
              </h3>
              <button className="btn btn--ghost" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                <FiX size={16} />
              </button>
            </div>

            {confirmDelete.mode === 'single' ? (
              <p style={{ marginBottom: 12 }}>
                Permanently remove <strong>{confirmDelete.items[0].name}</strong>{' '}
                ({confirmDelete.items[0].staffNo})?
              </p>
            ) : (
              <>
                <p style={{ marginBottom: 8 }}>
                  Permanently remove <strong>{confirmDelete.items.length} teachers</strong>?
                </p>
                <div className="confirm-list">
                  {confirmDelete.items.map((t) => (
                    <div key={t.id} className="confirm-list__row">
                      <strong>{t.name}</strong> · {t.formClass} · {t.staffNo}
                    </div>
                  ))}
                </div>
              </>
            )}

            <p className="muted" style={{ fontSize: 12, color: 'var(--red)', marginTop: 12 }}>
              Their login, notes, assignments, quizzes and class sessions will be deleted.
              Classes they managed stay in the system with no teacher.
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