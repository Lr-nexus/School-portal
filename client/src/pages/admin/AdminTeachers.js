import { useEffect, useState } from 'react';
import { FiUserPlus } from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  subjects: '',
  formClass: '',
  qualification: '',
  address: ''
};

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const loadTeachers = () => api('/admin/teachers').then(setTeachers);

  useEffect(() => {
    loadTeachers().finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await api('/admin/teachers', { method: 'POST', body: JSON.stringify(form) });
      setMessage('Teacher enrolled successfully');
      setForm(emptyForm);
      await loadTeachers();
    } catch (err) {
      setMessage(err.message);
    }
  };

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader
        title="Teachers"
        subtitle="Enroll new staff and manage the school's teachers"
      />

      {message && <div className="alert alert--info">{message}</div>}

      <div className="card">
        <h3><FiUserPlus size={16} /> Enroll New Teacher</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Full Name
            <input name="name" value={form.name} onChange={handleChange} required />
          </label>

          <label>
            Email
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </label>

          <label>
            Phone
            <input name="phone" value={form.phone} onChange={handleChange} />
          </label>

          <label>
            Subjects
            <input
              name="subjects"
              value={form.subjects}
              onChange={handleChange}
              placeholder="Mathematics, Further Mathematics"
            />
          </label>

          <label>
            Form Class
            <input
              name="formClass"
              value={form.formClass}
              onChange={handleChange}
              placeholder="JSS 2A"
            />
          </label>

          <label>
            Qualification
            <input
              name="qualification"
              value={form.qualification}
              onChange={handleChange}
              placeholder="B.Sc Mathematics, PGDE"
            />
          </label>

          <label className="form-grid__full">
            Address
            <input name="address" value={form.address} onChange={handleChange} />
          </label>

          <div className="form-grid__full">
            <button className="btn btn--primary">
              <FiUserPlus size={16} /> Enroll Teacher
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>All Teachers ({teachers.length})</h3>
        <table className="table table--striped">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Staff No</th>
              <th>Subjects</th>
              <th>Form Class</th>
              <th>Phone</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t, i) => (
              <tr key={t.id}>
                <td>{i + 1}</td>
                <td>{t.name}</td>
                <td>{t.staffNo}</td>
                <td>{t.subjects.join(', ') || '—'}</td>
                <td>{t.formClass}</td>
                <td>{t.phone || '—'}</td>
                <td>{t.email}</td>
              </tr>
            ))}
            {!teachers.length && (
              <tr><td colSpan="7">No teachers enrolled yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}