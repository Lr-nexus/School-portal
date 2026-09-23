import {
  FiHome, FiCreditCard, FiBook, FiBarChart2,
  FiEdit3, FiUsers, FiUserCheck, FiTrendingUp,
  FiVideo, FiFileText, FiClipboard, FiLayers, FiUserPlus
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
    { to: '/teacher/students',    label: 'My Students',     icon: FiUsers },
    { to: '/teacher/lms',         label: 'Tests & Quizzes', icon: FiEdit3 }
  ],
  admin: [
    { to: '/admin/home',        label: 'Dashboard',       icon: FiHome },
    { to: '/admin/enrollment',  label: 'Enrollment',      icon: FiUserPlus },
    { to: '/admin/users',       label: 'Users',           icon: FiUsers },
    { to: '/admin/classes',     label: 'Classes',         icon: FiLayers },
    { to: '/admin/fees',        label: 'Fees & Finance',  icon: FiCreditCard },
    { to: '/admin/results',     label: 'Student Results', icon: FiBarChart2 },
    { to: '/admin/lms',         label: 'Performance',     icon: FiTrendingUp },
    { to: '/admin/classroom',   label: 'Live Classes',    icon: FiVideo }
  ]
};