import { useEffect, useState } from 'react';
import {
  FiBookOpen, FiCalendar, FiCheck, FiClipboard, FiPlus,
  FiSave, FiTrash2, FiTrendingUp,
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useTeacherProfile } from '../../hooks/useTeacherProfile';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

const TERMS = ['First Term', 'Second Term', 'Third Term'];

function ProgressChart({ points }) {
  const chart = { left: 48, right: 620, top: 20, bottom: 174 };
  const yFor = (value) => chart.top + ((100 - value) / 100) * (chart.bottom - chart.top);
  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  const plotted = points.map((point, index) => ({
    ...point,
    x: points.length === 1
      ? (chart.left + chart.right) / 2
      : chart.left + (index / (points.length - 1)) * (chart.right - chart.left),
    y: yFor(Math.max(0, Math.min(100, Number(point.average) || 0))),
  }));

  return (
    <section className="card progress-chart">
      <div className="progress-chart__heading">
        <h3><FiTrendingUp size={16} /> {points[0].subject} progress</h3>
        <span className="muted">Class average across terms</span>
      </div>
      <div className="progress-chart__canvas">
        <svg viewBox="0 0 640 232" role="img" aria-label="Class average by academic term">
          {[0, 50, 100].map((value) => (
            <g key={value}>
              <line x1={chart.left} x2={chart.right} y1={yFor(value)} y2={yFor(value)} className="progress-chart__grid" />
              <text x="36" y={yFor(value) + 4} textAnchor="end" className="progress-chart__axis">{value}</text>
            </g>
          ))}
          {plotted.length > 1 && (
            <polyline points={plotted.map((point) => `${point.x},${point.y}`).join(' ')} className="progress-chart__line" />
          )}
          {plotted.map((point, index) => (
            <g key={`${point.session}-${point.term}`}>
              <circle cx={point.x} cy={point.y} r="4" className="progress-chart__point" />
              <text x={point.x} y={point.y - 10} textAnchor="middle" className="progress-chart__value">{point.average}%</text>
              {(index % labelStep === 0 || index === plotted.length - 1) && (
                <text x={point.x} y="197" textAnchor="middle" className="progress-chart__label">
                  <tspan x={point.x}>{point.session}</tspan>
                  <tspan x={point.x} dy="13">{point.term}</tspan>
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <p className="muted">{points.reduce((sum, point) => sum + point.studentCount, 0)} recorded grade entries across {points.length} term(s).</p>
    </section>
  );
}

function currentSession() {
  const now = new Date();
  const year = now.getFullYear();
  const start = now.getMonth() >= 8 ? year : year - 1;
  return `${start}/${start + 1}`;
}

export default function AcademicTools() {
  const { targets, loading: profileLoading } = useTeacherProfile();
  const [tab, setTab] = useState('gradebook');
  const [target, setTarget] = useState({ className: '', subject: '' });
  const [session, setSession] = useState(currentSession);
  const [term, setTerm] = useState(TERMS[0]);
  const [gradeRows, setGradeRows] = useState([]);
  const [dirtyIds, setDirtyIds] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [progress, setProgress] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [questionForm, setQuestionForm] = useState({
    question: '', options: ['', '', '', ''], answer: 0,
  });
  const [lessonForm, setLessonForm] = useState({
    title: '', lessonDate: new Date().toISOString().slice(0, 10),
    objectives: '', activities: '', resources: '',
  });

  useEffect(() => {
    if (!target.className && targets.length) setTarget(targets[0]);
  }, [targets, target.className]);

  useEffect(() => {
    if (!target.className || !target.subject) return;
    let active = true;
    setMessage('');
    setBusy(true);

    const load = async () => {
      try {
        if (tab === 'gradebook') {
          const query = new URLSearchParams({
            className: target.className, subject: target.subject, session, term,
          });
          const rows = await api(`/teachers/me/academic/gradebook?${query}`);
          if (active) {
            setGradeRows(rows.map((row) => ({
              ...row, ca: row.ca ?? '', exam: row.exam ?? '',
            })));
            setDirtyIds([]);
          }
        } else if (tab === 'questions') {
          const query = new URLSearchParams({
            className: target.className, subject: target.subject,
          });
          const rows = await api(`/teachers/me/academic/questions?${query}`);
          if (active) setQuestions(rows);
        } else if (tab === 'lessons') {
          const rows = await api('/teachers/me/academic/lessons');
          if (active) setLessons(rows);
        } else {
          const query = new URLSearchParams({
            className: target.className, subject: target.subject,
          });
          const rows = await api(`/teachers/me/academic/progress?${query}`);
          if (active) setProgress(rows.map((row) => ({ ...row, subject: target.subject })));
        }
      } catch (error) {
        if (active) setMessage(error.message);
      } finally {
        if (active) setBusy(false);
      }
    };

    load();
    return () => { active = false; };
  }, [tab, target.className, target.subject, session, term]);

  const changeTarget = (value) => {
    const [className, subject] = value.split('||');
    setTarget({ className, subject });
  };

  const changeGrade = (studentId, field, value) => {
    setGradeRows((rows) => rows.map((row) => (
      row.studentId === studentId ? { ...row, [field]: value } : row
    )));
    setDirtyIds((ids) => ids.includes(studentId) ? ids : [...ids, studentId]);
  };

  const saveGrades = async () => {
    const entries = gradeRows
      .filter((row) => dirtyIds.includes(row.studentId))
      .map((row) => ({
        studentId: row.studentId,
        ca: row.ca === '' ? 0 : Number(row.ca),
        exam: row.exam === '' ? 0 : Number(row.exam),
      }));
    if (!entries.length) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await api('/teachers/me/academic/gradebook', {
        method: 'PUT', body: JSON.stringify({ ...target, session, term, entries }),
      });
      setDirtyIds([]);
      setMessage(result.message);
      setGradeRows((rows) => rows.map((row) => ({
        ...row,
        ca: row.ca === '' ? 0 : row.ca,
        exam: row.exam === '' ? 0 : row.exam,
      })));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const saveQuestion = async (event) => {
    event.preventDefault();
    const options = questionForm.options.map((option) => option.trim());
    while (options.length && !options[options.length - 1]) options.pop();
    if (options.some((option) => !option) || options.length < 2 || Number(questionForm.answer) >= options.length) {
      setMessage('Add at least two options without gaps and select the correct answer.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await api('/teachers/me/academic/questions', {
        method: 'POST',
        body: JSON.stringify({ ...target, ...questionForm, options }),
      });
      setQuestionForm({ question: '', options: ['', '', '', ''], answer: 0 });
      const query = new URLSearchParams(target);
      setQuestions(await api(`/teachers/me/academic/questions?${query}`));
      setMessage('Question added to this subject bank.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const removeQuestion = async (id) => {
    setBusy(true);
    try {
      await api(`/teachers/me/academic/questions/${id}`, { method: 'DELETE' });
      setQuestions((rows) => rows.filter((row) => row.id !== id));
      setMessage('Question removed.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const saveLesson = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await api('/teachers/me/academic/lessons', {
        method: 'POST', body: JSON.stringify({ ...target, ...lessonForm }),
      });
      setLessonForm({
        title: '', lessonDate: new Date().toISOString().slice(0, 10),
        objectives: '', activities: '', resources: '',
      });
      setLessons(await api('/teachers/me/academic/lessons'));
      setMessage('Lesson plan saved.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const removeLesson = async (id) => {
    setBusy(true);
    try {
      await api(`/teachers/me/academic/lessons/${id}`, { method: 'DELETE' });
      setLessons((rows) => rows.filter((row) => row.id !== id));
      setMessage('Lesson plan deleted.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (profileLoading) return <Loader />;

  return (
    <div className="academic-tools">
      <PageHeader title="Academic Tools" subtitle="Plan lessons, curate questions, and enter class grades" />

      {!targets.length ? (
        <div className="alert alert--error">No teaching assignments are linked to your account.</div>
      ) : (
        <>
          <div className="academic-toolbar">
            <label>
              Class and subject
              <select value={`${target.className}||${target.subject}`} onChange={(event) => changeTarget(event.target.value)}>
                {targets.map((item) => (
                  <option key={`${item.className}-${item.subject}`} value={`${item.className}||${item.subject}`}>
                    {item.className} · {item.subject}
                  </option>
                ))}
              </select>
            </label>
            {tab === 'gradebook' && (
              <>
                <label>
                  Session
                  <input value={session} onChange={(event) => setSession(event.target.value)} aria-label="Academic session" />
                </label>
                <label>
                  Term
                  <select value={term} onChange={(event) => setTerm(event.target.value)}>
                    {TERMS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </>
            )}
          </div>

          <div className="tabs academic-tabs" role="tablist" aria-label="Academic tools">
            <button type="button" role="tab" aria-selected={tab === 'gradebook'} className={`tab ${tab === 'gradebook' ? 'tab--active' : ''}`} onClick={() => setTab('gradebook')}>
              <FiClipboard size={16} /> Gradebook
            </button>
            <button type="button" role="tab" aria-selected={tab === 'questions'} className={`tab ${tab === 'questions' ? 'tab--active' : ''}`} onClick={() => setTab('questions')}>
              <FiBookOpen size={16} /> Question Bank
            </button>
            <button type="button" role="tab" aria-selected={tab === 'lessons'} className={`tab ${tab === 'lessons' ? 'tab--active' : ''}`} onClick={() => setTab('lessons')}>
              <FiCalendar size={16} /> Lesson Plans
            </button>
            <button type="button" role="tab" aria-selected={tab === 'progress'} className={`tab ${tab === 'progress' ? 'tab--active' : ''}`} onClick={() => setTab('progress')}>
              <FiTrendingUp size={16} /> Student Progress
            </button>
          </div>

          {message && <div className="alert alert--info" role="status">{message}</div>}

          {tab === 'gradebook' && (
            <section className="card academic-panel">
              <div className="academic-panel__heading">
                <div>
                  <h3>{target.className} · {target.subject}</h3>
                  <p className="muted">CA is out of 30. Exam is out of 70.</p>
                </div>
                <button type="button" className="btn btn--primary" onClick={saveGrades} disabled={busy || !dirtyIds.length}>
                  <FiSave size={15} /> Save {dirtyIds.length ? `${dirtyIds.length} changed` : 'grades'}
                </button>
              </div>
              {busy ? <Loader /> : gradeRows.length ? (
                <div className="table-wrap">
                  <table className="table table--striped academic-gradebook">
                    <thead><tr><th>Student</th><th>Admission No.</th><th>CA / 30</th><th>Exam / 70</th><th>Total / 100</th></tr></thead>
                    <tbody>
                      {gradeRows.map((row) => {
                        const ca = Number(row.ca) || 0;
                        const exam = Number(row.exam) || 0;
                        return (
                          <tr key={row.studentId}>
                            <td><strong>{row.name}</strong></td>
                            <td className="muted">{row.admissionNo}</td>
                            <td><input aria-label={`${row.name} CA score`} type="number" min="0" max="30" step="1" value={row.ca} onChange={(event) => changeGrade(row.studentId, 'ca', event.target.value)} /></td>
                            <td><input aria-label={`${row.name} exam score`} type="number" min="0" max="70" step="1" value={row.exam} onChange={(event) => changeGrade(row.studentId, 'exam', event.target.value)} /></td>
                            <td><strong>{ca + exam}</strong></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <p className="muted">No students are enrolled in this class.</p>}
            </section>
          )}

          {tab === 'questions' && (
            <div className="academic-columns">
              <form className="card academic-panel academic-form" onSubmit={saveQuestion}>
                <h3><FiPlus size={16} /> Add question</h3>
                <label>Question<textarea rows="3" value={questionForm.question} onChange={(event) => setQuestionForm({ ...questionForm, question: event.target.value })} required /></label>
                {questionForm.options.map((option, index) => (
                  <label key={index}>Option {String.fromCharCode(65 + index)}
                    <input value={option} onChange={(event) => setQuestionForm({
                      ...questionForm,
                      options: questionForm.options.map((value, optionIndex) => optionIndex === index ? event.target.value : value),
                    })} required={index < 2} />
                  </label>
                ))}
                <label>Correct answer
                  <select value={questionForm.answer} onChange={(event) => setQuestionForm({ ...questionForm, answer: Number(event.target.value) })}>
                    {questionForm.options.map((option, index) => option.trim() && (
                      <option key={index} value={index}>{String.fromCharCode(65 + index)} · {option}</option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn btn--primary" disabled={busy}><FiPlus size={15} /> Add to {target.subject}</button>
              </form>

              <section className="card academic-panel">
                <h3>{target.subject} bank <span className="muted">{questions.length}</span></h3>
                {busy ? <Loader /> : questions.length ? (
                  <div className="academic-list">
                    {questions.map((item) => (
                      <article className="academic-list__item" key={item.id}>
                        <div>
                          <strong>{item.question}</strong>
                          <ol type="A">{item.options.map((option, index) => <li key={index} className={index === item.answer ? 'academic-answer' : ''}>{option}</li>)}</ol>
                        </div>
                        <button type="button" className="icon-button" title="Remove question" aria-label="Remove question" onClick={() => removeQuestion(item.id)} disabled={busy}><FiTrash2 size={16} /></button>
                      </article>
                    ))}
                  </div>
                ) : <p className="muted">No saved questions for this class and subject yet.</p>}
              </section>
            </div>
          )}

          {tab === 'lessons' && (
            <div className="academic-columns">
              <form className="card academic-panel academic-form" onSubmit={saveLesson}>
                <h3><FiPlus size={16} /> New lesson plan</h3>
                <label>Lesson title<input value={lessonForm.title} onChange={(event) => setLessonForm({ ...lessonForm, title: event.target.value })} required /></label>
                <label>Date<input type="date" value={lessonForm.lessonDate} onChange={(event) => setLessonForm({ ...lessonForm, lessonDate: event.target.value })} required /></label>
                <label>Learning objectives<textarea rows="3" value={lessonForm.objectives} onChange={(event) => setLessonForm({ ...lessonForm, objectives: event.target.value })} required /></label>
                <label>Activities<textarea rows="3" value={lessonForm.activities} onChange={(event) => setLessonForm({ ...lessonForm, activities: event.target.value })} /></label>
                <label>Resources<input value={lessonForm.resources} onChange={(event) => setLessonForm({ ...lessonForm, resources: event.target.value })} /></label>
                <button type="submit" className="btn btn--primary" disabled={busy}><FiCheck size={15} /> Save lesson plan</button>
              </form>

              <section className="card academic-panel">
                <h3>Planned lessons</h3>
                {busy ? <Loader /> : lessons.filter((lesson) => lesson.class_name === target.className && lesson.subject === target.subject).length ? (
                  <div className="academic-list">
                    {lessons.filter((lesson) => lesson.class_name === target.className && lesson.subject === target.subject).map((lesson) => (
                      <article className="academic-list__item" key={lesson.id}>
                        <div>
                          <span className="academic-list__date">{new Date(`${lesson.lesson_date}T00:00:00`).toLocaleDateString()}</span>
                          <h4>{lesson.title}</h4>
                          <p><strong>Objectives:</strong> {lesson.objectives}</p>
                          {lesson.activities && <p><strong>Activities:</strong> {lesson.activities}</p>}
                          {lesson.resources && <p><strong>Resources:</strong> {lesson.resources}</p>}
                        </div>
                        <button type="button" className="icon-button" title="Delete lesson plan" aria-label="Delete lesson plan" onClick={() => removeLesson(lesson.id)} disabled={busy}><FiTrash2 size={16} /></button>
                      </article>
                    ))}
                  </div>
                ) : <p className="muted">No lesson plans for this class and subject.</p>}
              </section>
            </div>
          )}

          {tab === 'progress' && (
            <section className="academic-panel">
              {busy ? <Loader /> : progress.length ? (
                <ProgressChart points={progress} />
              ) : (
                <div className="card empty-state">
                  <FiTrendingUp size={30} />
                  <p>No grade history for {target.className} · {target.subject} yet.</p>
                  <p className="muted">Saved gradebook results will appear here by session and term.</p>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}