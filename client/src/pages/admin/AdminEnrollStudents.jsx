import { useState, useRef } from 'react';
import {
  FiUserPlus, FiCopy, FiCheck, FiUpload, FiDownload
} from 'react-icons/fi';
import { api } from '../../api/api';

const emptyForm = {
  name: '', email: '', password: '', className: 'JSS 2A',
  gender: 'Female', guardianName: '', guardianPhone: '', address: ''
};

export default function AdminEnrollStudents() {
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

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
    } catch (err) {
      setMessage(err.message);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = 'name,email,password,classname,gender,guardianname,guardianphone,address';
    const sample = 'Ada Obi,ada@school.com,Password,JSS 2A,Female,Mr. Peter Obi,0803 111 2222,12 Allen Avenue';
    const blob = new Blob([headers + '\n' + sample + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {message && <div className="alert alert--info">{message}</div>}

      {credentials && (
        <div className="card credentials-card">
          <div className="credentials-card__head">
            <h3>
              <FiCheck size={16} /> Account Created — Share With the Student
            </h3>
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

      <div className="enroll-grid">
        {/* BULK IMPORT */}
        <div className="card enroll-card">
          <div className="enroll-card__head">
            <div className="enroll-card__icon">
              <FiUpload size={18} />
            </div>
            <div>
              <h3>Bulk Import</h3>
              <p className="muted">Upload a spreadsheet to add many students at once</p>
            </div>
          </div>

          <p className="muted enroll-card__hint">
            Accepts <strong>.xlsx</strong>, <strong>.xls</strong>, or <strong>.csv</strong>.
            Required: <code>name, email, classname</code>.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            className="file-drop"
          />

          <div className="enroll-card__actions">
            <button className="btn btn--ghost" type="button" onClick={downloadTemplate}>
              <FiDownload size={14} /> Template
            </button>
            <button
              className="btn btn--primary"
              type="button"
              onClick={runImport}
              disabled={!importFile || importing}
            >
              <FiUpload size={14} /> {importing ? 'Importing…' : 'Import'}
            </button>
          </div>

          {importResult && (
            <div className="import-result">
              <p><strong>{importResult.message}</strong></p>
              <p className="muted" style={{ fontSize: 12 }}>
                Total rows: {importResult.totalRows}
              </p>

              {importResult.created.length > 0 && (
                <details>
                  <summary>✅ Created ({importResult.created.length})</summary>
                  <ul>
                    {importResult.created.map((s, i) => (
                      <li key={i}>{s.name} — {s.email} — {s.className}</li>
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

        {/* SINGLE ENROLL */}
        <div className="card enroll-card">
          <div className="enroll-card__head">
            <div className="enroll-card__icon">
              <FiUserPlus size={18} />
            </div>
            <div>
              <h3>Enroll One Student</h3>
              <p className="muted">A login account is created automatically</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <h4 className="enroll-section-title">Personal Information</h4>
            <div className="form-grid">
              <label>Full Name *
                <input name="name" value={form.name} onChange={handleChange}
                       placeholder="Ada Obi" required />
              </label>
              <label>Email *
                <input type="email" name="email" value={form.email}
                       onChange={handleChange} placeholder="ada@school.com" required />
              </label>
              <label>Password
                <input name="password" value={form.password}
                       onChange={handleChange}
                       placeholder="Password" />
              </label>
              <label>Class *
                <input name="className" value={form.className}
                       onChange={handleChange} placeholder="JSS 2A" required />
              </label>
              <label>Gender
                <select name="gender" value={form.gender} onChange={handleChange}>
                  <option>Female</option>
                  <option>Male</option>
                </select>
              </label>
            </div>

            <h4 className="enroll-section-title">Guardian Information</h4>
            <div className="form-grid">
              <label>Guardian Name
                <input name="guardianName" value={form.guardianName}
                       onChange={handleChange} placeholder="Mr. Peter Obi" />
              </label>
              <label>Guardian Phone
                <input name="guardianPhone" value={form.guardianPhone}
                       onChange={handleChange} placeholder="0803 111 2222" />
              </label>
              <label className="form-grid__full">Home Address
                <input name="address" value={form.address}
                       onChange={handleChange}
                       placeholder="12 Allen Avenue, Ikeja, Lagos" />
              </label>
            </div>

            <div className="enroll-card__actions enroll-card__actions--end">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setForm(emptyForm)}
              >
                Clear
              </button>
              <button className="btn btn--primary">
                <FiUserPlus size={16} /> Enroll Student
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}