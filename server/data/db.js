const users = [
  { id: 1, name: 'Ada Obi',      email: 'student@school.com', password: 'student123', role: 'student', profileId: 1 },
  { id: 2, name: 'John Bello',   email: 'teacher@school.com', password: 'teacher123', role: 'teacher', profileId: 1 },
  { id: 3, name: 'Grace Ade',    email: 'admin@school.com',   password: 'admin123',   role: 'admin',   profileId: 1 },
  { id: 4, name: 'Musa Ibrahim', email: 'musa@school.com',    password: 'student123', role: 'student', profileId: 2 },
  { id: 5, name: 'Chioma Nwosu', email: 'chioma@school.com',  password: 'student123', role: 'student', profileId: 3 },
];

const students = [
  { id: 1, userId: 1, name: 'Ada Obi', admissionNo: 'STD/2024/001', className: 'JSS 2A', gender: 'Female', dob: '2012-04-11',
    guardianName: 'Mr. Peter Obi', guardianPhone: '0803 111 2222', address: '12 Allen Avenue, Ikeja, Lagos',
    email: 'student@school.com', photo: '', house: 'Blue House' },
  { id: 2, userId: 4, name: 'Musa Ibrahim', admissionNo: 'STD/2024/002', className: 'JSS 2A', gender: 'Male', dob: '2012-08-02',
    guardianName: 'Alhaji Ibrahim', guardianPhone: '0805 333 4444', address: '7 Ahmadu Bello Way, Kaduna',
    email: 'musa@school.com', photo: '', house: 'Red House' },
  { id: 3, userId: 5, name: 'Chioma Nwosu', admissionNo: 'STD/2024/003', className: 'JSS 2A', gender: 'Female', dob: '2012-01-19',
    guardianName: 'Mrs. Nwosu', guardianPhone: '0807 555 6666', address: '3 Okigwe Road, Owerri',
    email: 'chioma@school.com', photo: '', house: 'Green House' },
];

const teachers = [
  { id: 1, userId: 2, name: 'John Bello', staffNo: 'TCH/001', email: 'teacher@school.com', phone: '0802 000 1111',
    subjects: ['Mathematics', 'Further Mathematics'], formClass: 'JSS 2A', qualification: 'B.Sc Mathematics, PGDE',
    address: '5 Unity Close, Ibadan', joined: '2020-09-01' }
];

const admins = [
  { id: 1, userId: 3, name: 'Grace Ade', title: 'Principal', email: 'admin@school.com', phone: '0809 777 8888',
    office: 'Principal’s Office, Admin Block', joined: '2015-01-12' }
];

const classes = [
  { id: 1, name: 'JSS 2A', teacherId: 1,
    subjects: ['Mathematics', 'English Language', 'Basic Science', 'Social Studies', 'Computer Studies'],
    studentIds: [1, 2, 3],
    schedule: [
      { day: 'Monday',    subject: 'Mathematics',      time: '08:00 - 08:45', teacher: 'Mr. John Bello' },
      { day: 'Monday',    subject: 'English Language', time: '08:45 - 09:30', teacher: 'Mrs. Kalu' },
      { day: 'Tuesday',   subject: 'Basic Science',    time: '09:30 - 10:15', teacher: 'Mr. Danjuma' },
      { day: 'Wednesday', subject: 'Social Studies',   time: '10:15 - 11:00', teacher: 'Miss Yemi' },
      { day: 'Thursday',  subject: 'Computer Studies', time: '11:00 - 11:45', teacher: 'Mr. Okafor' },
      { day: 'Friday',    subject: 'Mathematics',      time: '08:00 - 08:45', teacher: 'Mr. John Bello' },
    ] }
];

const results = [
  { id: 1,  studentId: 1, session: '2024/2025', term: 'First Term', subject: 'Mathematics',      ca: 25, exam: 60 },
  { id: 2,  studentId: 1, session: '2024/2025', term: 'First Term', subject: 'English Language', ca: 22, exam: 55 },
  { id: 3,  studentId: 1, session: '2024/2025', term: 'First Term', subject: 'Basic Science',    ca: 24, exam: 58 },
  { id: 4,  studentId: 1, session: '2024/2025', term: 'First Term', subject: 'Social Studies',   ca: 20, exam: 48 },
  { id: 5,  studentId: 1, session: '2024/2025', term: 'First Term', subject: 'Computer Studies', ca: 25, exam: 62 },
  { id: 6,  studentId: 2, session: '2024/2025', term: 'First Term', subject: 'Mathematics',      ca: 18, exam: 40 },
  { id: 7,  studentId: 2, session: '2024/2025', term: 'First Term', subject: 'English Language', ca: 20, exam: 45 },
  { id: 8,  studentId: 2, session: '2024/2025', term: 'First Term', subject: 'Basic Science',    ca: 22, exam: 50 },
  { id: 9,  studentId: 2, session: '2024/2025', term: 'First Term', subject: 'Social Studies',   ca: 19, exam: 42 },
  { id: 10, studentId: 2, session: '2024/2025', term: 'First Term', subject: 'Computer Studies', ca: 21, exam: 47 },
  { id: 11, studentId: 3, session: '2024/2025', term: 'First Term', subject: 'Mathematics',      ca: 23, exam: 55 },
  { id: 12, studentId: 3, session: '2024/2025', term: 'First Term', subject: 'English Language', ca: 25, exam: 60 },
  { id: 13, studentId: 3, session: '2024/2025', term: 'First Term', subject: 'Basic Science',    ca: 21, exam: 52 },
  { id: 14, studentId: 3, session: '2024/2025', term: 'First Term', subject: 'Social Studies',   ca: 22, exam: 51 },
  { id: 15, studentId: 3, session: '2024/2025', term: 'First Term', subject: 'Computer Studies', ca: 24, exam: 58 },
];

const fees = [
  { id: 1, studentId: 1, session: '2024/2025', term: 'First Term',
    items: [{ name: 'Tuition Fee', amount: 45000 }, { name: 'Books & Materials', amount: 8000 }, { name: 'Uniform', amount: 5000 }],
    amountPaid: 30000, date: '2024-09-15', reference: 'FEE-2024-0001', method: 'Bank Transfer' },
  { id: 2, studentId: 1, session: '2023/2024', term: 'Third Term',
    items: [{ name: 'Tuition Fee', amount: 43000 }, { name: 'Books & Materials', amount: 7000 }, { name: 'Excursion', amount: 4000 }],
    amountPaid: 54000, date: '2024-05-10', reference: 'FEE-2024-0002', method: 'Card' },
  { id: 3, studentId: 2, session: '2024/2025', term: 'First Term',
    items: [{ name: 'Tuition Fee', amount: 45000 }, { name: 'Books & Materials', amount: 8000 }],
    amountPaid: 0, date: '2024-09-01', reference: 'FEE-2024-0003', method: '-' },
  { id: 4, studentId: 3, session: '2024/2025', term: 'First Term',
    items: [{ name: 'Tuition Fee', amount: 45000 }, { name: 'Books & Materials', amount: 8000 }, { name: 'Uniform', amount: 5000 }],
    amountPaid: 58000, date: '2024-09-08', reference: 'FEE-2024-0004', method: 'Bank Transfer' },
];

const quizzes = [
  { id: 1, title: 'Algebra Basics Quiz', subject: 'Mathematics', className: 'JSS 2A',
    teacherId: 1, duration: 15, dueDate: '2025-02-20',
    questions: [
      { id: 1, question: 'Solve: 2x + 4 = 10', options: ['x = 2', 'x = 3', 'x = 4', 'x = 5'], answer: 1 },
      { id: 2, question: 'What is 7 × 8?', options: ['54', '56', '64', '48'], answer: 1 },
      { id: 3, question: 'Simplify: 3a + 2a', options: ['5a', '6a', 'a', '5a²'], answer: 0 },
    ] },
  { id: 2, title: 'Basic Science: Living Things', subject: 'Basic Science', className: 'JSS 2A',
    teacherId: 1, duration: 10, dueDate: '2025-02-25',
    questions: [
      { id: 1, question: 'Which of these is a living thing?', options: ['Stone', 'Tree', 'Water', 'Sand'], answer: 1 },
      { id: 2, question: 'Plants make food through…', options: ['Respiration', 'Digestion', 'Photosynthesis', 'Excretion'], answer: 2 },
    ] },
  { id: 3, title: 'English: Parts of Speech', subject: 'English Language', className: 'JSS 2A',
    teacherId: 1, duration: 12, dueDate: '2025-03-01',
    questions: [
      { id: 1, question: '"Quickly" is a…', options: ['Noun', 'Verb', 'Adverb', 'Adjective'], answer: 2 },
      { id: 2, question: 'A naming word is called a…', options: ['Verb', 'Noun', 'Pronoun', 'Adverb'], answer: 1 },
      { id: 3, question: 'Which is a pronoun?', options: ['She', 'Run', 'Beautiful', 'Slowly'], answer: 0 },
    ] },
];

const submissions = [
  { id: 1, quizId: 1, studentId: 2, score: 2, total: 3, date: '2025-02-14' }
];

const announcements = [
  { id: 1, title: 'Mid-Term Break', body: 'School closes on Friday 21st and resumes Monday 3rd.', date: '2025-02-10', audience: 'all' },
  { id: 2, title: 'PTA Meeting', body: 'Parents are invited to the PTA meeting on Saturday 10am.', date: '2025-02-08', audience: 'all' },
];

const classSessions = [
  { id: 1, teacherId: 1, teacherName: 'John Bello', title: 'Algebra Live Tutorial', subject: 'Mathematics',
    className: 'JSS 2A', description: 'Live whiteboard session covering quadratic equations.',
    startTime: '2026-09-12T15:00:00', endTime: '2026-09-12T16:00:00', status: 'scheduled',
    roomId: 'math-jss2a-001' },
  { id: 2, teacherId: 1, teacherName: 'John Bello', title: 'Basic Science — Photosynthesis', subject: 'Basic Science',
    className: 'JSS 2A', description: 'Interactive session with plant-cell diagram.',
    startTime: '2026-09-13T10:00:00', endTime: '2026-09-13T11:00:00', status: 'scheduled',
    roomId: 'sci-jss2a-002' }
];

/* ---------------- NOTES ---------------- */
const notes = [
  {
    id: 1,
    teacherId: 1,
    teacherName: 'John Bello',
    title: 'Quadratic Equations — Worked Examples',
    subject: 'Mathematics',
    className: 'JSS 2A',
    description: 'Step-by-step worked examples from today’s lesson.',
    type: 'pdf',
    fileName: 'sample-quadratics.pdf',
    originalName: 'Quadratic Equations.pdf',
    fileSize: 12048,
    fileUrl: '/uploads/sample-quadratics.pdf',
    uploadedAt: '2026-09-12T09:15:00.000Z'
  },
  {
    id: 2,
    teacherId: 1,
    teacherName: 'John Bello',
    title: 'Photosynthesis — Class Notes',
    subject: 'Basic Science',
    className: 'JSS 2A',
    description: 'Written summary of today’s lesson on photosynthesis.',
    type: 'richtext',
    content:
      '<h2>Photosynthesis</h2>' +
      '<p>Photosynthesis is the process by which <strong>green plants</strong> make their own food using <em>sunlight</em>, water, and carbon dioxide.</p>' +
      '<ul>' +
      '<li><strong>Inputs:</strong> Sunlight, water, CO₂</li>' +
      '<li><strong>Outputs:</strong> Glucose, oxygen</li>' +
      '</ul>' +
      '<blockquote>It happens inside the <strong>chloroplasts</strong> of plant cells.</blockquote>' +
      '<p>Equation: <code>6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂</code></p>',
    uploadedAt: '2026-09-13T10:00:00.000Z'
  }
];

const noteComments = [
  { id: 1, noteId: 1, userId: 1, userName: 'Ada Obi', role: 'student',
    text: 'Thank you sir! The worked examples really helped.',
    date: '2026-09-12T11:00:00.000Z' }
];

/* ---------------- ASSIGNMENTS ---------------- */
const assignments = [
  { id: 1, teacherId: 1, teacherName: 'John Bello',
    title: 'Quadratic Equations Homework', subject: 'Mathematics', className: 'JSS 2A',
    description: 'Solve exercises 1–10 on page 45. Show your working.',
    dueDate: '2026-09-20', totalMarks: 20, createdAt: '2026-09-13T08:00:00.000Z' }
];

const assignmentSubmissions = [
  { id: 1, assignmentId: 1, studentId: 1, studentName: 'Ada Obi',
    text: 'Here are my solutions. Attached working in the note.',
    fileName: null, originalName: null, fileUrl: null,
    submittedAt: '2026-09-14T10:00:00.000Z',
    score: null, feedback: null, gradedAt: null }
];

/* ---------------- NOTIFICATIONS ---------------- */
const notifications = [
  { id: 1, userId: 1, type: 'assignment', title: 'New assignment',
    body: 'John Bello posted "Quadratic Equations Homework"', link: '/student/assignments',
    read: false, createdAt: '2026-09-13T08:00:00.000Z' }
];

const nextId = (arr) => (arr.length ? Math.max(...arr.map((i) => i.id)) + 1 : 1);

module.exports = {
  users, students, teachers, admins, classes,
  results, fees, quizzes, submissions, announcements,
  classSessions,
  notes, noteComments,
  assignments, assignmentSubmissions,
  notifications,
  nextId
};