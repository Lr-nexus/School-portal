import { useEffect, useRef, useState } from 'react';
import {
  FiCheckCircle, FiClock, FiAlertCircle, FiSend, FiX,
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

const fmtTime = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function StudentLMS() {
  const [quizzes, setQuizzes] = useState([]);
  const [active, setActive] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [totalTime, setTotalTime] = useState(0);

  /* Keep latest answers + submit function reachable from timers */
  const answersRef = useRef({});
  const autoSubmittedRef = useRef(false);
  const submitRef = useRef(null);

  const loadQuizzes = () => api('/lms/quizzes').then(setQuizzes);

  useEffect(() => {
    loadQuizzes().finally(() => setLoading(false));
  }, []);

  const startQuiz = async (id) => {
    const q = await api(`/lms/quizzes/${id}`);
    setActive(q);
    setAnswers({});
    answersRef.current = {};
    setResult(null);
    autoSubmittedRef.current = false;
    setTotalTime((q.duration || 10) * 60);
    setTimeLeft((q.duration || 10) * 60);
  };

  const submitQuiz = async () => {
    if (!active || submitting) return;
    setSubmitting(true);
    try {
      const res = await api(`/lms/quizzes/${active.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: answersRef.current }),
      });
      setResult(res);
      setTimeLeft(null);
      await loadQuizzes();
    } catch (err) {
      console.error('Submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  /* Keep a stable ref to the latest submitQuiz */
  submitRef.current = submitQuiz;

  /* Tick down every second */
  useEffect(() => {
    if (!active || result) return;
    const id = setInterval(() => {
      setTimeLeft((t) => (t === null ? t : Math.max(0, t - 1)));
    }, 1000);
    return () => clearInterval(id);
  }, [active?.id, result]);

  /* Auto-submit when time hits 0 */
  useEffect(() => {
    if (
      timeLeft === 0 &&
      active &&
      !result &&
      !autoSubmittedRef.current
    ) {
      autoSubmittedRef.current = true;
      submitRef.current?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  /* Keep answersRef in sync */
  const handleAnswer = (qId, optIdx) => {
    const next = { ...answers, [qId]: optIdx };
    setAnswers(next);
    answersRef.current = next;
  };

  if (loading) return <Loader />;

  /* ---------------- Active quiz ---------------- */
  if (active && !result) {
    const warning = timeLeft !== null && timeLeft <= 120 && timeLeft > 30;
    const danger = timeLeft !== null && timeLeft <= 30;
    const pct = totalTime ? (timeLeft / totalTime) * 100 : 0;

    return (
      <div>
        <PageHeader
          title={active.title}
          subtitle={`${active.subject} · ${active.duration} minutes`}
        />

        {/* -------- Timer pill -------- */}
        {timeLeft !== null && (
          <div
            className={`quiz-timer ${
              danger ? 'quiz-timer--danger' : warning ? 'quiz-timer--warning' : ''
            }`}
          >
            <div className="quiz-timer__icon">
              <FiClock size={18} />
            </div>
            <div className="quiz-timer__info">
              <div className="quiz-timer__label">
                {danger ? 'Hurry up!' : warning ? 'Time running out' : 'Time remaining'}
              </div>
              <div className="quiz-timer__value">{fmtTime(timeLeft)}</div>
            </div>
            <div className="quiz-timer__bar">
              <div
                className="quiz-timer__bar-fill"
                style={{ width: `${pct}%` }}
              />
            </div>
            <button
              className="btn btn--primary quiz-timer__submit"
              onClick={submitQuiz}
              disabled={submitting}
            >
              <FiSend size={14} /> {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        )}

        <div className="card">
          {active.questions.map((q, index) => (
            <div className="question" key={q.id}>
              <p>
                <strong>
                  {index + 1}. {q.question}
                </strong>
              </p>
              {q.options.map((opt, i) => (
                <label className="option" key={i}>
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={answers[q.id] === i}
                    onChange={() => handleAnswer(q.id, i)}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          ))}

          <div className="modal__actions">
            <button
              className="btn btn--ghost"
              onClick={() => setActive(null)}
            >
              <FiX size={14} /> Cancel
            </button>
            <button
              className="btn btn--primary"
              onClick={submitQuiz}
              disabled={submitting}
            >
              <FiSend size={14} /> {submitting ? 'Submitting…' : 'Submit Quiz'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- Result ---------------- */
  if (result) {
    const percent = Math.round((result.score / result.total) * 100);
    const grade =
      percent >= 75 ? 'A' :
      percent >= 65 ? 'B' :
      percent >= 55 ? 'C' :
      percent >= 45 ? 'D' :
      percent >= 40 ? 'E' : 'F';
    return (
      <div>
        <PageHeader title="Quiz Result" />
        <div className="card result-card">
          <h2>{percent}%</h2>
          <p>
            You scored {result.score} out of {result.total} · Grade {grade}
          </p>
          {autoSubmittedRef.current && (
            <p className="muted" style={{ fontSize: 13 }}>
              <FiAlertCircle size={12} /> Time ran out — your answers were submitted automatically.
            </p>
          )}
          <button
            className="btn btn--primary"
            onClick={() => {
              setActive(null);
              setResult(null);
              setTimeLeft(null);
            }}
          >
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- Quiz list ---------------- */
  return (
    <div>
      <PageHeader
        title="Tests & Quizzes"
        subtitle="Take your class quizzes and see your scores"
      />
      <div className="grid-3">
        {quizzes.map((q) => (
          <div className="card quiz-card" key={q.id}>
            <span className="chip">{q.subject}</span>
            <h3>{q.title}</h3>
            <p>
              {q.questionCount} questions · {q.duration} mins
            </p>
            <p className="muted">Due: {q.dueDate}</p>

            {q.completed ? (
              <div className="quiz-done">
                <FiCheckCircle size={16} /> Completed — {q.score}/{q.total}
              </div>
            ) : (
              <button
                className="btn btn--primary btn--full"
                onClick={() => startQuiz(q.id)}
              >
                Start Quiz
              </button>
            )}
          </div>
        ))}
        {!quizzes.length && (
          <p>No quizzes available for your class yet.</p>
        )}
      </div>
    </div>
  );
}