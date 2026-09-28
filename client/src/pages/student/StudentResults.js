import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiBarChart2, FiCalendar, FiAlertCircle,
  FiPrinter, FiCreditCard, FiDownload, FiTrendingUp,
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

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
        <h3><FiTrendingUp size={16} /> Progress by term</h3>
        <span className="muted">Average across subjects</span>
      </div>
      <div className="progress-chart__canvas">
        <svg viewBox="0 0 640 232" role="img" aria-label="Average results by academic term">
          {[0, 50, 100].map((value) => (
            <g key={value}>
              <line x1={chart.left} x2={chart.right} y1={yFor(value)} y2={yFor(value)} className="progress-chart__grid" />
              <text x="36" y={yFor(value) + 4} textAnchor="end" className="progress-chart__axis">{value}</text>
            </g>
          ))}
          {plotted.length > 1 && (
            <polyline
              points={plotted.map((point) => `${point.x},${point.y}`).join(' ')}
              className="progress-chart__line"
            />
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
    </section>
  );
}

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