import { useState, useRef } from 'react';
import {
  FiUserPlus, FiCopy, FiCheck, FiUpload, FiDownload,
  FiHeart, FiUsers, FiInfo,
} from 'react-icons/fi';
import { api } from '../../api/api';

const emptyForm = {
  name: '', email: '', password: '', className: 'JSS 2A',
  gender: 'Female', guardianName: '', guardianPhone: '', address: '',
  parentEmail: '', parentPassword: '', parentRelationship: 'Guardian',
};

export default function AdminEnrollStudents() {
  const [form, setForm] = useState(emptyForm);
  const [createParent, setCreateParent] = useState(true);
  const [message, setMessage] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [parentCredentials, setParentCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(''); setCredentials(null); setParentCredentials(null);

    if (!form.email.trim()) return setMessage('Student email is required');
    if (createParent && !form.parentEmail.trim()) {
      return setMessage('Parent email is required when creating a parent account');
    }

    const payload = {
      name: form.name, email: form.email, password: form.password,
      className: form.className, gender: form.gender,
      guardianName: form.guardianName, guardianPhone: form.guardianPhone,
      address: form.address,
    };
    if (createParent) {
      payload.parentEmail = form.parentEmail;
      payload.parentPassword = form.parentPassword;
      payload.parentRelationship = form.parentRelationship;
    }

    try {
      const res = await api('/admin/students-with-parent', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setMessage(res.parentCredentials
        ? 'Student and parent accounts created'
        : 'Student enrolled successfully');
      setCredentials({
        name: res.student.name,
        email: res.credentials.email,
        password: res.credentials.password,
        admissionNo: res.student.admissionNo,
      });
      if (res.parentCredentials) {
        setParentCredentials({
          name: res.parentCredentials.name,
          email: res.parentCredentials.email,
          password: res.parentCredentials.password,
          child: res.student.name,
        });
      }
      setForm(emptyForm);
    } catch (err) {
      setMessage(err.message);
    }
  };

  const copyCredentials = () => {
    if (!credentials) return;
    let text =
      `STUDENT LOGIN\n` +
      `Name:         ${credentials.name}\n` +
      `Email:        ${credentials.email}\n` +
      `Password:     ${credentials.password}\n` +
      `Admission No: ${credentials.admissionNo}`;
    if (parentCredentials) {
      text +=
        `\n\nPARENT LOGIN\n` +
        `Name:         ${parentCredentials.name}\n` +
        `Email:        ${parentCredentials.email}\n` +
        `Password:     ${parentCredentials.password}\n` +
        `Child:        ${parentCredentials.child}`;
    }
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
      const res = await api('/admin/students/bulk-import', { method: 'POST', body: fd });
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

  /* ⭐ Template now includes parent columns */
  const downloadTemplate = () => {
    const headers =
      'name,email,password,classname,gender,guardianname,guardianphone,address,' +
      'parentemail,parentname,parentpassword,parentrelationship';

    // Two sample rows:
    //   1) student WITH a parent account
    //   2) student WITHOUT a parent account (parentemail left blank)
    const sample1 = 'Ada Obi,ada@school.com,,JSS 2A,Female,Mr. Peter Obi,0803 111 2222,"12 Allen Avenue, Ikeja",parent.obi@school.com,Mr. Peter Obi,,Father';
    const sample2 = 'Chidi Eze,chidi.eze@school.com,,JSS 2A,Male,Mrs. Ngozi Eze,0803 333 4444,"5 Marina Street, Lagos",,,,';

    const blob = new Blob([headers + '\n' + sample1 + '\n' + sample2 + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students-with-parents-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {message && <div className="alert alert--info">{message}</div>}

      {(credentials || parentCredentials) && (
        <div className="card credentials-card">
          <div className="credentials-card__head">
            <h3><FiCheck size={16} /> Account{parentCredentials ? 's' : ''} Created — Share With Them</h3>
            <button className="btn btn--ghost" onClick={copyCredentials}>
              {copied ? <><FiCheck size={14} /> Copied</> : <><FiCopy size={14} /> Copy All</>}
            </button>
          </div>
          <div className="credentials-card__body">
            {credentials && (
              <>
                <div style={{ gridColumn: '1 / -1', marginBottom: 8 }}>
                  <FiUsers size={12} /> <strong>Student Login</strong>
                </div>
                <div><strong>Name:</strong> {credentials.name}</div>
                <div><strong>Email:</strong> <code>{credentials.email}</code></div>
                <div><strong>Password:</strong> <code>{credentials.password}</code></div>
                <div><strong>Admission No:</strong> {credentials.admissionNo}</div>
              </>
            )}
            {parentCredentials && (
              <>
                <div style={{ gridColumn: '1 / -1', marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
                  <FiHeart size={12} /> <strong>Parent Login</strong>
                </div>
                <div><strong>Parent:</strong> {parentCredentials.name}</div>
                <div><strong>Email:</strong> <code>{parentCredentials.email}</code></div>
                <div><strong>Password:</strong> <code>{parentCredentials.password}</code></div>
                <div><strong>Linked Child:</strong> {parentCredentials.child}</div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="enroll-grid">
        {/* ---------- Bulk import ---------- */}
        <div className="card enroll-card">
          <div className="enroll-card__head">
            <div className="enroll-card__icon"><FiUpload size={18} /></div>
            <div>
              <h3>Bulk Import (Students + Parents)</h3>
              <p className="muted">Upload a spreadsheet — one row per student</p>
            </div>
          </div>

          <div
            className="alert alert--info"
            style={{ flexDirection: 'column', alignItems: 'flex-start', fontSize: 12, lineHeight: 1.6 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <FiInfo size={14} /> <strong>Column reference</strong>
            </div>
            <code style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
              name, email, password, classname, gender, guardianname, guardianphone, address,
              <br />
              parentemail, parentname, parentpassword, parentrelationship
            </code>
            <div>
              <strong>Required:</strong> <code>name</code>, <code>email</code>, <code>classname</code>
            </div>
            <div style={{ marginTop: 4 }}>
              <strong>Optional parent:</strong> fill <code>parentemail</code> to also create a parent login.
              Leave blank to skip the parent account.
            </div>
            <div style={{ marginTop: 4 }}>
              <strong>Defaults:</strong> student password → <code>Student@123</code> · parent password → <code>Parent@123</code>
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            className="file-drop"
          />

          {importFile && (
            <div className="bulk-file-chip">
              <FiUpload size={14} /> {importFile.name}
            </div>
          )}

          <div className="enroll-card__actions">
            <button className="btn btn--ghost" type="button" onClick={downloadTemplate}>
              <FiDownload size={14} /> Download Template
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
              <p className="muted" style={{ fontSize: 12 }}>Total rows: {importResult.totalRows}</p>

              {importResult.created.length > 0 && (
                <details>
                  <summary>✅ Created ({importResult.created.length})</summary>
                  <ul>
                    {importResult.created.map((s, i) => (
                      <li key={i}>
                        {s.name} — {s.email} — {s.className}
                        {s.parent && <> · <span style={{ color: 'var(--green)' }}>parent: {s.parent.email}</span></>}
                      </li>
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

        {/* ---------- Single enrollment (unchanged from prior version) ---------- */}
        <div className="card enroll-card">
          <div className="enroll-card__head">
            <div className="enroll-card__icon"><FiUserPlus size={18} /></div>
            <div>
              <h3>Enroll One Student</h3>
              <p className="muted">A login account is created automatically</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <h4 className="enroll-section-title">Student Information</h4>
            <div className="form-grid">
              <label>Full Name *
                <input name="name" value={form.name} onChange={handleChange} placeholder="Ada Obi" required />
              </label>
              <label>Email *
                <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="ada@school.com" required />
              </label>
              <label>Password
                <input name="password" value={form.password} onChange={handleChange} placeholder="Leave blank → Student@123" />
              </label>
              <label>Class *
                <input name="className" value={form.className} onChange={handleChange} placeholder="JSS 2A" required />
              </label>
              <label>Gender
                <select name="gender" value={form.gender} onChange={handleChange}>
                  <option>Female</option>
                  <option>Male</option>
                </select>
              </label>
            </div>

            <h4 className="enroll-section-title">Guardian Contact</h4>
            <div className="form-grid">
              <label>Guardian Name
                <input name="guardianName" value={form.guardianName} onChange={handleChange} placeholder="Mr. Peter Obi" />
              </label>
              <label>Guardian Phone
                <input name="guardianPhone" value={form.guardianPhone} onChange={handleChange} placeholder="0803 111 2222" />
              </label>
              <label className="form-grid__full">Home Address
                <input name="address" value={form.address} onChange={handleChange} placeholder="12 Allen Avenue, Ikeja, Lagos" />
              </label>
            </div>

            <h4 className="enroll-section-title">
              <FiHeart size={12} style={{ marginRight: 6 }} />
              Parent Portal Account
            </h4>

            <label
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px', marginBottom: 12,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 10, cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={createParent}
                onChange={(e) => setCreateParent(e.target.checked)}
                style={{ width: 'auto', margin: 0 }}
              />
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                Also create a login account for the parent / guardian
              </span>
            </label>

            {createParent && (
              <div className="form-grid">
                <label>Parent Email *
                  <input type="email" name="parentEmail" value={form.parentEmail} onChange={handleChange} placeholder="parent@school.com" />
                </label>
                <label>Parent Password
                  <input name="parentPassword" value={form.parentPassword} onChange={handleChange} placeholder="Leave blank → Parent@123" />
                </label>
                <label>Relationship
                  <select name="parentRelationship" value={form.parentRelationship} onChange={handleChange}>
                    <option>Father</option>
                    <option>Mother</option>
                    <option>Guardian</option>
                    <option>Other</option>
                  </select>
                </label>
              </div>
            )}

            <div className="enroll-card__actions enroll-card__actions--end">
              <button type="button" className="btn btn--ghost"
                onClick={() => { setForm(emptyForm); setCreateParent(true); }}>
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