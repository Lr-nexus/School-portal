import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import Layout from '../components/Layout';
import Login from '../pages/Login';

/* STUDENT */
import StudentHome from '../pages/student/StudentHome';
import StudentFees from '../pages/student/StudentFees';
import StudentProfile from '../pages/student/StudentProfile';
import StudentClasses from '../pages/student/StudentClasses';
import StudentResults from '../pages/student/StudentResults';
import StudentLMS from '../pages/student/StudentLMS';
import StudentClassroom from '../pages/student/StudentClassroom';
import StudentNotes from '../pages/student/StudentNotes';
import StudentAssignments from '../pages/student/StudentAssignments';

/* TEACHER */
import TeacherHome from '../pages/teacher/TeacherHome';
import TeacherProfile from '../pages/teacher/TeacherProfile';
import TeacherClasses from '../pages/teacher/TeacherClasses';
import TeacherLMS from '../pages/teacher/TeacherLMS';
import TeacherClassroom from '../pages/teacher/TeacherClassroom';
import TeacherNotes from '../pages/teacher/TeacherNotes';
import TeacherAssignments from '../pages/teacher/TeacherAssignments';

/* ADMIN */
import AdminHome from '../pages/admin/AdminHome';
import AdminProfile from '../pages/admin/AdminProfile';
import AdminResults from '../pages/admin/AdminResults';
import AdminLMS from '../pages/admin/AdminLMS';
import AdminClassroom from '../pages/admin/AdminClassroom';
import AdminClasses from '../pages/admin/AdminClasses';
import AdminEnrollment from '../pages/admin/AdminEnrollment';
import AdminUsers from '../pages/admin/AdminUsers';

/* SHARED */
import VideoRoom from '../pages/classroom/VideoRoom';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />

      {/* STUDENT */}
      <Route element={<ProtectedRoute roles={['student']} />}>
        <Route path="/student" element={<Layout />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home"        element={<StudentHome />} />
          <Route path="classroom"   element={<StudentClassroom />} />
          <Route path="notes"       element={<StudentNotes />} />
          <Route path="assignments" element={<StudentAssignments />} />
          <Route path="fees"        element={<StudentFees />} />
          <Route path="profile"     element={<StudentProfile />} />
          <Route path="classes"     element={<StudentClasses />} />
          <Route path="results"     element={<StudentResults />} />
          <Route path="lms"         element={<StudentLMS />} />
          <Route path="*"           element={<Navigate to="home" replace />} />
        </Route>
      </Route>

      {/* VIDEO ROOM */}
      <Route element={<ProtectedRoute roles={['student', 'teacher', 'admin']} />}>
        <Route path="/classroom/room/:roomId" element={<VideoRoom />} />
      </Route>

      {/* TEACHER */}
      <Route element={<ProtectedRoute roles={['teacher']} />}>
        <Route path="/teacher" element={<Layout />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home"        element={<TeacherHome />} />
          <Route path="classroom"   element={<TeacherClassroom />} />
          <Route path="notes"       element={<TeacherNotes />} />
          <Route path="assignments" element={<TeacherAssignments />} />
          <Route path="profile"     element={<TeacherProfile />} />
          <Route path="classes"     element={<TeacherClasses />} />
          <Route path="lms"         element={<TeacherLMS />} />
          <Route path="*"           element={<Navigate to="home" replace />} />
        </Route>
      </Route>

      {/* ADMIN */}
      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route path="/admin" element={<Layout />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home"        element={<AdminHome />} />
          <Route path="enrollment"  element={<AdminEnrollment />} />
          <Route path="users"       element={<AdminUsers />} />
          <Route path="classes"     element={<AdminClasses />} />
          <Route path="results"     element={<AdminResults />} />
          <Route path="lms"         element={<AdminLMS />} />
          <Route path="classroom"   element={<AdminClassroom />} />
          <Route path="profile"     element={<AdminProfile />} />
          <Route path="*"           element={<Navigate to="home" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}