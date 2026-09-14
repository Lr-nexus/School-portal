import { useEffect, useState } from 'react';
import { FiCheckCircle } from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

export default function StudentLMS() {
  const [quizzes, setQuizzes] = useState([]);
  const [active, setActive] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadQuizzes = () => api('/lms/quizzes').then(setQuizzes);

  useEffect(() => { loadQuizzes().finally(() => setLoading(false)); }, []);

  const startQuiz = async (id) => {
    const q = await api(`/lms/quizzes/${id}`);
    setActive(q);
    setAnswers({});
    setResult(null);
  };

  const submitQuiz = async () => {
    const res = await api(`/lms/quizzes/${active.id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers })
    });
    setResult(res);
    await loadQuizzes();
  };

  if (loading) return <Loader />;

  // ---- taking a quiz ----
  if (active && !result) {
    return (
      <div>
        <PageHeader title={active.title} subtitle={`${active.subject} · ${active.duration} minutes`} />
        <div className="card">
          {active.questions.map((q, index) => (
            <div className="question" key={q.id}>
              <p><strong>{index + 1}. {q.question}</strong></p>
              {q.options.map((opt, i) => (
                <label className="option" key={i}>
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={answers[q.id] === i}
                    onChange={() => setAnswers({ ...answers, [q.id]: i })}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          ))}
          <div className="modal__actions">
            <button className="btn btn--ghost" onClick={() => setActive(null)}>Cancel</button>
            <button className="btn btn--primary" onClick={submitQuiz}>Submit Quiz</button>
          </div>
        </div>
      </div>
    );
  }

  // ---- quiz result ----
  if (result) {
    const percent = Math.round((result.score / result.total) * 100);
    return (
      <div>
        <PageHeader title="Quiz Result" />
        <div className="card result-card">
          <h2>{percent}%</h2>
          <p>You scored {result.score} out of {result.total}</p>
          <button className="btn btn--primary" onClick={() => { setActive(null); setResult(null); }}>
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  // ---- quiz list ----
  return (
    <div>
      <PageHeader title="Tests & Quizzes" subtitle="Take your class quizzes and see your scores" />
      <div className="grid-3">
        {quizzes.map((q) => (
          <div className="card quiz-card" key={q.id}>
            <span className="chip">{q.subject}</span>
            <h3>{q.title}</h3>
            <p>{q.questionCount} questions · {q.duration} mins</p>
            <p className="muted">Due: {q.dueDate}</p>

            {q.completed ? (
              <div className="quiz-done">
                <FiCheckCircle size={16} /> Completed — {q.score}/{q.total}
              </div>
            ) : (
              <button className="btn btn--primary btn--full" onClick={() => startQuiz(q.id)}>
                Start Quiz
              </button>
            )}
          </div>
        ))}
        {!quizzes.length && <p>No quizzes available for your class yet.</p>}
      </div>
    </div>
  );
}