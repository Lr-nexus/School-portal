import {
  FiHome, FiCreditCard, FiBook, FiBarChart2,
  FiEdit3, FiUsers, FiUserCheck, FiTrendingUp,
  FiVideo, FiFileText, FiClipboard, FiLayers,
  FiUserPlus, FiBell, FiCalendar, FiCheckSquare,
  FiClock, FiHeart, FiMessageCircle, FiSend
} from 'react-icons/fi';

export const navConfig = {
  student: [
    { to: '/student/home',          label: 'Dashboard',       icon: FiHome },
    { to: '/student/calendar',      label: 'Calendar',        icon: FiCalendar },
    { to: '/student/classroom',     label: 'Classroom',       icon: FiVideo },
    { to: '/student/notes',         label: 'Notes',           icon: FiFileText },
    { to: '/student/assignments',   label: 'Assignments',     icon: FiClipboard },
    { to: '/student/timetable',     label: 'Timetable',       icon: FiClock },
    { to: '/student/attendance',    label: 'My Attendance',   icon: FiCheckSquare },
    { to: '/student/classes',       label: 'Classes',         icon: FiBook },
    { to: '/student/results',       label: 'Check Results',   icon: FiBarChart2 },
    { to: '/student/lms',           label: 'Tests & Quizzes', icon: FiEdit3 },
    { to: '/student/messages',      label: 'Messages',        icon: FiMessageCircle },
    { to: '/student/announcements', label: 'Announcements',   icon: FiBell }
  ],
  teacher: [
    { to: '/teacher/home',          label: 'Dashboard',       icon: FiHome },
    { to: '/teacher/calendar',      label: 'Calendar',        icon: FiCalendar },
    { to: '/teacher/classroom',     label: 'Classroom',       icon: FiVideo },
    { to: '/teacher/notes',         label: 'Notes',           icon: FiFileText },
    { to: '/teacher/assignments',   label: 'Assignments',     icon: FiClipboard },
    { to: '/teacher/timetable',     label: 'Timetable',       icon: FiClock },
    { to: '/teacher/attendance',    label: 'Attendance',      icon: FiCheckSquare },
    { to: '/teacher/students',      label: 'My Students',     icon: FiUsers },
    { to: '/teacher/lms',           label: 'Tests & Quizzes', icon: FiEdit3 },
    { to: '/teacher/messages',      label: 'Messages',        icon: FiMessageCircle },
    { to: '/teacher/announcements', label: 'Announcements',   icon: FiBell }
  ],
  parent: [
    { to: '/parent/home',          label: 'Dashboard',       icon: FiHome },
    { to: '/parent/calendar',      label: 'Calendar',        icon: FiCalendar },
    { to: '/parent/fees',          label: 'Fees & Receipts', icon: FiCreditCard },
    { to: '/parent/results',       label: 'Child Results',   icon: FiBarChart2 },
    { to: '/parent/attendance',    label: 'Attendance',      icon: FiCheckSquare },
    { to: '/parent/timetable',     label: 'Timetable',       icon: FiClock },
    { to: '/parent/messages',      label: 'Messages',        icon: FiMessageCircle },
    { to: '/parent/announcements', label: 'Announcements',   icon: FiBell }
  ],
  admin: [
    { to: '/admin/home',          label: 'Dashboard',       icon: FiHome },
    { to: '/admin/calendar',      label: 'Calendar',        icon: FiCalendar },
    { to: '/admin/enrollment',    label: 'Enrollment',      icon: FiUserPlus },
    { to: '/admin/users',         label: 'Users',           icon: FiUsers },
    { to: '/admin/parents',       label: 'Parents',         icon: FiHeart },
    { to: '/admin/classes',       label: 'Classes',         icon: FiLayers },
    { to: '/admin/fees',          label: 'Fees & Finance',  icon: FiCreditCard },
    { to: '/admin/results',       label: 'Student Results', icon: FiBarChart2 },
    { to: '/admin/analytics',     label: 'Analytics',       icon: FiTrendingUp },
    { to: '/admin/lms',           label: 'Performance',     icon: FiEdit3 },
    { to: '/admin/classroom',     label: 'Live Classes',    icon: FiVideo },
    { to: '/admin/messages',      label: 'Messages',        icon: FiMessageCircle },
    { to: '/admin/sms',           label: 'Bulk SMS',        icon: FiSend },
    { to: '/admin/announcements', label: 'Announcements',   icon: FiBell }
  ]
};