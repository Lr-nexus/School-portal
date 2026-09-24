import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { FiPrinter, FiArrowLeft, FiAlertCircle, FiDownload } from 'react-icons/fi';
import { api } from '../../api/api';

export default function ReportCard() {
  const { studentId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [session, setSession] = useState(searchParams.get('session') || '');
  const [term, setTerm] = useState(searchParams.get('term') || '');

  const load = async (s, t) => {
    try {
      const qs = new URLSearchParams();
      if (s) qs.append('session', s);
      if (t) qs.append('term', t);
      const res = await api(`/reports/report-card/${studentId}` + (qs.toString() ? '?' + qs.toString() : ''));
      setData(res);
      setSession(res.session);
      setTerm(res.term);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  useEffect(() => { load(); }, [studentId]);

  if (errorMsg) {
    return (
      <div className="print-page print-page--error">
        <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>
        <button className="btn btn--ghost" onClick={() => navigate(-1)}>
          <FiArrowLeft size={14} /> Back
        </button>
      </div>
    );
  }

  if (!data) {
    return <div className="print-page"><div className="loader">Loading…</div></div>;
  }

  const buildText = () => {
    const lines = [
      '==============================================',
      `       ${data.school.name.toUpperCase()}`,
      `       ${data.school.address}`,
      '==============================================',
      '',
      `STUDENT:      ${data.student.name}`,
      `Admission:    ${data.student.admissionNo}`,
      `Class:        ${data.student.className}`,
      `Session:      ${data.session}`,
      `Term:         ${data.term}`,
      '',
      '----------------------------------------------',
      'SUBJECT                  CA   EXAM  TOTAL  GRADE  REMARK',
      '----------------------------------------------',
    ];
    data.subjects.forEach((s) => {
      lines.push(
        `${s.subject.padEnd(22).slice(0, 22)}  ${String(s.ca).padStart(3)}  ${String(s.exam).padStart(4)}  ${String(s.total).padStart(5)}  ${s.grade.padEnd(5)}  ${s.remark}`
      );
    });
    lines.push('----------------------------------------------');
    lines.push(`AVERAGE: ${data.average}%    GRADE: ${data.overallGrade}`);
    lines.push(`POSITION: ${data.position ? `${data.position} of ${data.classSize}` : '—'}`);
    lines.push(`ATTENDANCE: ${data.attendanceRate}%`);
    lines.push('');
    lines.push(`Form Teacher: ${data.formTeacher}`);
    lines.push(`Issued: ${data.issuedAt}`);
    lines.push('==============================================');
    return lines.join('\n');
  };

  const download = () => {
    const blob = new Blob([buildText()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-card-${data.student.admissionNo}-${data.session}-${data.term}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="print-page">
      {/* Toolbar — hidden when printing */}
      <div className="print-toolbar no-print">
        <button className="btn btn--ghost" onClick={() => navigate(-1)}>
          <FiArrowLeft size={16} /> Back
        </button>

        <div className="print-toolbar__center">
          {data.sessions.length > 0 && (
            <select value={session} onChange={(e) => load(e.target.value, term)}>
              {data.sessions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <select value={term} onChange={(e) => load(session, e.target.value)}>
            {data.terms.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="print-toolbar__right">
          <button className="btn btn--ghost" onClick={download}>
            <FiDownload size={16} /> Download .txt
          </button>
          <button className="btn btn--primary" onClick={() => window.print()}>
            <FiPrinter size={16} /> Print / Save as PDF
          </button>
        </div>
      </div>

      {/* The actual report card */}
      <div className="report-card">
        {/* Header */}
        <div className="report-card__header">
          <div>
            <h1>{data.school.name}</h1>
            <p>{data.school.address}</p>
            <p>{data.school.phone} · {data.school.email}</p>
            <em>{data.school.motto}</em>
          </div>
          <div className="report-card__title">
            <h2>TERMLY REPORT CARD</h2>
            <p>{data.session} · {data.term}</p>
          </div>
        </div>

        {/* Student meta */}
        <div className="report-card__student">
          <div>
            <span>Name:</span> <strong>{data.student.name}</strong>
          </div>
          <div>
            <span>Admission No:</span> <strong>{data.student.admissionNo}</strong>
          </div>
          <div>
            <span>Class:</span> <strong>{data.student.className}</strong>
          </div>
          <div>
            <span>House:</span> <strong>{data.student.house || '—'}</strong>
          </div>
          <div>
            <span>Gender:</span> <strong>{data.student.gender || '—'}</strong>
          </div>
          <div>
            <span>Form Teacher:</span> <strong>{data.formTeacher}</strong>
          </div>
        </div>

        {/* Subject table */}
        <table className="report-card__table">
          <thead>
            <tr>
              <th>Subject</th>
              <th className="right">CA (30)</th>
              <th className="right">Exam (70)</th>
              <th className="right">Total</th>
              <th>Grade</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            {data.subjects.map((s) => (
              <tr key={s.id}>
                <td>{s.subject}</td>
                <td className="right">{s.ca}</td>
                <td className="right">{s.exam}</td>
                <td className="right"><strong>{s.total}</strong></td>
                <td><span className={`grade grade--${s.grade}`}>{s.grade}</span></td>
                <td>{s.remark}</td>
              </tr>
            ))}
            {!data.subjects.length && (
              <tr><td colSpan="6" className="muted">No results recorded.</td></tr>
            )}
          </tbody>
        </table>

        {/* Summary row */}
        <div className="report-card__summary">
          <div><span>Average:</span> <strong>{data.average}%</strong></div>
          <div><span>Overall Grade:</span> <strong>{data.overallGrade}</strong></div>
          <div>
            <span>Position in Class:</span>{' '}
            <strong>{data.position ? `${data.position} of ${data.classSize}` : '—'}</strong>
          </div>
          <div><span>Attendance:</span> <strong>{data.attendanceRate}%</strong></div>
        </div>

        {/* Remark + signature */}
        <div className="report-card__footer">
          <div className="report-card__remark">
            <span>Form Teacher's Remark:</span>
            <p>{data.overallRemark}</p>
          </div>
          <div className="report-card__signature">
            <div className="sig-line" />
            <p>Principal's Signature</p>
          </div>
          <div className="report-card__signature">
            <div className="sig-line" />
            <p>Date</p>
          </div>
        </div>

        <div className="report-card__meta">
          Issued {data.issuedAt} · Computer-generated document
        </div>
      </div>
    </div>
  );
}