import { useState, useRef } from 'react';
import {
  FiUserPlus, FiCopy, FiCheck, FiUpload, FiDownload,
  FiPlus, FiX, FiUserCheck, FiLayers,
} from 'react-icons/fi';
import { api } from '../../api/api';

const SUBJECTS = [
  'Mathematics', 'English Language', 'Basic Science',
  'Social Studies', 'Computer Studies', 'Further Mathematics',
  'Biology', 'Literature',
];

const emptyForm = {
  name: '', email: '', password: '', phone: '',
  subjects: '', formClass: '', qualification: '', address: '',
  teacherType: 'class_teacher',
};

export default function AdminEnrollTeachers() {
  const [form, setForm] = useState(emptyForm);
  const [assignments, setAssignments] = useState([{ className: '', subject: 'Mathematics' }]);
  const [message, setMessage] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const addAssignment = () =>
    setAssignments((prev) => [...prev, { className: '', subject: 'Mathematics' }]);

  const updateAssignment = (i, patch) =>
    setAssignments((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });

  const removeAssignment = (i) => {
    if (assignments.length === 1) return;
    setAssignments((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setCredentials(null);
    if (!form.email.trim()) return setMessage('Email is required');

    const isClassTeacher = form.teacherType === 'class_teacher';
    const payload = {
      ...form,
      teacherType: form.teacherType,
      // Only send assignments for subject teachers
      assignments: isClassTeacher
        ? []
        : assignments.filter((a) => a.className.trim() && a.subject.trim()),
    };

    if (!isClassTeacher) {
      if (payload.assignments.length === 0) {
        return setMessage('Add at least one class + subject pair for a subject teacher');
      }
    } else if (!form.formClass.trim()) {
      return setMessage('Class teachers must have a form class');
    }

    try {
      const res = await api('/admin/teachers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setMessage('Teacher enrolled successfully');
      setCredentials({
        name: res.teacher.name,
        email: res.credentials.email,
        password: res.credentials.password,
        staffNo: res.teacher.staffNo,
      });
      setForm(emptyForm);
      setAssignments([{ className: '', subject: 'Mathematics' }]);
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
        body: fd,
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
    const headers = 'name,email,password,phone,subjects,formclass,teachertype,qualification,address';
    const sample = 'Adewale Johnson,adewale@school.com,Teacher@123,0802 111 0001,"Mathematics, Further Mathematics",JSS 1A,class_teacher,"B.Sc Mathematics, PGDE","12 Adeniyi Jones, Ikeja"';
    const sample2 = 'Emeka Nwosu,emeka@school.com,Teacher@123,0802 222 0002,"English Language",,subject_teacher,"B.A English","5 Marina Street, Lagos"';
    const blob = new Blob([headers + '\n' + sample + '\n' + sample2 + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teachers-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const isClassTeacher = form.teacherType === 'class_teacher';

  return (
    <>
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

      <div className="enroll-grid">
        {/* Bulk import */}
        <div className="card enroll-card">
          <div className="enroll-card__head">
            <div className="enroll-card__icon"><FiUpload size={18} /></div>
            <div>
              <h3>Bulk Import</h3>
              <p className="muted">Upload a spreadsheet to add many teachers at once</p>
            </div>
          </div>

          <p className="muted enroll-card__hint">
            Accepts <strong>.xlsx</strong>, <strong>.xls</strong>, or <strong>.csv</strong>.
            Required: <code>name, email</code>. Optional: <code>teachertype</code>
            (<code>class_teacher</code> or <code>subject_teacher</code>).
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
                    {importResult.created.map((t, i) => (
                      <li key={i}>{t.name} — {t.email} — {t.teacherType || ''}</li>
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

        {/* Single enroll */}
        <div className="card enroll-card">
          <div className="enroll-card__head">
            <div className="enroll-card__icon"><FiUserPlus size={18} /></div>
            <div>
              <h3>Enroll One Teacher</h3>
              <p className="muted">A login account is created automatically</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* ---------- TYPE PICKER ---------- */}
            <h4 className="enroll-section-title">Teacher Type</h4>
            <div className="teacher-type-toggle">
              <button
                type="button"
                className={`teacher-type-tile ${isClassTeacher ? 'teacher-type-tile--active' : ''}`}
                onClick={() => setForm({ ...form, teacherType: 'class_teacher' })}
              >
                <FiUserCheck size={20} />
                <strong>Class Teacher</strong>
                <span className="muted">Owns one form class — can post any subject in it</span>
              </button>
              <button
                type="button"
                className={`teacher-type-tile ${!isClassTeacher ? 'teacher-type-tile--active' : ''}`}
                onClick={() => setForm({ ...form, teacherType: 'subject_teacher' })}
              >
                <FiLayers size={20} />
                <strong>Subject Teacher</strong>
                <span className="muted">Teaches specific subjects across multiple classes</span>
              </button>
            </div>

            <h4 className="enroll-section-title">Personal Information</h4>
            <div className="form-grid">
              <label>Full Name *
                <input name="name" value={form.name} onChange={handleChange}
                  placeholder="Adewale Johnson" required />
              </label>
              <label>Email *
                <input type="email" name="email" value={form.email}
                  onChange={handleChange} placeholder="adewale@school.com" required />
              </label>
              <label>Password
                <input name="password" value={form.password}
                  onChange={handleChange} placeholder="Password" />
              </label>
              <label>Phone
                <input name="phone" value={form.phone}
                  onChange={handleChange} placeholder="0802 111 0001" />
              </label>
            </div>

            <h4 className="enroll-section-title">Teaching Details</h4>
            <div className="form-grid">
              <label className="form-grid__full">Subjects (comma separated)
                <input name="subjects" value={form.subjects}
                  onChange={handleChange}
                  placeholder="Mathematics, Further Mathematics" />
              </label>

              {isClassTeacher && (
                <label>Form Class
                  <input name="formClass" value={form.formClass}
                    onChange={handleChange} placeholder="JSS 1A" />
                </label>
              )}

              <label className="form-grid__full">Qualification
                <input name="qualification" value={form.qualification}
                  onChange={handleChange}
                  placeholder="B.Sc Mathematics, PGDE" />
              </label>
              <label className="form-grid__full">Address
                <input name="address" value={form.address}
                  onChange={handleChange}
                  placeholder="12 Adeniyi Jones, Ikeja, Lagos" />
              </label>
            </div>

            {/* ---------- ASSIGNMENTS for subject teachers ---------- */}
            {!isClassTeacher && (
              <>
                <h4 className="enroll-section-title">
                  <FiLayers size={12} style={{ marginRight: 6 }} />
                  Class + Subject assignments
                </h4>
                <div className="assignments-editor">
                  {assignments.map((a, i) => (
                    <div className="assignment-row" key={i}>
                      <input
                        placeholder="Class name (e.g. JSS 1A)"
                        value={a.className}
                        onChange={(e) => updateAssignment(i, { className: e.target.value })}
                      />
                      <select
                        value={a.subject}
                        onChange={(e) => updateAssignment(i, { subject: e.target.value })}
                      >
                        {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
                      </select>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => removeAssignment(i)}
                        disabled={assignments.length === 1}
                        title="Remove"
                      >
                        <FiX size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={addAssignment}
                  >
                    <FiPlus size={14} /> Add another
                  </button>
                </div>
              </>
            )}

            <div className="enroll-card__actions enroll-card__actions--end">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setForm(emptyForm);
                  setAssignments([{ className: '', subject: 'Mathematics' }]);
                }}
              >
                Clear
              </button>
              <button className="btn btn--primary">
                <FiUserPlus size={16} /> Enroll Teacher
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}