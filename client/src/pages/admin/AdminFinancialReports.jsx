import { useEffect, useMemo, useState } from 'react';
import {
  FiDollarSign, FiTrendingUp, FiUsers, FiAlertTriangle,
  FiRefreshCw, FiAlertCircle, FiBarChart2, FiCreditCard,
  FiCalendar, FiDownload, FiSearch,
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

const formatNaira = (n) =>
  '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

const SESSIONS = ['2024/2025', '2025/2026', '2023/2024'];
const TERMS = ['First Term', 'Second Term', 'Third Term'];

/* -------------------- SVG chart helpers -------------------- */

function BarChart({ points, valueKey, labelKey, color = 'var(--accent)', unit = '' }) {
  const max = Math.max(...points.map((p) => Number(p[valueKey]) || 0), 1);
  return (
    <div className="fin-bars">
      {points.map((p, i) => {
        const v = Number(p[valueKey]) || 0;
        const pct = Math.round((v / max) * 100);
        return (
          <div className="fin-bar-row" key={i}>
            <div className="fin-bar-row__label">{p[labelKey]}</div>
            <div className="fin-bar-row__track">
              <div
                className="fin-bar-row__fill"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
            <div className="fin-bar-row__value">
              {formatNaira(v)}{unit}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ points }) {
  if (!points.length) return null;
  const chart = { left: 60, right: 620, top: 24, bottom: 200 };
  const max = Math.max(...points.map((p) => p.collected), 1);
  const yFor = (v) => chart.bottom - (v / max) * (chart.bottom - chart.top);
  const xFor = (i) => points.length === 1
    ? (chart.left + chart.right) / 2
    : chart.left + (i / (points.length - 1)) * (chart.right - chart.left);

  const plotted = points.map((p, i) => ({
    ...p,
    x: xFor(i),
    y: yFor(p.collected),
  }));

  const ticks = [0, max / 2, max];

  return (
    <svg viewBox="0 0 640 250" style={{ width: '100%' }}>
      {ticks.map((v, i) => (
        <g key={i}>
          <line
            x1={chart.left} x2={chart.right}
            y1={yFor(v)} y2={yFor(v)}
            stroke="var(--border)" strokeWidth="1"
          />
          <text
            x={chart.left - 8} y={yFor(v) + 4}
            textAnchor="end" fill="var(--muted)" fontSize="10"
          >
            {formatNaira(v)}
          </text>
        </g>
      ))}

      {plotted.length > 1 && (
        <polygon
          points={
            `${plotted[0].x},${chart.bottom} ` +
            plotted.map((p) => `${p.x},${p.y}`).join(' ') +
            ` ${plotted[plotted.length - 1].x},${chart.bottom}`
          }
          fill="rgba(22,163,74,.1)"
        />
      )}

      {plotted.length > 1 && (
        <polyline
          points={plotted.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none" stroke="var(--green)" strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round"
        />
      )}

      {plotted.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke="var(--green)" strokeWidth="2.5" />
          <text
            x={p.x} y={p.y - 10}
            textAnchor="middle" fill="var(--text)" fontSize="10" fontWeight="700"
          >
            {formatNaira(p.collected)}
          </text>
          <text
            x={p.x} y={chart.bottom + 18}
            textAnchor="middle" fill="var(--muted)" fontSize="10"
          >
            {p.month.slice(5)}/{p.month.slice(2, 4)}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* -------------------- Main page -------------------- */

export default function AdminFinancialReports() {
  const [overview, setOverview] = useState(null);
  const [byTerm, setByTerm] = useState([]);
  const [byClass, setByClass] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [trend, setTrend] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');

  const [session, setSession] = useState(SESSIONS[0]);
  const [term, setTerm] = useState('all');
  const [months, setMonths] = useState(12);

  const load = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const qs = new URLSearchParams();
      if (session) qs.set('session', session);
      if (term !== 'all') qs.set('term', term);

      const [ov, termData, classData, debt, tr, rec] = await Promise.all([
        api('/financial/overview'),
        api(`/financial/by-term?session=${session}`),
        api(`/financial/by-class?${qs.toString()}`),
        api('/financial/debtors?limit=15'),
        api(`/financial/trend?months=${months}`),
        api('/financial/recent?limit=12'),
      ]);
      setOverview(ov);
      setByTerm(termData);
      setByClass(classData);
      setDebtors(debt);
      setTrend(tr);
      setRecent(rec);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filteredDebtors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return debtors;
    return debtors.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.admissionNo?.toLowerCase().includes(q) ||
        d.className?.toLowerCase().includes(q)
    );
  }, [debtors, search]);

  if (loading && !overview) return <Loader />;

  return (
    <div>
      <PageHeader
        title="Financial Reports"
        subtitle="Income analysis, term comparisons, and outstanding balances"
      >
        <button className="btn btn--ghost" onClick={load}>
          <FiRefreshCw size={16} /> Refresh
        </button>
      </PageHeader>

      {errorMsg && (
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {errorMsg}
        </div>
      )}

      {/* ---------- KPI strip ---------- */}
      {overview && (
        <>
          <div className="stats-grid">
            <StatCard
              label="Total Billed"
              value={formatNaira(overview.billed)}
              hint={`${overview.studentCount} students`}
              color="#2563eb"
            />
            <StatCard
              label="Collected"
              value={formatNaira(overview.collected)}
              hint={`${overview.collectionRate}% collection rate`}
              color="#16a34a"
            />
            <StatCard
              label="Outstanding"
              value={formatNaira(overview.outstanding)}
              hint={`${overview.unpaid + overview.partial} accounts`}
              color={overview.outstanding > 0 ? '#dc2626' : '#16a34a'}
            />
            <StatCard
              label="Students"
              value={`${overview.fullyPaid}/${overview.studentCount}`}
              hint="Fully paid"
              color="#7c3aed"
            />
          </div>

          {/* ---------- Payment method strip ---------- */}
          {overview.methods.length > 0 && (
            <div className="card">
              <h3><FiCreditCard size={16} /> Payment methods</h3>
              <div className="fin-methods">
                {overview.methods.map((m) => (
                  <div className="fin-method" key={m.name}>
                    <span className="fin-method__label">{m.name}</span>
                    <strong className="fin-method__amount">{formatNaira(m.amount)}</strong>
                    <div className="fin-method__bar">
                      <div
                        className="fin-method__fill"
                        style={{
                          width: `${Math.round((m.amount / overview.collected) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ---------- Income trend ---------- */}
      <div className="card">
        <div className="table-head">
          <h3><FiTrendingUp size={16} /> Monthly income (last {months} months)</h3>
          <select
            value={months}
            onChange={(e) => {
              setMonths(Number(e.target.value));
              api(`/financial/trend?months=${e.target.value}`).then(setTrend);
            }}
            style={{ width: 'auto' }}
          >
            <option value="6">6 months</option>
            <option value="12">12 months</option>
            <option value="18">18 months</option>
          </select>
        </div>
        {trend.length === 0 ? (
          <p className="muted">No payments recorded yet.</p>
        ) : (
          <LineChart points={trend} />
        )}
      </div>

      {/* ---------- Term breakdown ---------- */}
      <div className="grid-2">
        <div className="card">
          <h3><FiBarChart2 size={16} /> By term · {session}</h3>
          {byTerm.length === 0 ? (
            <p className="muted">No fee records for this session.</p>
          ) : (
            <>
              <BarChart
                points={byTerm}
                labelKey="term"
                valueKey="collected"
                color="var(--green)"
              />
              <table className="table table--striped" style={{ marginTop: 14 }}>
                <thead>
                  <tr>
                    <th>Term</th>
                    <th className="right">Billed</th>
                    <th className="right">Collected</th>
                    <th className="right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {byTerm.map((t) => (
                    <tr key={t.term}>
                      <td>{t.term}</td>
                      <td className="right">{formatNaira(t.billed)}</td>
                      <td className="right">{formatNaira(t.collected)}</td>
                      <td className="right">
                        <span
                          className={`pill ${
                            t.rate >= 80 ? 'pill--paid' :
                            t.rate >= 50 ? 'pill--partial' : 'pill--unpaid'
                          }`}
                        >
                          {t.rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="card">
          <div className="table-head">
            <h3><FiUsers size={16} /> By class</h3>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <select value={session} onChange={(e) => { setSession(e.target.value); setTimeout(load, 0); }}>
                {SESSIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select value={term} onChange={(e) => { setTerm(e.target.value); setTimeout(load, 0); }}>
                <option value="all">All terms</option>
                {TERMS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {byClass.length === 0 ? (
            <p className="muted">No data for the selected filters.</p>
          ) : (
            <BarChart
              points={byClass}
              labelKey="className"
              valueKey="collected"
              color="var(--accent)"
            />
          )}
        </div>
      </div>

      {/* ---------- Top debtors ---------- */}
      <div className="card">
        <div className="table-head">
          <h3><FiAlertTriangle size={16} /> Top debtors ({filteredDebtors.length})</h3>
          <div className="filters-bar__search" style={{ maxWidth: 260 }}>
            <FiSearch size={16} />
            <input
              placeholder="Filter by name, class, or admission no…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {filteredDebtors.length === 0 ? (
          <p className="muted">No outstanding balances. 🎉</p>
        ) : (
          <div className="table-wrap">
            <table className="table table--striped">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Guardian</th>
                  <th className="right">Billed</th>
                  <th className="right">Paid</th>
                  <th className="right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {filteredDebtors.map((d, i) => (
                  <tr key={d.studentId}>
                    <td>{i + 1}</td>
                    <td>
                      <strong>{d.name}</strong>
                      <div className="muted" style={{ fontSize: 11 }}>{d.admissionNo}</div>
                    </td>
                    <td>{d.className}</td>
                    <td>
                      <div>{d.guardianName || '—'}</div>
                      {d.guardianPhone && (
                        <div className="muted" style={{ fontSize: 11 }}>
                          {d.guardianPhone}
                        </div>
                      )}
                    </td>
                    <td className="right">{formatNaira(d.billed)}</td>
                    <td className="right">{formatNaira(d.paid)}</td>
                    <td className="right">
                      <strong style={{ color: 'var(--red)' }}>
                        {formatNaira(d.balance)}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------- Recent payments ---------- */}
      <div className="card">
        <h3><FiCalendar size={16} /> Recent payments</h3>
        {recent.length === 0 ? (
          <p className="muted">No payments yet.</p>
        ) : (
          <table className="table table--striped">
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Class</th>
                <th>Session / Term</th>
                <th>Method</th>
                <th className="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.student.name}</td>
                  <td>{r.student.className}</td>
                  <td className="muted">{r.session} · {r.term}</td>
                  <td>{r.method}</td>
                  <td className="right">
                    <strong style={{ color: 'var(--green)' }}>
                      {formatNaira(r.amountPaid)}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}