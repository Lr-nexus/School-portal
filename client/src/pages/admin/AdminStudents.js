import { useEffect, useState } from 'react';
import { FiUserPlus } from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({
    name: '', className: 'JSS 2A', gender: 'Female',
    guardianName: '', guardianPhone: ''
  });
  const [message, setMessage] = useState('');

  const load = () => api('/admin/students').then(setStudents);
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/admin/students', { method: 'POST', body: JSON.stringify(form) });
      setMessage('Student added successfully');
      setForm({ name: '', className: 'JSS 2A', gender: 'Female', guardianName: '', guardianPhone: '' });
      await load();
    } catch (err) { setMessage(err.message); }
  };

  return (
    <div>
      <PageHeader title="Students" subtitle="All enrolled students" />
      {message && <div className="alert alert--info">{message}</div>}

      <div className="card">
        <h3><FiUserPlus size={16} /> Enroll New Student</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>Class
            <input value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} />
          </label>
          <label>Gender
            <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option>Female</option>
              <option>Male</option>
            </select>
          </label>
          <label>Guardian
            <input value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} />
          </label>
          <label>Guardian Phone
            <input value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
          </label>
          <div className="form-grid__full">
            <button className="btn btn--primary">
              <FiUserPlus size={16} /> Add Student
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <table className="table table--striped">
          <thead>
            <tr><th>#</th><th>Name</th><th>Admission No</th><th>Class</th><th>Gender</th><th>Guardian</th></tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={s.id}>
                <td>{i + 1}</td><td>{s.name}</td><td>{s.admissionNo}</td>
                <td>{s.className}</td><td>{s.gender}</td><td>{s.guardianName || '—'}</td>
              </tr>
            ))}
            {!students.length && (
              <tr><td colSpan="6">No students enrolled yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}