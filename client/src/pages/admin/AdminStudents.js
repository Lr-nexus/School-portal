import { useEffect, useState, useRef } from 'react';
import {
  FiUserPlus, FiCopy, FiCheck,
  FiTrash2, FiX, FiAlertTriangle,
  FiUploadCloud, FiDownload, FiUsers,
  FiCheckCircle, FiXCircle
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
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  /* ---------- single enroll state ---------- */
  const [tab, setTab] = useState('single'); // 'single' | 'bulk'
  const [form, setForm] = useState(emptyForm);
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  /* ---------- bulk upload state ---------- */
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkPassword, setBulkPassword] = useState('');
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const bulkFileRef = useRef(null);

  /* ---------- delete state ---------- */
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () =>
    api('/admin/students')
      .then(setStudents)
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  /* ---------- single enroll ---------- */
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

  /* ---------- bulk upload ---------- */
  const handleBulkFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const ok = /\.(csv|xlsx|xls)$/i.test(f.name);
    if (!ok) {
      setMessage('Please choose a .csv or .xlsx file');
      e.target.value = '';
      return;
    }
    setBulkFile(f);
    setBulkResult(null);
  };

  const submitBulk = async (e) => {
    e.preventDefault();
    if (!bulkFile) {
      setMessage('Choose a CSV or XLSX file first');
      return;
    }
    setBulkUploading(true);
    setMessage('');
    setBulkResult(null);

    try {
      const fd = new FormData();
      fd.append('file', bulkFile);
      fd.append('defaultPassword', bulkPassword);

      const res = await api('/admin/students/bulk', {
        method: 'POST',
        body: fd
      });

      setBulkResult(res);
      setMessage(res.message);
      setBulkFile(null);
      if (bulkFileRef.current) bulkFileRef.current.value = '';
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBulkUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csv = [
      'Name,Email,Password,Class,Gender,Guardian Name,Guardian Phone,Address',
      'Ada Obi,ada@school.com,,JSS 2A,Female,Mr. Peter Obi,0803 111 2222,"12 Allen Avenue, Ikeja, Lagos"',
      'Musa Ibrahim,musa@school.com,,JSS 2A,Male,Alhaji Ibrahim,0805 333 4444,"7 Ahmadu Bello Way, Kaduna"',
      'Chioma Nwosu,chioma@school.com,,JSS 2A,Female,Mrs. Nwosu,0807 555 6666,"3 Okigwe Road, Owerri"'
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student-enrollment-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadResults = () => {
    if (!bulkResult?.results?.length) return;
    const headers = ['Row', 'Name', 'Email', 'Status', 'Message', 'Admission No', 'Password'];
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      headers.join(','),
      ...bulkResult.results.map((r) =>
        [
          r.row,
          r.name,
          r.email,
          r.status,
          r.message,
          r.admissionNo || '',
          r.generatedPassword || ''
        ].map(escape).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enrollment-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- delete ---------- */
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
        subtitle="Enroll one student at a time, or upload a whole class from CSV / Excel"
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
        </div>
      )}

      {/* ---------- TABS ---------- */}
      <div className="card">
        <div className="tabs">
          <button
            type="button"
            className={`tab ${tab === 'single' ? 'tab--active' : ''}`}
            onClick={() => setTab('single')}
          >
            <FiUserPlus size={16} /> Enroll One
          </button>
          <button
            type="button"
            className={`tab ${tab === 'bulk' ? 'tab--active' : ''}`}
            onClick={() => setTab('bulk')}
          >
            <FiUploadCloud size={16} /> Bulk Upload (CSV / Excel)
          </button>
        </div>

        {/* ---------- SINGLE ---------- */}
        {tab === 'single' && (
          <form className="form-grid" onSubmit={handleSubmit}>
            <label>Full Name *
              <input name="name" value={form.name} onChange={handleChange}
                     placeholder="Ada Obi" required />
            </label>
            <label>Email *
              <input type="email" name="email" value={form.email} onChange={handleChange}
                     placeholder="ada@school.com" required />
            </label>
            <label>Password
              <input name="password" value={form.password} onChange={handleChange}
                     placeholder="Password" />
            </label>
            <label>Class *
              <input name="className" value={form.className} onChange={handleChange}
                     placeholder="JSS 2A" required />
            </label>
            <label>Gender
              <select name="gender" value={form.gender} onChange={handleChange}>
                <option>Female</option>
                <option>Male</option>
              </select>
            </label>
            <label>Guardian Name
              <input name="guardianName" value={form.guardianName} onChange={handleChange}
                     placeholder="Mr. Peter Obi" />
            </label>
            <label>Guardian Phone
              <input name="guardianPhone" value={form.guardianPhone} onChange={handleChange}
                     placeholder="0803 111 2222" />
            </label>
            <label className="form-grid__full">Address
              <input name="address" value={form.address} onChange={handleChange}
                     placeholder="12 Allen Avenue, Ikeja, Lagos" />
            </label>
            <div className="form-grid__full">
              <button className="btn btn--primary">
                <FiUserPlus size={16} /> Enroll Student
              </button>
            </div>
          </form>
        )}

        {/* ---------- BULK ---------- */}
        {tab === 'bulk' && (
          <div>
            <div className="bulk-info">
              <h4><FiUsers size={16} /> How it works</h4>
              <ol>
                <li>Download the CSV template below.</li>
                <li>Fill in one row per student.</li>
                <li>Upload the file — every valid row creates a login account + student profile.</li>
                <li>You'll get a per-row report showing who succeeded and who failed.</li>
              </ol>
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                Required columns: <code>Name</code>, <code>Email</code>, <code>Class</code>.
                Optional: <code>Password</code>, <code>Gender</code>,{' '}
                <code>Guardian Name</code>, <code>Guardian Phone</code>, <code>Address</code>.
                Column order doesn't matter, and common spelling variants (Full Name, Class Name, Parent Name, etc.) are recognized automatically.
              </p>
            </div>

            <div className="bulk-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={downloadTemplate}
              >
                <FiDownload size={16} /> Download CSV Template
              </button>
            </div>

            <form onSubmit={submitBulk}>
              <label className="form-grid__full">
                Choose file (.csv or .xlsx) *
                <input
                  ref={bulkFileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  onChange={handleBulkFile}
                  required
                />
              </label>

              <label>
                Default password for every account
                <input
                  type="text"
                  value={bulkPassword}
                  onChange={(e) => setBulkPassword(e.target.value)}
                  placeholder="Password"
                />
              </label>

              {bulkFile && (
                <div className="bulk-file-chip">
                  <FiUploadCloud size={14} /> {bulkFile.name}
                  <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                    ({(bulkFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              )}

              <div className="form-grid__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setBulkFile(null);
                    setBulkResult(null);
                    if (bulkFileRef.current) bulkFileRef.current.value = '';
                  }}
                  disabled={bulkUploading}
                >
                  Clear
                </button>
                <button className="btn btn--primary" disabled={bulkUploading || !bulkFile}>
                  <FiUploadCloud size={16} />{' '}
                  {bulkUploading ? 'Uploading…' : 'Upload & Enroll'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ---------- BULK RESULTS ---------- */}
      {bulkResult && (
        <div className="card">
          <div className="bulk-results__head">
            <h3>Upload Report</h3>
            <button className="btn btn--ghost" onClick={downloadResults}>
              <FiDownload size={14} /> Download CSV
            </button>
          </div>

          <div className="bulk-results__summary">
            <div className="bulk-stat bulk-stat--total">
              <span className="bulk-stat__label">Rows processed</span>
              <span className="bulk-stat__value">{bulkResult.total}</span>
            </div>
            <div className="bulk-stat bulk-stat--success">
              <span className="bulk-stat__label">Enrolled</span>
              <span className="bulk-stat__value">
                <FiCheckCircle size={14} /> {bulkResult.succeeded}
              </span>
            </div>
            <div className="bulk-stat bulk-stat--failed">
              <span className="bulk-stat__label">Failed</span>
              <span className="bulk-stat__value">
                <FiXCircle size={14} /> {bulkResult.failed}
              </span>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table table--striped">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Message</th>
                  <th>Admission No</th>
                </tr>
              </thead>
              <tbody>
                {bulkResult.results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.row}</td>
                    <td>{r.name}</td>
                    <td>{r.email}</td>
                    <td>
                      {r.status === 'success' ? (
                        <span className="pill pill--paid">
                          <FiCheckCircle size={12} /> Success
                        </span>
                      ) : (
                        <span className="pill pill--unpaid">
                          <FiXCircle size={12} /> Failed
                        </span>
                      )}
                    </td>
                    <td className="muted" style={{ fontSize: 13 }}>{r.message}</td>
                    <td>{r.admissionNo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {bulkResult.succeeded > 0 && (
            <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
              Note: the generated passwords are shown in the CSV download.
              Students should change their password after first login.
            </p>
          )}
        </div>
      )}

      {/* ---------- STUDENT LIST ---------- */}
      <div className="card">
        <h3>All Students ({students.length})</h3>
        <div className="table-wrap">
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
      </div>

      {/* ---------- DELETE MODAL ---------- */}
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