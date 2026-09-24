import {
  FiHome, FiCreditCard, FiBook, FiBarChart2,
  FiEdit3, FiUsers, FiUserCheck, FiTrendingUp,
  FiVideo, FiFileText, FiClipboard, FiLayers,
  FiUserPlus, FiBell, FiCalendar, FiCheckSquare,
  FiClock, FiHeart, FiMessageCircle, FiSend
} from 'react-icons/fi';

/* ------------------------------------------------------------------
   Grouped navigation — each role has an array of sections.
   Each section: { label, items: [{ to, label, icon }] }
   ------------------------------------------------------------------ */
export const navConfig = {
  student: [
    {
      label: 'Overview',
      items: [
        { to: '/student/home',     label: 'Dashboard', icon: FiHome },
        { to: '/student/calendar', label: 'Calendar',  icon: FiCalendar },
      ],
    },
    {
      label: 'Learning',
      items: [
        { to: '/student/classroom',   label: 'Classroom',   icon: FiVideo },
        { to: '/student/notes',       label: 'Notes',       icon: FiFileText },
        { to: '/student/assignments', label: 'Assignments', icon: FiClipboard },
        { to: '/student/timetable',   label: 'Timetable',   icon: FiClock },
        { to: '/student/attendance',  label: 'Attendance',  icon: FiCheckSquare },
        { to: '/student/classes',     label: 'Classes',     icon: FiBook },
      ],
    },
    {
      label: 'Assessments',
      items: [
        { to: '/student/results', label: 'Results',         icon: FiBarChart2 },
        { to: '/student/lms',     label: 'Tests & Quizzes', icon: FiEdit3 },
      ],
    },
    {
      label: 'Communication',
      items: [
        { to: '/student/messages',      label: 'Messages',      icon: FiMessageCircle },
        { to: '/student/announcements', label: 'Announcements', icon: FiBell },
      ],
    },
  ],

  teacher: [
    {
      label: 'Overview',
      items: [
        { to: '/teacher/home',     label: 'Dashboard', icon: FiHome },
        { to: '/teacher/calendar', label: 'Calendar',  icon: FiCalendar },
      ],
    },
    {
      label: 'Teaching',
      items: [
        { to: '/teacher/classroom',   label: 'Classroom',   icon: FiVideo },
        { to: '/teacher/notes',       label: 'Notes',       icon: FiFileText },
        { to: '/teacher/timetable',   label: 'Timetable',   icon: FiClock },
        { to: '/teacher/attendance',  label: 'Attendance',  icon: FiCheckSquare },
        { to: '/teacher/students',    label: 'My Students', icon: FiUsers },
      ],
    },
    {
      label: 'Assessments',
      items: [
        { to: '/teacher/assignments', label: 'Assignments',     icon: FiClipboard },
        { to: '/teacher/lms',         label: 'Tests & Quizzes', icon: FiEdit3 },
      ],
    },
    {
      label: 'Communication',
      items: [
        { to: '/teacher/messages',      label: 'Messages',      icon: FiMessageCircle },
        { to: '/teacher/announcements', label: 'Announcements', icon: FiBell },
      ],
    },
  ],

  parent: [
    {
      label: 'Overview',
      items: [
        { to: '/parent/home',     label: 'Dashboard', icon: FiHome },
        { to: '/parent/calendar', label: 'Calendar',  icon: FiCalendar },
      ],
    },
    {
      label: 'My Child',
      items: [
        { to: '/parent/fees',       label: 'Fees & Receipts', icon: FiCreditCard },
        { to: '/parent/results',    label: 'Results',         icon: FiBarChart2 },
        { to: '/parent/attendance', label: 'Attendance',      icon: FiCheckSquare },
        { to: '/parent/timetable',  label: 'Timetable',       icon: FiClock },
      ],
    },
    {
      label: 'Communication',
      items: [
        { to: '/parent/messages',      label: 'Messages',      icon: FiMessageCircle },
        { to: '/parent/announcements', label: 'Announcements', icon: FiBell },
      ],
    },
  ],

  admin: [
    {
      label: 'Overview',
      items: [
        { to: '/admin/home',     label: 'Dashboard', icon: FiHome },
        { to: '/admin/calendar', label: 'Calendar',  icon: FiCalendar },
      ],
    },
    {
      label: 'People',
      items: [
        { to: '/admin/enrollment', label: 'Enrollment', icon: FiUserPlus },
        { to: '/admin/users',      label: 'Users',      icon: FiUsers },
        { to: '/admin/parents',    label: 'Parents',    icon: FiHeart },
        { to: '/admin/classes',    label: 'Classes',    icon: FiLayers },
      ],
    },
    {
      label: 'Academics',
      items: [
        { to: '/admin/results',   label: 'Results',      icon: FiBarChart2 },
        { to: '/admin/lms',       label: 'Performance',  icon: FiEdit3 },
        { to: '/admin/classroom', label: 'Live Classes', icon: FiVideo },
        { to: '/admin/analytics', label: 'Analytics',    icon: FiTrendingUp },
        { to: '/admin/fees',      label: 'Fees',         icon: FiCreditCard },
      ],
    },
    {
      label: 'Communication',
      items: [
        { to: '/admin/messages',      label: 'Messages',      icon: FiMessageCircle },
        { to: '/admin/sms',           label: 'Bulk SMS',      icon: FiSend },
        { to: '/admin/announcements', label: 'Announcements', icon: FiBell },
      ],
    },
  ],
};

/* Flat view — for any consumer that expects a plain list of links */
export const navConfigFlat = Object.fromEntries(
  Object.entries(navConfig).map(([role, groups]) => [
    role,
    groups.flatMap((g) => g.items),
  ])
);