import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiPrinter, FiArrowLeft, FiAlertCircle, FiDownload } from 'react-icons/fi';
import { api } from '../../api/api';

const BASE_URL =
  (process.env.REACT_APP_BACKEND_URL ||
    process.env.REACT_APP_API_URL ||
    'https://school-portal-1-xaio.onrender.com/api'
  ).replace(/\/api\/?$/, '');

export default function StudentIDCard() {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    api(`/reports/id-card/${studentId}`)
      .then(setData)
      .catch((e) => setErrorMsg(e.message));
  }, [studentId]);

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
  if (!data) return <div className="print-page"><div className="loader">Loading…</div></div>;

  const photoSrc = data.student.photo
    ? (data.student.photo.startsWith('http') ? data.student.photo : `${BASE_URL}${data.student.photo}`)
    : null;

  const printCards = () => window.print();

  const download = () => {
    const lines = [
      `${data.school.name}`,
      `${data.school.address}`,
      '',
      `STUDENT ID CARD`,
      '',
      `Name:         ${data.student.name}`,
      `Admission No: ${data.student.admissionNo}`,
      `Class:        ${data.student.className}`,
      `House:        ${data.student.house || '—'}`,
      `Date of Birth: ${data.student.dob || '—'}`,
      `Guardian:     ${data.student.guardianName || '—'}`,
      `Guardian Ph:  ${data.student.guardianPhone || '—'}`,
      '',
      `Valid through: ${data.validThrough}`,
      `Issued: ${data.issuedAt}`,
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `id-card-${data.student.admissionNo}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const idCardJSX = (
    <div className="id-card">
      <div className="id-card__head">
        <div className="id-card__logo">{data.school.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
        <div className="id-card__school">
          <strong>{data.school.name}</strong>
          <span>{data.school.address}</span>
        </div>
      </div>
      <div className="id-card__body">
        <div className="id-card__photo">
          {photoSrc ? <img src={photoSrc} alt={data.student.name} /> : <span>{data.student.name.charAt(0)}</span>}
        </div>
        <div className="id-card__info">
          <h3>{data.student.name}</h3>
          <div className="id-card__row"><span>Class</span><strong>{data.student.className}</strong></div>
          <div className="id-card__row"><span>Adm. No</span><strong>{data.student.admissionNo}</strong></div>
          <div className="id-card__row"><span>House</span><strong>{data.student.house || '—'}</strong></div>
          <div className="id-card__row"><span>DOB</span><strong>{data.student.dob || '—'}</strong></div>
        </div>
      </div>
      <div className="id-card__footer">
        <div>
          <span>Guardian:</span> {data.student.guardianName || '—'}
          {data.student.guardianPhone && <> · {data.student.guardianPhone}</>}
        </div>
        <div>Valid until {data.validThrough}</div>
      </div>
    </div>
  );

  return (
    <div className="print-page">
      <div className="print-toolbar no-print">
        <button className="btn btn--ghost" onClick={() => navigate(-1)}>
          <FiArrowLeft size={16} /> Back
        </button>
        <div className="print-toolbar__center">
          <span className="muted" style={{ fontSize: 13 }}>Two copies print on one A4 sheet</span>
        </div>
        <div className="print-toolbar__right">
          <button className="btn btn--ghost" onClick={download}>
            <FiDownload size={16} /> Download .txt
          </button>
          <button className="btn btn--primary" onClick={printCards}>
            <FiPrinter size={16} /> Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="id-sheet">
        {idCardJSX}
        {idCardJSX}
      </div>
    </div>
  );
}