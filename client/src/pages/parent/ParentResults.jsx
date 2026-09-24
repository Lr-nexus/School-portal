import { useEffect, useState } from 'react';
import {
  FiBarChart2, FiCalendar, FiPrinter, FiAlertCircle,
  FiCreditCard,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function ParentResults() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [session, setSession] = useState('');
  const [term, setTerm] = useState('');
  const navigate = useNavigate();

  const load = async (s, t) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (s) qs.append('session', s);
      if (t) qs.append('term', t);
      const res = await api('/parents/me/child/results' + (qs.toString() ? '?' + qs.toString() : ''));
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

  if (loading && !data) return <Loader />;
  if (errorMsg) {
    return (
      <div>
        <PageHeader title="Child Results" />
        <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>
      </div>
    );
  }
  if (!data) return <Loader />;

  const hasResults = data.subjects.length > 0;
  const childId = data.child.id;

  return (
    <div>
      <PageHeader
        title={`${data.child.name}'s Results`}
        subtitle={`${data.child.className} · ${data.current.session || ''} · ${data.current.term || ''}`}
      >
        <button
          className="btn btn--ghost"
          onClick={() => navigate(`/print/id-card/${childId}`)}
          title="Open your child's printable ID card"
        >
          <FiCreditCard size={16} /> ID Card
        </button>
        <button
          className="btn btn--primary"
          onClick={() =>
            navigate(
              `/print/report-card/${childId}?session=${encodeURIComponent(session)}&term=${encodeURIComponent(term)}`
            )
          }
          disabled={!hasResults}
          title="Open your child's printable report card"
        >
          <FiPrinter size={16} /> Print Report Card
        </button>
      </PageHeader>

      {data.sessions.length > 0 && (
        <div className="card results-filter">
          <div className="results-filter__item">
            <label><FiCalendar size={14} /> Session
              <select value={session} onChange={(e) => load(e.target.value, term)}>
                {data.sessions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <div className="results-filter__item">
            <label><FiCalendar size={14} /> Term
              <select value={term} onChange={(e) => load(session, e.target.value)}>
                {data.terms.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      {!hasResults && (
        <div className="card empty-state">
          <FiBarChart2 size={32} />
          <p>No results recorded for this term.</p>
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