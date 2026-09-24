import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import Layout from '../components/Layout';
import Login from '../pages/Login';
import Announcements from '../pages/Announcements';
import Calendar from '../pages/Calendar';
import Messages from '../pages/Messages';
import Analytics from '../pages/Analytics';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword from '../pages/auth/ResetPassword';

/* STUDENT */
import StudentHome from '../pages/student/StudentHome';
import StudentProfile from '../pages/student/StudentProfile';
import StudentClasses from '../pages/student/StudentClasses';
import StudentResults from '../pages/student/StudentResults';
import StudentLMS from '../pages/student/StudentLMS';
import StudentClassroom from '../pages/student/StudentClassroom';
import StudentNotes from '../pages/student/StudentNotes';
import StudentAssignments from '../pages/student/StudentAssignments';
import StudentAttendance from '../pages/student/StudentAttendance';
import StudentTimetable from '../pages/student/StudentTimetable';

/* TEACHER */
import TeacherHome from '../pages/teacher/TeacherHome';
import TeacherProfile from '../pages/teacher/TeacherProfile';
import TeacherLMS from '../pages/teacher/TeacherLMS';
import TeacherClassroom from '../pages/teacher/TeacherClassroom';
import TeacherNotes from '../pages/teacher/TeacherNotes';
import TeacherAssignments from '../pages/teacher/TeacherAssignments';
import TeacherStudents from '../pages/teacher/TeacherStudents';
import TeacherAttendance from '../pages/teacher/TeacherAttendance';
import TeacherTimetable from '../pages/teacher/TeacherTimetable';

/* PARENT */
import ParentHome from '../pages/parent/ParentHome';
import ParentProfile from '../pages/parent/ParentProfile';
import ParentFees from '../pages/parent/ParentFees';
import ParentResults from '../pages/parent/ParentResults';
import ParentAttendance from '../pages/parent/ParentAttendance';
import ParentTimetable from '../pages/parent/ParentTimetable';

/* ADMIN */
import AdminHome from '../pages/admin/AdminHome';
import AdminProfile from '../pages/admin/AdminProfile';
import AdminResults from '../pages/admin/AdminResults';
import AdminLMS from '../pages/admin/AdminLMS';
import AdminClassroom from '../pages/admin/AdminClassroom';
import AdminClasses from '../pages/admin/AdminClasses';
import AdminEnrollment from '../pages/admin/AdminEnrollment';
import AdminUsers from '../pages/admin/AdminUsers';
import AdminFees from '../pages/admin/AdminFees';
import AdminParents from '../pages/admin/AdminParents';
import AdminSMS from '../pages/admin/AdminSMS';

/* SHARED */
import VideoRoom from '../pages/classroom/VideoRoom';
import ReportCard from '../pages/print/ReportCard';
import StudentIDCard from '../pages/print/StudentIDCard';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      {/* Print views */}
      <Route element={<ProtectedRoute roles={['student', 'teacher', 'admin', 'parent']} />}>
        <Route path="/print/report-card/:studentId" element={<ReportCard />} />
        <Route path="/print/id-card/:studentId" element={<StudentIDCard />} />
      </Route>

      {/* STUDENT */}
      <Route element={<ProtectedRoute roles={['student']} />}>
        <Route path="/student" element={<Layout />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home"          element={<StudentHome />} />
          <Route path="calendar"      element={<Calendar />} />
          <Route path="classroom"     element={<StudentClassroom />} />
          <Route path="notes"         element={<StudentNotes />} />
          <Route path="assignments"   element={<StudentAssignments />} />
          <Route path="timetable"     element={<StudentTimetable />} />
          <Route path="attendance"    element={<StudentAttendance />} />
          <Route path="profile"       element={<StudentProfile />} />
          <Route path="classes"       element={<StudentClasses />} />
          <Route path="results"       element={<StudentResults />} />
          <Route path="lms"           element={<StudentLMS />} />
          <Route path="messages"      element={<Messages />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="*"             element={<Navigate to="home" replace />} />
        </Route>
      </Route>

      {/* VIDEO ROOM */}
      <Route element={<ProtectedRoute roles={['student', 'teacher', 'admin', 'parent']} />}>
        <Route path="/classroom/room/:roomId" element={<VideoRoom />} />
      </Route>

      {/* TEACHER */}
      <Route element={<ProtectedRoute roles={['teacher']} />}>
        <Route path="/teacher" element={<Layout />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home"          element={<TeacherHome />} />
          <Route path="calendar"      element={<Calendar />} />
          <Route path="classroom"     element={<TeacherClassroom />} />
          <Route path="notes"         element={<TeacherNotes />} />
          <Route path="assignments"   element={<TeacherAssignments />} />
          <Route path="timetable"     element={<TeacherTimetable />} />
          <Route path="attendance"    element={<TeacherAttendance />} />
          <Route path="profile"       element={<TeacherProfile />} />
          <Route path="students"      element={<TeacherStudents />} />
          <Route path="lms"           element={<TeacherLMS />} />
          <Route path="messages"      element={<Messages />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="*"             element={<Navigate to="home" replace />} />
        </Route>
      </Route>

      {/* PARENT */}
      <Route element={<ProtectedRoute roles={['parent']} />}>
        <Route path="/parent" element={<Layout />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home"          element={<ParentHome />} />
          <Route path="calendar"      element={<Calendar />} />
          <Route path="fees"          element={<ParentFees />} />
          <Route path="results"       element={<ParentResults />} />
          <Route path="attendance"    element={<ParentAttendance />} />
          <Route path="timetable"     element={<ParentTimetable />} />
          <Route path="messages"      element={<Messages />} />
          <Route path="profile"       element={<ParentProfile />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="*"             element={<Navigate to="home" replace />} />
        </Route>
      </Route>

      {/* ADMIN */}
      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route path="/admin" element={<Layout />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home"          element={<AdminHome />} />
          <Route path="calendar"      element={<Calendar />} />
          <Route path="enrollment"    element={<AdminEnrollment />} />
          <Route path="users"         element={<AdminUsers />} />
          <Route path="parents"       element={<AdminParents />} />
          <Route path="classes"       element={<AdminClasses />} />
          <Route path="fees"          element={<AdminFees />} />
          <Route path="results"       element={<AdminResults />} />
          <Route path="analytics"     element={<Analytics />} />
          <Route path="lms"           element={<AdminLMS />} />
          <Route path="classroom"     element={<AdminClassroom />} />
          <Route path="messages"      element={<Messages />} />
          <Route path="sms"           element={<AdminSMS />} />
          <Route path="profile"       element={<AdminProfile />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="*"             element={<Navigate to="home" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}