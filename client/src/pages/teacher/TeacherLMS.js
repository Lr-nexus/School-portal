import { useEffect, useState, useRef } from 'react';
import {
  FiPlus, FiEdit3, FiClipboard, FiUpload, FiDownload,
  FiX, FiAlertCircle, FiCheck, FiFileText,
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useTeacherProfile } from '../../hooks/useTeacherProfile';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

const SUBJECTS = [
  'Mathematics', 'English Language', 'Basic Science',
  'Social Studies', 'Computer Studies',
];

const emptyQuestion = { question: '', options: ['', '', '', ''], answer: 0 };

function parsePastedText(text) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const questions = [];
  const errors = [];

  blocks.forEach((block, idx) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    let question = '';
    const options = [];
    let answerIdx = -1;

    for (const line of lines) {
      const qMatch = line.match(/^(?:Q\d*[:.)]?\s*)(.+)/i);
      const optMatch = line.match(/^([A-Da-d])[).:]\s*(.+)/);
      const ansMatch = line.match(/^(?:Answer|Correct|Ans)\s*[:.]?\s*([A-Da-d1-4])/i);

      if (ansMatch) {
        const v = ansMatch[1].toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(v)) answerIdx = 'ABCD'.indexOf(v);
        else if (/^[1-4]$/.test(v)) answerIdx = Number(v) - 1;
      } else if (optMatch) options.push(optMatch[2].trim());
      else if (qMatch && !question) question = qMatch[1].trim();
    }

    if (!question || options.length < 2) {
      errors.push(`Question ${idx + 1}: missing question text or options`);
      return;
    }
    if (answerIdx < 0 || answerIdx >= options.length) {
      errors.push(`Question ${idx + 1}: missing or invalid "Answer:" line`);
      return;
    }
    while (options.length < 4) options.push(`Option ${options.length + 1}`);

    questions.push({
      id: questions.length + 1, question,
      options: options.slice(0, 4), answer: answerIdx,
    });
  });

  return { questions, errors };
}

const SAMPLE_PASTE = `Q: What is 2 + 2?
A) 3
B) 4
C) 5
D) 6
Answer: B

Q: What is 7 × 8?
A) 48
B) 54
C) 56
D) 64
Answer: C`;

export default function TeacherLMS() {
  const { profile, targets, teacherType, loading: profileLoading } = useTeacherProfile();

  const [quizzes, setQuizzes] = useState([]);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('manual');

  // Shared target (which class+subject this quiz is for)
  const [target, setTarget] = useState({ className: '', subject: '' });

  useEffect(() => {
    if (!target.className && targets.length) {
      setTarget({
        className: targets[0].className,
        subject: targets[0].subject,
      });
    }
  }, [targets, target.className]);

  const load = () => api('/lms/my-quizzes').then(setQuizzes);

  useEffect(() => { load().catch((e) => setMessage(e.message)); }, []);

  if (profileLoading) return <Loader />;

  const noTargets = !targets.length;

  return (
    <div>
      <PageHeader
        title="Tests & Quizzes"
        subtitle={
          noTargets
            ? 'No teaching assignments'
            : teacherType === 'class_teacher'
              ? `Class teacher of ${profile?.formClass}`
              : 'Subject teacher'
        }
      />

      {message && <div className="alert alert--info">{message}</div>}

      {noTargets && (
        <div className="alert alert--error">
          <FiAlertCircle size={16} />
          You have no teaching assignments. Ask the admin to assign you a class / subject.
        </div>
      )}

      {/* ------- Shared target picker ------- */}
      {!noTargets && (
        <div className="card">
          <h3><FiClipboard size={16} /> Quiz target</h3>
          <div className="form-grid">
            <label>Class + Subject
              <select
                value={`${target.className}||${target.subject}`}
                onChange={(e) => {
                  const [className, subject] = e.target.value.split('||');
                  setTarget({ className, subject });
                }}
              >
                <option value="">— Pick a target —</option>
                {targets.map((t, i) => (
                  <option key={i} value={`${t.className}||${t.subject}`}>
                    {t.className} · {t.subject}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'manual' ? 'tab--active' : ''}`}
          onClick={() => { setTab('manual'); setMessage(''); }}
        >
          <FiEdit3 size={16} /> Build Manually
        </button>
        <button
          type="button"
          className={`tab ${tab === 'paste' ? 'tab--active' : ''}`}
          onClick={() => { setTab('paste'); setMessage(''); }}
        >
          <FiClipboard size={16} /> Paste Questions
        </button>
        <button
          type="button"
          className={`tab ${tab === 'bulk' ? 'tab--active' : ''}`}
          onClick={() => { setTab('bulk'); setMessage(''); }}
        >
          <FiUpload size={16} /> Bulk Import
        </button>
      </div>

      {tab === 'manual' && (
        <ManualTab target={target} noTargets={noTargets} setMessage={setMessage} onCreated={load} />
      )}
      {tab === 'paste' && (
        <PasteTab target={target} noTargets={noTargets} setMessage={setMessage} onCreated={load} />
      )}
      {tab === 'bulk' && (
        <BulkTab target={target} noTargets={noTargets} setMessage={setMessage} onCreated={load} />
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <h3>My Quizzes ({quizzes.length})</h3>
        <table className="table table--striped">
          <thead>
            <tr>
              <th>Title</th><th>Subject</th><th>Class</th>
              <th>Questions</th><th>Due</th>
            </tr>
          </thead>
          <tbody>
            {quizzes.map((q) => (
              <tr key={q.id}>
                <td>{q.title}</td><td>{q.subject}</td><td>{q.className}</td>
                <td>{q.questionCount}</td><td>{q.dueDate}</td>
              </tr>
            ))}
            {!quizzes.length && (
              <tr><td colSpan="5" className="muted">No quizzes created yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Manual ---------------- */
function ManualTab({ target, noTargets, setMessage, onCreated }) {
  const [form, setForm] = useState({
    title: '', duration: 10, dueDate: '',
    questions: [{ ...emptyQuestion, options: ['', '', '', ''] }],
  });

  const updateQuestion = (i, field, value) => {
    const qs = [...form.questions];
    qs[i][field] = value;
    setForm({ ...form, questions: qs });
  };
  const updateOption = (qi, oi, value) => {
    const qs = [...form.questions];
    qs[qi].options[oi] = value;
    setForm({ ...form, questions: qs });
  };
  const addQuestion = () =>
    setForm({ ...form, questions: [...form.questions, { ...emptyQuestion, options: ['', '', '', ''] }] });
  const removeQuestion = (i) => {
    if (form.questions.length === 1) return;
    setForm({ ...form, questions: form.questions.filter((_, idx) => idx !== i) });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (noTargets) return setMessage('No teaching assignments');
    if (!target.className || !target.subject) return setMessage('Pick a class + subject');

    try {
      await api('/lms/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          subject: target.subject,
          className: target.className,
          duration: form.duration,
          dueDate: form.dueDate,
          questions: form.questions,
        }),
      });
      setMessage('Quiz created successfully');
      setForm({ ...form, title: '', questions: [{ ...emptyQuestion, options: ['', '', '', ''] }] });
      await onCreated();
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div className="card">
      <h3>Build a Quiz</h3>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>Title *
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required disabled={noTargets} />
          </label>
          <label>Duration (mins)
            <input type="number" value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })} disabled={noTargets} />
          </label>
          <label>Due Date
            <input type="date" value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })} disabled={noTargets} />
          </label>
        </div>

        <h4 style={{ marginTop: 20 }}>Questions</h4>
        {form.questions.map((q, qi) => (
          <div className="card card--inner" key={qi}>
            <div className="lms-question-head">
              <strong>Question {qi + 1}</strong>
              {form.questions.length > 1 && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => removeQuestion(qi)}>
                  <FiX size={14} /> Remove
                </button>
              )}
            </div>

            <label>Question text
              <input value={q.question}
                onChange={(e) => updateQuestion(qi, 'question', e.target.value)} required disabled={noTargets} />
            </label>

            <div className="form-grid">
              {q.options.map((opt, oi) => (
                <label key={oi}>
                  <span>
                    <input type="radio" name={`answer-${qi}`}
                      checked={q.answer === oi}
                      onChange={() => updateQuestion(qi, 'answer', oi)} disabled={noTargets} />
                    {' '}Correct
                  </span>
                  <input placeholder={`Option ${oi + 1}`} value={opt}
                    onChange={(e) => updateOption(qi, oi, e.target.value)} required disabled={noTargets} />
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={addQuestion} disabled={noTargets}>
            <FiPlus size={16} /> Add Question
          </button>
          <button className="btn btn--primary" disabled={noTargets}>Publish Quiz</button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- Paste ---------------- */
function PasteTab({ target, noTargets, setMessage, onCreated }) {
  const [form, setForm] = useState({ title: '', duration: 10, dueDate: '', raw: '' });
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState([]);

  const handleParse = () => {
    const { questions, errors: errs } = parsePastedText(form.raw);
    setPreview(questions);
    setErrors(errs);
    if (!questions.length) setMessage('No valid questions found. Check the format.');
    else setMessage(`Parsed ${questions.length} question(s). ${errs.length} skipped.`);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (noTargets) return setMessage('No teaching assignments');
    if (!preview || !preview.length) return setMessage('Parse the questions first');
    if (!form.title) return setMessage('Give the quiz a title');

    try {
      await api('/lms/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          subject: target.subject,
          className: target.className,
          duration: form.duration,
          dueDate: form.dueDate,
          questions: preview,
        }),
      });
      setMessage(`Quiz published with ${preview.length} question(s)`);
      setForm({ ...form, title: '', raw: '' });
      setPreview(null); setErrors([]);
      await onCreated();
    } catch (err) { setMessage(err.message); }
  };

  return (
    <div className="card">
      <h3>Paste Questions</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Format — one question per block, separated by blank lines:
      </p>
      <pre className="lms-format-example">{`Q: What is 2 + 2?
A) 3
B) 4
C) 5
D) 6
Answer: B`}</pre>

      <form onSubmit={submit}>
        <div className="form-grid">
          <label>Quiz Title *
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required disabled={noTargets} />
          </label>
          <label>Duration (mins)
            <input type="number" value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })} disabled={noTargets} />
          </label>
          <label>Due Date
            <input type="date" value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })} disabled={noTargets} />
          </label>
        </div>

        <label>Paste your questions here
          <textarea rows="12" value={form.raw}
            onChange={(e) => setForm({ ...form, raw: e.target.value })}
            placeholder="Q: …&#10;A) …&#10;B) …&#10;C) …&#10;D) …&#10;Answer: B"
            className="lms-paste-textarea" disabled={noTargets} />
        </label>

        <div className="enroll-card__actions" style={{ marginBottom: 12 }}>
          <button type="button" className="btn btn--ghost"
            onClick={() => setForm({ ...form, raw: SAMPLE_PASTE })} disabled={noTargets}>
            <FiFileText size={14} /> Load Sample
          </button>
          <button type="button" className="btn btn--primary"
            onClick={handleParse} disabled={!form.raw.trim() || noTargets}>
            <FiCheck size={14} /> Parse Questions
          </button>
        </div>

        {errors.length > 0 && (
          <div className="alert alert--error" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <strong>Skipped {errors.length} block(s):</strong>
            <ul style={{ marginTop: 6, marginLeft: 18, fontSize: 12 }}>
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {preview && preview.length > 0 && (
          <div className="lms-preview">
            <h4>Preview ({preview.length} questions)</h4>
            {preview.map((q, i) => (
              <div key={i} className="lms-preview__item">
                <strong>{i + 1}. {q.question}</strong>
                <ul>
                  {q.options.map((o, oi) => (
                    <li key={oi} className={oi === q.answer ? 'lms-preview__correct' : ''}>
                      {String.fromCharCode(65 + oi)}) {o}
                      {oi === q.answer && <span className="lms-preview__tick"> ✓ correct</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="modal__actions">
          <button type="submit" className="btn btn--primary"
            disabled={!preview || !preview.length || noTargets}>
            Publish Quiz
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- Bulk ---------------- */
function BulkTab({ target, noTargets, setMessage, onCreated }) {
  const [form, setForm] = useState({ title: '', duration: 10, dueDate: '' });
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f); setResult(null);
  };

  const downloadTemplate = () => {
    const headers = 'question,option1,option2,option3,option4,correct';
    const sample = [
      'What is 2+2?,3,4,5,6,B',
      'What is 7 x 8?,48,54,56,64,C',
      'Which planet is closest to the sun?,Venus,Mercury,Earth,Mars,B',
    ].join('\n');
    const blob = new Blob([headers + '\n' + sample + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'quiz-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (noTargets) return setMessage('No teaching assignments');
    if (!file) return setMessage('Choose a file first');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', form.title);
    fd.append('subject', target.subject);
    fd.append('className', target.className);
    fd.append('duration', form.duration);
    fd.append('dueDate', form.dueDate);

    setImporting(true); setResult(null);
    try {
      const res = await api('/lms/quizzes/bulk', { method: 'POST', body: fd });
      setResult(res);
      setMessage(res.message);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await onCreated();
    } catch (err) { setMessage(err.message); }
    finally { setImporting(false); }
  };

  return (
    <div className="card">
      <h3>Bulk Import from Spreadsheet</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Upload a <strong>.csv</strong>, <strong>.xlsx</strong> or <strong>.xls</strong> file with columns:
        <br />
        <code>question, option1, option2, option3, option4, correct</code>
      </p>

      <form onSubmit={submit}>
        <div className="form-grid">
          <label>Quiz Title *
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required disabled={noTargets} />
          </label>
          <label>Duration (mins)
            <input type="number" value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })} disabled={noTargets} />
          </label>
          <label>Due Date
            <input type="date" value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })} disabled={noTargets} />
          </label>
        </div>

        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
          onChange={handleFile} className="file-drop" disabled={noTargets} />

        {file && (
          <div className="bulk-file-chip"><FiFileText size={14} /> {file.name}</div>
        )}

        <div className="enroll-card__actions" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn--ghost" onClick={downloadTemplate}>
            <FiDownload size={14} /> Template
          </button>
          <button className="btn btn--primary" disabled={!file || importing || noTargets}>
            <FiUpload size={14} /> {importing ? 'Importing…' : 'Upload & Create Quiz'}
          </button>
        </div>

        {result && (
          <div className="import-result" style={{ marginTop: 16 }}>
            <p><strong>{result.message}</strong></p>
            {result.errors && result.errors.length > 0 && (
              <details>
                <summary>⚠️ Skipped rows ({result.errors.length})</summary>
                <ul>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </details>
            )}
          </div>
        )}
      </form>
    </div>
  );
}