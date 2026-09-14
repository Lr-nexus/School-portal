import { useEffect, useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';

const emptyQuestion = { question: '', options: ['', '', '', ''], answer: 0 };

export default function TeacherLMS() {
  const [quizzes, setQuizzes] = useState([]);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    title: '', subject: 'Mathematics', className: 'JSS 2A',
    duration: 10, dueDate: '', questions: [{ ...emptyQuestion }]
  });

  const load = () => api('/lms/my-quizzes').then(setQuizzes);
  useEffect(() => { load(); }, []);

  const updateQuestion = (index, field, value) => {
    const qs = [...form.questions];
    qs[index][field] = value;
    setForm({ ...form, questions: qs });
  };

  const updateOption = (qIndex, optIndex, value) => {
    const qs = [...form.questions];
    qs[qIndex].options[optIndex] = value;
    setForm({ ...form, questions: qs });
  };

  const addQuestion = () =>
    setForm({ ...form, questions: [...form.questions, { ...emptyQuestion, options: ['', '', '', ''] }] });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/lms/quizzes', { method: 'POST', body: JSON.stringify(form) });
      setMessage('Quiz created successfully');
      setForm({ ...form, title: '', questions: [{ ...emptyQuestion, options: ['', '', '', ''] }] });
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div>
      <PageHeader title="Tests & Quizzes" subtitle="Create and publish quizzes for your classes" />

      {message && <div className="alert alert--info">{message}</div>}

      <div className="card">
        <h3>Create New Quiz</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Title
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </label>

            <label>
              Subject
              <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                {['Mathematics', 'English Language', 'Basic Science', 'Social Studies', 'Computer Studies']
                  .map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>

            <label>
              Class
              <input value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} />
            </label>

            <label>
              Duration (mins)
              <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            </label>

            <label>
              Due Date
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </label>
          </div>

          <h4>Questions</h4>
          {form.questions.map((q, qi) => (
            <div className="card card--inner" key={qi}>
              <label>
                Question {qi + 1}
                <input value={q.question} onChange={(e) => updateQuestion(qi, 'question', e.target.value)} required />
              </label>

              <div className="form-grid">
                {q.options.map((opt, oi) => (
                  <label key={oi}>
                    <span>
                      <input
                        type="radio"
                        name={`answer-${qi}`}
                        checked={q.answer === oi}
                        onChange={() => updateQuestion(qi, 'answer', oi)}
                      />{' '}
                      Correct
                    </span>
                    <input
                      placeholder={`Option ${oi + 1}`}
                      value={opt}
                      onChange={(e) => updateOption(qi, oi, e.target.value)}
                      required
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={addQuestion}>
              <FiPlus size={16} /> Add Question
            </button>
            <button className="btn btn--primary">Publish Quiz</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>My Quizzes</h3>
        <table className="table table--striped">
          <thead><tr><th>Title</th><th>Subject</th><th>Class</th><th>Questions</th><th>Due</th></tr></thead>
          <tbody>
            {quizzes.map((q) => (
              <tr key={q.id}>
                <td>{q.title}</td>
                <td>{q.subject}</td>
                <td>{q.className}</td>
                <td>{q.questionCount}</td>
                <td>{q.dueDate}</td>
              </tr>
            ))}
            {!quizzes.length && <tr><td colSpan="5">No quizzes created yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}