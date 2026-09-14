import {
  FiHome, FiCreditCard, FiBook, FiBarChart2,
  FiEdit3, FiUsers, FiUserCheck, FiTrendingUp,
  FiVideo, FiFileText, FiClipboard
} from 'react-icons/fi';

export const navConfig = {
  student: [
    { to: '/student/home',        label: 'Dashboard',       icon: FiHome },
    { to: '/student/classroom',   label: 'Classroom',       icon: FiVideo },
    { to: '/student/notes',       label: 'Notes',           icon: FiFileText },
    { to: '/student/assignments', label: 'Assignments',     icon: FiClipboard },
    { to: '/student/fees',        label: 'Fees & Receipts', icon: FiCreditCard },
    { to: '/student/classes',     label: 'Classes',         icon: FiBook },
    { to: '/student/results',     label: 'Check Results',   icon: FiBarChart2 },
    { to: '/student/lms',         label: 'Tests & Quizzes', icon: FiEdit3 }
  ],
  teacher: [
    { to: '/teacher/home',        label: 'Dashboard',       icon: FiHome },
    { to: '/teacher/classroom',   label: 'Classroom',       icon: FiVideo },
    { to: '/teacher/notes',       label: 'Notes',           icon: FiFileText },
    { to: '/teacher/assignments', label: 'Assignments',     icon: FiClipboard },
    { to: '/teacher/classes',     label: 'My Classes',      icon: FiBook },
    { to: '/teacher/lms',         label: 'Tests & Quizzes', icon: FiEdit3 }
  ],
  admin: [
    { to: '/admin/home',      label: 'Dashboard',       icon: FiHome },
    { to: '/admin/classroom', label: 'Live Classes',    icon: FiVideo },
    { to: '/admin/students',  label: 'Students',        icon: FiUsers },
    { to: '/admin/teachers',  label: 'Teachers',        icon: FiUserCheck },
    { to: '/admin/results',   label: 'Student Results', icon: FiBarChart2 },
    { to: '/admin/lms',       label: 'Performance',     icon: FiTrendingUp }
  ]
};