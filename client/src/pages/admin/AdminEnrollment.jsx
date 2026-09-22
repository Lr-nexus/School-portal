import { useState } from 'react';
import { FiUserPlus, FiUserCheck, FiUsers } from 'react-icons/fi';
import PageHeader from '../../components/PageHeader';
import AdminEnrollTeachers from './AdminEnrollTeachers';
import AdminEnrollStudents from './AdminEnrollStudents';

export default function AdminEnrollment() {
  const [tab, setTab] = useState('teachers');

  return (
    <div>
      <PageHeader
        title="Enrollment"
        subtitle="Enroll teachers or students individually, or import them in bulk"
      />

      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'teachers' ? 'tab--active' : ''}`}
          onClick={() => setTab('teachers')}
        >
          <FiUserCheck size={16} /> Enroll Teacher
        </button>
        <button
          type="button"
          className={`tab ${tab === 'students' ? 'tab--active' : ''}`}
          onClick={() => setTab('students')}
        >
          <FiUsers size={16} /> Enroll Student
        </button>
      </div>

      {tab === 'teachers' && <AdminEnrollTeachers />}
      {tab === 'students' && <AdminEnrollStudents />}
    </div>
  );
}