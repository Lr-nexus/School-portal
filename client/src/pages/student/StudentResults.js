import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiBarChart2, FiCalendar, FiAlertCircle,
  FiPrinter, FiCreditCard, FiDownload,
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function StudentResults() {
  const [data, setData] = useState(null);
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

  useEffect(() => { load(); }, []);

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