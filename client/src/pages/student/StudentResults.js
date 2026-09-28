import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiBarChart2, FiCalendar, FiAlertCircle,
  FiPrinter, FiCreditCard, FiDownload, FiTrendingUp,
} from 'react-icons/fi';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

/* ============================================================
   Progress chart — Recharts area chart
   ============================================================ */
function ProgressChart({ points }) {
  const data = points.map((p) => ({
    session: p.session,
    term: p.term,
    shortTerm: p.term.split(' ')[0],
    label: `${p.session.slice(2, 4)}/${p.session.slice(7, 9)} ${p.term.split(' ')[0]}`,
    average: Number(p.average) || 0,
    studentCount: Number(p.studentCount) || 0,
  }));

  return (
    <section className="card progress-chart">
      <div className="progress-chart__heading">
        <h3><FiTrendingUp size={16} /> Progress by term</h3>
        <span className="muted">Average across subjects</span>
      </div>

      <div className="recharts-wrap">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
            <defs>
              <linearGradient id="studentProgressFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />

            <XAxis
              dataKey="label"
              stroke="var(--muted)"
              tick={{ fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              stroke="var(--muted)"
              tick={{ fontSize: 11 }}
              tickLine={false}
              width={40}
            />

            <Tooltip
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                fontSize: 12,
                color: 'var(--text)',
                boxShadow: '0 8px 24px rgba(15,23,42,.12)',
              }}
              labelFormatter={(_, payload) => {
                if (payload && payload.length) {
                  const p = payload[0].payload;
                  return `${p.session} · ${p.term}`;
                }
                return '';
              }}
              formatter={(value) => [`${value}%`, 'Average']}
            />

            <Area
              type="monotone"
              dataKey="average"
              stroke="var(--accent)"
              strokeWidth={3}
              fill="url(#studentProgressFill)"
              dot={{
                r: 5,
                fill: 'var(--surface)',
                stroke: 'var(--accent)',
                strokeWidth: 2,
              }}
              activeDot={{ r: 7 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

/* ============================================================
   Main page
   ============================================================ */
export default function StudentResults() {
  const [data, setData] = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [session, setSession] = useState('');
  const [term, setTerm] = useState('');
  const navigate = useNavigate();

  const load = async (overrideSession, overrideTerm) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (overrideSession) qs.append('session', overrideSession);
      if (overrideTerm) qs.append('term', overrideTerm);

      const url = '/students/me/results' + (qs.toString() ? '?' + qs.toString() : '');
      const res = await api(url);
      setData(res);
      setSession(res.current.session);
      setTerm(res.current.term);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api('/students/me/results/progress').then(setProgress).catch(() => setProgress([]));
  }, []);

  const changeSelection = (newSession, newTerm) => {
    load(newSession, newTerm);
  };

  if (loading && !data) return <Loader />;
  if (!data) {
    return (
      <div>
        <PageHeader title="Check Results" />
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {errorMsg || 'Could not load results'}
        </div>
      </div>
    );
  }

  const hasResults = data.subjects.length > 0;
  const hasAnyHistory = data.sessions.length > 0;
  const studentId = data.studentId;

  const downloadPdf = () => {
    navigate(
      `/print/report-card/${studentId}` +
        `?session=${encodeURIComponent(session)}` +
        `&term=${encodeURIComponent(term)}` +
        `&autoDownloadPdf=1`
    );
  };

  return (
    <div>
      <PageHeader
        title="Check Results"
        subtitle={
          hasAnyHistory
            ? `${data.current.session || ''} · ${data.current.term || ''}`
            : 'No results available yet'
        }
      >
        {studentId && (
          <>
            <button
              className="btn btn--ghost"
              onClick={() => navigate(`/print/id-card/${studentId}`)}
              title="Open your printable ID card"
            >
              <FiCreditCard size={16} /> My ID Card
            </button>
            <button
              className="btn btn--ghost"
              onClick={() =>
                navigate(
                  `/print/report-card/${studentId}?session=${encodeURIComponent(session)}&term=${encodeURIComponent(term)}`
                )
              }
              disabled={!hasResults}
              title="Open the printable report card"
            >
              <FiPrinter size={16} /> Print Report Card
            </button>
            <button
              className="btn btn--primary"
              onClick={downloadPdf}
              disabled={!hasResults}
              title="Download your report card as PDF"
            >
              <FiDownload size={16} /> Download PDF
            </button>
          </>
        )}
      </PageHeader>

      {errorMsg && (
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {errorMsg}
        </div>
      )}

      {hasAnyHistory && (
        <div className="card results-filter">
          <div className="results-filter__item">
            <label>
              <FiCalendar size={14} /> Session
              <select
                value={session}
                onChange={(e) => changeSelection(e.target.value, term)}
              >
                {data.sessions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="results-filter__item">
            <label>
              <FiCalendar size={14} /> Term
              <select
                value={term}
                onChange={(e) => changeSelection(session, e.target.value)}
              >
                {data.terms.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {progress.length > 0 && <ProgressChart points={progress} />}

      {!hasAnyHistory && (
        <div className="card empty-state">
          <FiBarChart2 size={32} />
          <p>No results have been recorded yet.</p>
          <p className="muted" style={{ fontSize: 13 }}>
            Your results will appear here once teachers submit them.
          </p>
        </div>
      )}

      {hasAnyHistory && !hasResults && (
        <div className="card empty-state">
          <FiBarChart2 size={32} />
          <p>No results for this term.</p>
          <p className="muted" style={{ fontSize: 13 }}>
            Try a different session or term.
          </p>
        </div>
      )}

      {hasResults && (
        <>
          <div className="stats-grid">
            <StatCard label="Average"       value={`${data.average}%`}   color="#2563eb" />
            <StatCard label="Overall Grade" value={data.overallGrade}     color="#16a34a" />
            <StatCard label="Subjects"      value={data.subjects.length}  color="#7c3aed" />
          </div>

          <div className="card">
            <h3><FiBarChart2 size={16} /> Subject Breakdown</h3>
            <table className="table table--striped">
              <thead>
                <tr>
                  <th>Subject</th><th>CA (30)</th><th>Exam (70)</th>
                  <th>Total</th><th>Grade</th><th>Remark</th>
                </tr>
              </thead>
              <tbody>
                {data.subjects.map((r) => (
                  <tr key={r.id}>
                    <td>{r.subject}</td>
                    <td>{r.ca}</td>
                    <td>{r.exam}</td>
                    <td><strong>{r.total}</strong></td>
                    <td><span className={`grade grade--${r.grade}`}>{r.grade}</span></td>
                    <td>{r.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}