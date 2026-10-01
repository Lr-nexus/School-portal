require('dotenv').config();
const pool = require('./db');

const q = (sql, params = []) => pool.query(sql, params);

async function step(label, fn) {
  process.stdout.write(`   → ${label} `);
  try {
    const r = await fn();
    console.log('✓');
    return r;
  } catch (e) {
    console.log('✗');
    console.error(`      ${e.message}`);
    throw e;
  }
}

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};
const daysAhead = (n) => daysAgo(-n);

/* ==================================================================
   LOOKUP HELPERS
   ================================================================== */
async function getTeacherIdByStaff(staffNo) {
  const [rows] = await q('SELECT id, user_id, name FROM teachers WHERE staff_no = ?', [staffNo]);
  return rows[0] || null;
}
async function getStudentIdsByClass(className) {
  const [rows] = await q(
    'SELECT id, user_id, name FROM students WHERE class_name = ? ORDER BY name',
    [className]
  );
  return rows;
}
async function getAdminUserId() {
  const [rows] = await q("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  return rows[0]?.id || null;
}
async function getDemoStudent() {
  const [rows] = await q("SELECT id, user_id, name FROM students WHERE email = 'ada@school.com' LIMIT 1");
  return rows[0] || null;
}

/* ==================================================================
   DATA — LIBRARY
   ================================================================== */
const LIBRARY = [
  /* ---------- Textbooks (all classes) ---------- */
  {
    title: 'New General Mathematics for Junior Secondary Schools 2',
    type: 'book', subject: 'Mathematics', author: 'M.F. Macrae, A.O. Kalejaiye, Z.I. Chima',
    description:
      'The STAN-recommended mathematics textbook for JSS 2. Covers number bases, fractions, decimals, percentages, algebraic processes, geometry, statistics and probability with fully worked examples and revision exercises at the end of each chapter.',
  },
  {
    title: 'New General Mathematics for Junior Secondary Schools 3',
    type: 'book', subject: 'Mathematics', author: 'M.F. Macrae, A.O. Kalejaiye, Z.I. Chima',
    description:
      'JSS 3 mathematics textbook. Includes simultaneous equations, quadratic expressions, trigonometry, mensuration, and comprehensive BECE revision questions at the end of every unit.',
  },
  {
    title: 'New Oxford Secondary English Course Book 2',
    type: 'book', subject: 'English Language', author: 'Ayo Banjo, Ayo Bamgbose, et al.',
    description:
      'Comprehensive English course for JSS 2. Covers comprehension, summary writing, essay composition, letter writing, and grammar drills with a full Nigerian-context reading section.',
  },
  {
    title: 'New Oxford Secondary English Course Book 3',
    type: 'book', subject: 'English Language', author: 'Ayo Banjo, Ayo Bamgbose, et al.',
    description:
      'JSS 3 English textbook. Focuses on examination technique for BECE, advanced comprehension, argumentative essays, and further grammar and vocabulary development.',
  },
  {
    title: 'Basic Science for Junior Secondary Schools Book 2',
    type: 'book', subject: 'Basic Science', author: 'STAN (Science Teachers Association of Nigeria)',
    description:
      'Covers living and non-living things, matter, energy, force, plants and animals, and environmental science. Each chapter ends with practical activities and revision questions.',
  },
  {
    title: 'Basic Science for Junior Secondary Schools Book 3',
    type: 'book', subject: 'Basic Science', author: 'STAN (Science Teachers Association of Nigeria)',
    description:
      'JSS 3 Basic Science. Builds on Book 2 with deeper treatment of chemistry, physics and biology fundamentals, plus a full revision section for BECE.',
  },
  {
    title: 'Fundamentals of Social Studies for Junior Secondary Schools',
    type: 'book', subject: 'Social Studies', author: 'E. O. Ogunleye, A. Adeyemi',
    description:
      'Nigerian civics, culture, family life, geography of West Africa, and citizenship education tailored for JSS students. Richly illustrated with maps, photographs and case studies.',
  },
  {
    title: 'Computer Studies for Junior Secondary Schools',
    type: 'book', subject: 'Computer Studies', author: 'O. O. Ogundele, S. A. Adeyinka',
    description:
      'Introduces computer hardware, software, keyboarding, word processing, spreadsheets, and the fundamentals of information technology. Includes hands-on laboratory exercises.',
  },
  {
    title: 'Basic Technology for Junior Secondary Schools',
    type: 'book', subject: 'Basic Science', author: 'S. O. Amachukwu, K. B. Adebayo',
    description:
      'Technical drawing, woodwork, metalwork, simple machines, and safe use of workshop tools. Designed to build practical skills alongside scientific reasoning.',
  },
  {
    title: 'Nigerian Secondary School Atlas',
    type: 'book', subject: 'Social Studies', author: 'Longman Nigeria',
    description:
      'Colour physical and political maps of Nigeria, Africa and the world. Includes climatic charts, population data, and detailed map-reading exercises for JSS and SSS students.',
  },

  /* ---------- Nigerian literature ---------- */
  {
    title: 'Things Fall Apart', type: 'book', subject: 'English Language', author: 'Chinua Achebe',
    description:
      'The most widely read African novel. The story of Okonkwo and the arrival of British colonialism in Igbo society. Recommended reading for JSS 3 and senior secondary literature.',
  },
  {
    title: 'Arrow of God', type: 'book', subject: 'English Language', author: 'Chinua Achebe',
    description:
      'Achebe\'s third novel, exploring the clash between traditional Igbo religion and colonial Christianity through the tragic figure of Ezeulu, the chief priest of Ulu.',
  },
  {
    title: 'The Lion and the Jewel', type: 'book', subject: 'Literature', author: 'Wole Soyinka',
    description:
      'A comic play set in the village of Ilujinle. Explores the tension between tradition and modernity through the rivalry of Lakunle and Baroka for the hand of Sidi.',
  },
  {
    title: 'The Gods Are Not to Blame', type: 'book', subject: 'Literature', author: 'Ola Rotimi',
    description:
      'A Nigerian adaptation of Sophocles\' Oedipus Rex. King Odewale\'s tragic discovery of his own patricide and incest. A staple of the WASSCE literature syllabus.',
  },
  {
    title: 'Purple Hibiscus', type: 'book', subject: 'English Language', author: 'Chimamanda Ngozi Adichie',
    description:
      'Kambili\'s coming-of-age story against the backdrop of a violent, religious household and political turmoil in 1990s Nigeria. Winner of the Commonwealth Writers\' Prize.',
  },
  {
    title: 'Half of a Yellow Sun', type: 'book', subject: 'English Language', author: 'Chimamanda Ngozi Adichie',
    description:
      'A sweeping novel about the Biafran War, told through the intertwined lives of Olanna, Odenigbo, Ugwu and Richard. Excellent background reading for Nigerian history.',
  },
  {
    title: 'Eze Goes to School', type: 'book', subject: 'English Language', author: 'Onuora Nzekwu & Michael Crowder',
    description:
      'A classic children\'s novel following Eze\'s journey from his village to primary school. Warmly told, culturally rich, and still a favourite for JSS readers.',
  },
  {
    title: 'Chike and the River', type: 'book', subject: 'English Language', author: 'Chinua Achebe',
    description:
      'A charming children\'s novella about a young boy in Onitsha who longs to cross the great Niger River. Simple prose, universal themes.',
  },
  {
    title: 'Without a Silver Spoon', type: 'book', subject: 'Literature', author: 'Eddie Iroh',
    description:
      'Winner of the UNESCO First Prize for Children\'s Literature. A story about honesty, determination and Nigerian childhood values.',
  },
  {
    title: 'Sugar Girl', type: 'book', subject: 'Literature', author: 'Kola Onadipe',
    description:
      'A classic Nigerian adventure novel for young readers. Ralia\'s escape and her journey through the Nigerian countryside.',
  },

  /* ---------- Past questions ---------- */
  {
    title: 'BECE Mathematics Past Questions 2018-2023',
    type: 'past_question', subject: 'Mathematics', className: 'JSS 3A',
    author: 'Lagos State Ministry of Education',
    description:
      'Six years of authentic BECE Mathematics past questions with step-by-step solutions. Ideal revision material for JSS 3 students preparing for the final examination.',
  },
  {
    title: 'BECE English Language Past Questions 2018-2023',
    type: 'past_question', subject: 'English Language', className: 'JSS 3A',
    author: 'Lagos State Ministry of Education',
    description:
      'Complete BECE English past questions — comprehension, lexis and structure, and essay sections — with model answers and examiner\'s notes.',
  },
  {
    title: 'BECE Basic Science Past Questions 2018-2023',
    type: 'past_question', subject: 'Basic Science', className: 'JSS 3A',
    author: 'Lagos State Ministry of Education',
    description:
      'Past BECE Basic Science papers covering biology, chemistry, and physics objectives. Each paper includes a detailed marking scheme.',
  },
  {
    title: 'BECE Social Studies Past Questions 2018-2023',
    type: 'past_question', subject: 'Social Studies', className: 'JSS 3B',
    author: 'Lagos State Ministry of Education',
    description:
      'Historic and recent BECE Social Studies questions. Covers civics, government, and Nigerian society. Includes answer keys.',
  },
  {
    title: 'Common Entrance Practice Tests (Volume 1)',
    type: 'past_question', subject: 'Mathematics', className: 'JSS 1A',
    author: 'National Examinations Council',
    description:
      'Practice papers for the National Common Entrance Examination. Mathematics, English, and General Paper sections with solutions.',
  },

  /* ---------- Articles, videos, links ---------- */
  {
    title: 'Khan Academy — Mathematics Video Library',
    type: 'video', subject: 'Mathematics', author: 'Khan Academy',
    description:
      'Free instructional videos covering arithmetic, fractions, algebra, geometry and statistics. Aligns closely with the JSS curriculum.',
    url: 'https://www.khanacademy.org/math',
  },
  {
    title: 'BBC Bitesize — English Language Revision',
    type: 'link', subject: 'English Language', author: 'BBC',
    description:
      'Bite-sized lessons, quizzes and revision materials on grammar, reading comprehension, and writing skills.',
    url: 'https://www.bbc.co.uk/bitesize',
  },
  {
    title: 'CrashCourse Biology — Photosynthesis Explained',
    type: 'video', subject: 'Basic Science', author: 'CrashCourse (YouTube)',
    description:
      'A 12-minute animated explanation of photosynthesis. Excellent supplement to the JSS 2 Basic Science chapter on plant nutrition.',
    url: 'https://www.youtube.com/results?search_query=crashcourse+photosynthesis',
  },
  {
    title: 'Pre-Colonial Nigeria: An Overview',
    type: 'article', subject: 'Social Studies', author: 'National Commission for Museums and Monuments',
    description:
      'A short, accessible introduction to the great kingdoms of pre-colonial Nigeria — Nok, Benin, Oyo, Kanem-Bornu and the Sokoto Caliphate.',
  },
  {
    title: 'Introduction to Python Programming for Beginners',
    type: 'video', subject: 'Computer Studies', author: 'freeCodeCamp',
    description:
      'A friendly 4-hour crash course in Python. Recommended for JSS 3 students who want to go beyond the standard Computer Studies syllabus.',
    url: 'https://www.youtube.com/results?search_query=python+for+beginners',
  },
];

async function seedLibrary() {
  const [[{ c }]] = await q('SELECT COUNT(*) AS c FROM library_resources');
  if (c > 0) {
    console.log(`   ⏭  Library already has ${c} resources — skipping`);
    return;
  }
  const adminUserId = await getAdminUserId();
  for (const item of LIBRARY) {
    await q(
      `INSERT INTO library_resources
         (title, type, subject, class_name, author, description, url, cover_url, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.title, item.type, item.subject || null, item.className || null,
        item.author || null, item.description || '',
        item.url || null, item.coverUrl || null, adminUserId,
      ]
    );
  }
  console.log(`      ${LIBRARY.length} library resources added`);
}

/* ==================================================================
   DATA — QUESTION BANK (real JSS curriculum questions)
   ================================================================== */
const QUESTION_BANK = [
  /* ---- Mathematics · JSS 2A · Adewale Johnson ---- */
  {
    staffNo: 'TCH/001', className: 'JSS 2A', subject: 'Mathematics',
    questions: [
      { q: 'Simplify: 2/3 + 1/6',        options: ['1/2', '5/6', '3/4', '2/9'],       answer: 1 },
      { q: 'What is the LCM of 12 and 18?', options: ['24', '36', '48', '72'],        answer: 1 },
      { q: 'Solve for x: 3x + 5 = 20',    options: ['3', '5', '6', '7'],               answer: 1 },
      { q: 'Express 0.25 as a fraction in its lowest terms', options: ['1/2', '1/3', '1/4', '2/5'], answer: 2 },
      { q: 'The area of a rectangle is 48 cm². If its length is 8 cm, find its width.', options: ['5 cm', '6 cm', '7 cm', '8 cm'], answer: 1 },
      { q: 'Simplify: -3 + 7 - 2',        options: ['1', '2', '3', '4'],               answer: 1 },
      { q: 'What is the value of 5² - 3²?', options: ['4', '8', '16', '25'],           answer: 2 },
      { q: 'Convert 25% to a decimal',    options: ['0.025', '0.25', '2.5', '25.0'],  answer: 1 },
      { q: 'Find the value of x in 2(x + 3) = 14', options: ['2', '3', '4', '5'],      answer: 2 },
      { q: 'The perimeter of a square is 36 cm. Find the length of one side.', options: ['6 cm', '8 cm', '9 cm', '12 cm'], answer: 2 },
    ],
  },
  /* ---- English Language · JSS 2A · Emeka Nwosu ---- */
  {
    staffNo: 'TCH/007', className: 'JSS 2A', subject: 'English Language',
    questions: [
      { q: 'Choose the option nearest in meaning to "benevolent".', options: ['hostile', 'kind', 'lazy', 'proud'], answer: 1 },
      { q: 'Identify the part of speech of "quickly" in: "She ran quickly."', options: ['noun', 'verb', 'adverb', 'adjective'], answer: 2 },
      { q: 'Choose the correct plural of "child".', options: ['childs', 'childes', 'children', 'childrens'], answer: 2 },
      { q: 'Which of these is a synonym for "brave"?', options: ['cowardly', 'courageous', 'timid', 'weak'], answer: 1 },
      { q: 'Choose the correct option: "Neither John ___ Mary came to the party."', options: ['or', 'nor', 'and', 'but'], answer: 1 },
      { q: 'The correct spelling is:', options: ['recieve', 'receive', 'receeve', 'receve'], answer: 1 },
      { q: 'What is the past tense of "go"?', options: ['goed', 'gone', 'went', 'going'], answer: 2 },
      { q: 'In "The tall boy won the race", "tall" is a/an:', options: ['noun', 'verb', 'adjective', 'adverb'], answer: 2 },
      { q: 'Choose the correct article: "___ honest man is respected everywhere."', options: ['A', 'An', 'The', 'Some'], answer: 1 },
      { q: 'The opposite of "ancient" is:', options: ['old', 'modern', 'historical', 'olden'], answer: 1 },
    ],
  },
  /* ---- Computer Studies · JSS 1A · Blessing Obi ---- */
  {
    staffNo: 'TCH/008', className: 'JSS 1A', subject: 'Computer Studies',
    questions: [
      { q: 'Which of these is an input device?', options: ['monitor', 'keyboard', 'printer', 'speaker'], answer: 1 },
      { q: 'What does "CPU" stand for?', options: ['Central Processing Unit', 'Computer Personal Unit', 'Central Program Unit', 'Control Processing Unit'], answer: 0 },
      { q: 'Which of these is NOT a web browser?', options: ['Chrome', 'Firefox', 'Excel', 'Safari'], answer: 2 },
      { q: '1 kilobyte equals how many bytes?', options: ['100', '512', '1024', '2048'], answer: 2 },
      { q: 'The "brain" of a computer is the ___', options: ['RAM', 'CPU', 'hard disk', 'monitor'], answer: 1 },
      { q: 'Which of these is an example of application software?', options: ['Windows', 'Linux', 'Microsoft Word', 'macOS'], answer: 2 },
      { q: 'The physical parts of a computer are called:', options: ['software', 'hardware', 'firmware', 'malware'], answer: 1 },
      { q: 'Which device is used to type text into a computer?', options: ['mouse', 'keyboard', 'monitor', 'printer'], answer: 1 },
    ],
  },
  /* ---- Basic Science · JSS 3B · Blessing Obi ---- */
  {
    staffNo: 'TCH/008', className: 'JSS 3B', subject: 'Basic Science',
    questions: [
      { q: 'What is the chemical symbol for water?', options: ['H₂O', 'CO₂', 'O₂', 'NaCl'], answer: 0 },
      { q: 'Which organ pumps blood round the body?', options: ['liver', 'lungs', 'heart', 'kidney'], answer: 2 },
      { q: 'The green pigment in plants that traps sunlight is called ___', options: ['chlorophyll', 'haemoglobin', 'melanin', 'carotene'], answer: 0 },
      { q: 'How many bones are in the adult human body?', options: ['186', '206', '226', '246'], answer: 1 },
      { q: 'Which gas do plants take in during photosynthesis?', options: ['oxygen', 'nitrogen', 'carbon dioxide', 'hydrogen'], answer: 2 },
      { q: 'Water boils at ___ °C at sea level.', options: ['0', '50', '100', '200'], answer: 2 },
      { q: 'The process of changing a liquid to a gas is called:', options: ['condensation', 'evaporation', 'sublimation', 'precipitation'], answer: 1 },
      { q: 'Which planet is closest to the Sun?', options: ['Venus', 'Mercury', 'Earth', 'Mars'], answer: 1 },
    ],
  },
  /* ---- Mathematics · JSS 3B · Halima Yusuf ---- */
  {
    staffNo: 'TCH/006', className: 'JSS 3B', subject: 'Mathematics',
    questions: [
      { q: 'Solve for x: 5x - 3 = 2x + 9', options: ['2', '3', '4', '5'], answer: 2 },
      { q: 'Simplify: (2x³)(3x²)', options: ['5x⁵', '6x⁵', '6x⁶', '5x⁶'], answer: 1 },
      { q: 'What is the value of √144?', options: ['11', '12', '13', '14'], answer: 1 },
      { q: 'Expand: (x + 4)(x - 2)', options: ['x² + 2x - 8', 'x² - 2x - 8', 'x² + 6x - 8', 'x² + 2x + 8'], answer: 0 },
      { q: 'Convert 60° to radians', options: ['π/3', 'π/2', 'π/4', '2π/3'], answer: 0 },
      { q: 'The angles of a triangle are in the ratio 2:3:4. The largest angle is:', options: ['60°', '70°', '80°', '90°'], answer: 2 },
      { q: 'If y = 3x + 1, find y when x = 4', options: ['10', '12', '13', '15'], answer: 2 },
      { q: 'Simplify: log₁₀(1000)', options: ['1', '2', '3', '4'], answer: 2 },
    ],
  },
  /* ---- Basic Science · JSS 1B · Musa Ibrahim ---- */
  {
    staffNo: 'TCH/003', className: 'JSS 1B', subject: 'Basic Science',
    questions: [
      { q: 'Which of these is a living thing?', options: ['stone', 'dog', 'water', 'chair'], answer: 1 },
      { q: 'Plants make their own food through a process called:', options: ['respiration', 'photosynthesis', 'digestion', 'transpiration'], answer: 1 },
      { q: 'Which of these is a source of light?', options: ['moon', 'sun', 'book', 'chair'], answer: 1 },
      { q: 'Matter exists in how many states?', options: ['2', '3', '4', '5'], answer: 1 },
      { q: 'Which of these is NOT a mammal?', options: ['dog', 'cat', 'crocodile', 'cow'], answer: 2 },
      { q: 'The air we breathe in contains mostly:', options: ['oxygen', 'nitrogen', 'carbon dioxide', 'hydrogen'], answer: 1 },
      { q: 'A thermometer is used to measure:', options: ['weight', 'length', 'temperature', 'volume'], answer: 2 },
      { q: 'Which of these animals lays eggs?', options: ['cow', 'hen', 'goat', 'dog'], answer: 1 },
    ],
  },
  /* ---- Social Studies · JSS 2B · Ngozi Okafor ---- */
  {
    staffNo: 'TCH/004', className: 'JSS 2B', subject: 'Social Studies',
    questions: [
      { q: 'The head of a state government in Nigeria is the ___', options: ['President', 'Governor', 'Senator', 'Chairman'], answer: 1 },
      { q: 'Nigeria gained independence in which year?', options: ['1960', '1963', '1957', '1970'], answer: 0 },
      { q: 'Which of these is a Nigerian festival?', options: ['Eyo festival', 'Easter', 'Diwali', 'Hanukkah'], answer: 0 },
      { q: 'The three tiers of government in Nigeria are federal, state and ___', options: ['local', 'community', 'ward', 'regional'], answer: 0 },
      { q: 'Which river is the longest in Nigeria?', options: ['Benue', 'Niger', 'Ogun', 'Kaduna'], answer: 1 },
      { q: 'The capital city of Nigeria is:', options: ['Lagos', 'Kano', 'Abuja', 'Ibadan'], answer: 2 },
      { q: 'Nigeria has how many states?', options: ['30', '32', '34', '36'], answer: 3 },
      { q: 'Democracy means government by the ___', options: ['army', 'people', 'king', 'rich'], answer: 1 },
    ],
  },
];

async function seedQuestionBank() {
  let added = 0, skipped = 0;
  for (const group of QUESTION_BANK) {
    const teacher = await getTeacherIdByStaff(group.staffNo);
    if (!teacher) { console.warn(`      ⚠️  Teacher ${group.staffNo} not found`); continue; }

    for (const item of group.questions) {
      const [existing] = await q(
        `SELECT id FROM question_bank
         WHERE teacher_id = ? AND class_name = ? AND subject = ? AND question = ? LIMIT 1`,
        [teacher.id, group.className, group.subject, item.q]
      );
      if (existing.length) { skipped++; continue; }

      await q(
        `INSERT INTO question_bank
           (teacher_id, class_name, subject, question, options, answer,
            source_type, usage_count)
         VALUES (?, ?, ?, ?, ?, ?, 'manual', 0)`,
        [
          teacher.id, group.className, group.subject,
          item.q, JSON.stringify(item.options), item.answer,
        ]
      );
      added++;
    }
  }
  console.log(`      ${added} questions added${skipped ? `, ${skipped} already present` : ''}`);
}

/* ==================================================================
   DATA — BEHAVIOUR REPORTS
   ================================================================== */
const BEHAVIOUR = [
  { staffNo: 'TCH/001', title: 'Helped a struggling classmate during group work', type: 'positive',
    note: 'Volunteered to explain long division to a classmate who was struggling. Demonstrated patience and leadership.' },
  { staffNo: 'TCH/002', title: 'Kept talking during a test', type: 'negative',
    note: 'Was warned twice by the invigilator for talking during the English test. Needs to work on self-discipline.' },
  { staffNo: 'TCH/007', title: 'Outstanding essay on "My Community"', type: 'positive',
    note: 'Wrote a vivid, well-structured 350-word composition. Uses excellent vocabulary and clear paragraphing.' },
  { staffNo: 'TCH/001', title: 'Did not submit homework two days in a row', type: 'negative',
    note: 'Mathematics homework was not submitted on Tuesday and Wednesday. Guardian has been informed.' },
  { staffNo: 'TCH/008', title: 'Volunteered to clean the classroom during break', type: 'positive',
    note: 'Stayed behind during break to help tidy up the classroom without being asked. Excellent community spirit.' },
  { staffNo: 'TCH/002', title: 'Arrived late due to a medical appointment', type: 'neutral',
    note: 'Arrived 40 minutes late. Guardian called ahead to explain. No action needed.' },
  { staffNo: 'TCH/007', title: 'Returned a lost wallet to the school office', type: 'positive',
    note: 'Found a wallet in the corridor and immediately handed it to the office. Exemplary honesty.' },
  { staffNo: 'TCH/004', title: 'Elected as class prefect for this term', type: 'positive',
    note: 'Chosen by classmates to serve as class prefect. A well-deserved recognition of leadership qualities.' },
];

async function seedBehaviour() {
  const [[{ c }]] = await q('SELECT COUNT(*) AS c FROM behaviour_reports');
  if (c > 0) { console.log(`   ⏭  Behaviour log already has ${c} entries — skipping`); return; }

  const students = await getStudentIdsByClass('JSS 2A');
  if (!students.length) { console.log('   ⏭  No JSS 2A students found — skipping'); return; }

  let added = 0;
  for (let i = 0; i < BEHAVIOUR.length; i++) {
    const entry = BEHAVIOUR[i];
    const teacher = await getTeacherIdByStaff(entry.staffNo);
    if (!teacher) continue;
    const student = students[i % students.length];

    await q(
      `INSERT INTO behaviour_reports (student_id, teacher_id, type, title, note, date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [student.id, teacher.id, entry.type, entry.title, entry.note, daysAgo(i * 2 + 1)]
    );
    added++;
  }
  console.log(`      ${added} behaviour notes added`);
}

/* ==================================================================
   DATA — LESSON PLANS
   ================================================================== */
const LESSON_PLANS = [
  {
    staffNo: 'TCH/001', className: 'JSS 2A', subject: 'Mathematics',
    title: 'Introduction to Algebraic Expressions',
    objectives:
      'By the end of this lesson, students will be able to: (1) define algebraic expression and identify its parts (coefficient, variable, constant); (2) distinguish between like and unlike terms; (3) simplify simple algebraic expressions by collecting like terms.',
    activities:
      '1. Recap of arithmetic operations (5 min).\n' +
      '2. Introduce algebraic notation using real-life examples — e.g., "If Ada has x oranges and buys 3 more, how many does she have?" (10 min).\n' +
      '3. Guided board work: label coefficients, variables, constants in 5 expressions (10 min).\n' +
      '4. Group activity: pairs simplify expressions from the textbook (15 min).\n' +
      '5. Class review and homework assignment (5 min).',
    resources: 'New General Mathematics for JSS 2, Chapter 6; chalkboard; exercise books.',
  },
  {
    staffNo: 'TCH/001', className: 'JSS 2A', subject: 'Mathematics',
    title: 'Solving Linear Equations in One Variable',
    objectives:
      'Students will solve linear equations of the form ax + b = c using the balance method and inverse operations.',
    activities:
      '1. Recap of simplifying expressions.\n' +
      '2. Introduce the balance method using a visual scale.\n' +
      '3. Worked examples: 2x + 5 = 13, 3x - 4 = 11, 5x = 45.\n' +
      '4. Board race — students race to solve equations on the board.\n' +
      '5. Assignment: exercise 7B, questions 1-15.',
    resources: 'New General Mathematics for JSS 2, Chapter 7; chalkboard.',
  },
  {
    staffNo: 'TCH/007', className: 'JSS 2A', subject: 'English Language',
    title: 'Comprehension: Identifying Main Ideas',
    objectives:
      'Students will identify the topic sentence, main idea and supporting details of a passage.',
    activities:
      '1. Pre-reading: discuss the passage title.\n' +
      '2. Silent reading of passage.\n' +
      '3. Guided identification of topic sentences in each paragraph.\n' +
      '4. Pair work: summarise the main idea of each paragraph in one sentence.\n' +
      '5. Class discussion and comprehension questions.',
    resources: 'New Oxford Secondary English Course Book 2, Passage 4.',
  },
  {
    staffNo: 'TCH/007', className: 'JSS 2A', subject: 'English Language',
    title: 'Essay Writing: Narrative Composition',
    objectives:
      'Students will plan and write a well-structured narrative essay of at least 250 words.',
    activities:
      '1. Discuss the structure of a narrative essay (beginning, middle, end).\n' +
      '2. Read a sample narrative aloud.\n' +
      '3. Guide students through planning: characters, setting, plot, climax, resolution.\n' +
      '4. In-class writing — "A Day I Will Never Forget".\n' +
      '5. Peer review and teacher feedback.',
    resources: 'New Oxford Secondary English Course Book 2, Chapter 5.',
  },
  {
    staffNo: 'TCH/003', className: 'JSS 1B', subject: 'Basic Science',
    title: 'The Characteristics of Living Things',
    objectives:
      'Students will list and explain the seven characteristics of living things (MR NIGER D).',
    activities:
      '1. Brainstorm: what makes something alive?\n' +
      '2. Introduce MR NIGER D mnemonic.\n' +
      '3. Group activity: sort pictures of living and non-living things.\n' +
      '4. Practical: observe bean seedlings vs. a stone.\n' +
      '5. Homework: exercise from the textbook.',
    resources: 'Basic Science for JSS 1, Chapter 1; bean seedlings; hand lens.',
  },
];

async function seedLessonPlans() {
  const [[{ c }]] = await q('SELECT COUNT(*) AS c FROM lesson_plans');
  if (c > 0) { console.log(`   ⏭  Lesson plans already have ${c} entries — skipping`); return; }

  let added = 0;
  for (let i = 0; i < LESSON_PLANS.length; i++) {
    const lp = LESSON_PLANS[i];
    const teacher = await getTeacherIdByStaff(lp.staffNo);
    if (!teacher) continue;

    await q(
      `INSERT INTO lesson_plans
         (teacher_id, class_name, subject, title, lesson_date, objectives, activities, resources)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        teacher.id, lp.className, lp.subject, lp.title,
        daysAgo(i * 2 + 1), lp.objectives, lp.activities, lp.resources,
      ]
    );
    added++;
  }
  console.log(`      ${added} lesson plans added`);
}

/* ==================================================================
   DATA — MEETINGS
   ================================================================== */
async function seedMeetings() {
  const [[{ c }]] = await q('SELECT COUNT(*) AS c FROM meetings');
  if (c > 0) { console.log(`   ⏭  Meetings already has ${c} entries — skipping`); return; }

  const [parents] = await q('SELECT id, name FROM parents ORDER BY id');
  if (!parents.length) { console.log('   ⏭  No parents found — skipping'); return; }

  const teacher = await getTeacherIdByStaff('TCH/001');
  if (!teacher) return;

  const students = await getStudentIdsByClass('JSS 2A');

  let added = 0;
  for (let i = 0; i < Math.min(parents.length, 3); i++) {
    const p = parents[i];
    const [kids] = await q('SELECT id FROM students WHERE parent_id = ? LIMIT 1', [p.id]);
    if (!kids.length) continue;
    const childId = kids[0].id;

    const samples = [
      { topic: 'Discuss Ada\'s progress in Mathematics', message:
        'Good afternoon. I would like to discuss how Ada is coping with the new algebra topics. I noticed she was a bit worried about the last test.',
        status: 'pending', days: 3 },
      { topic: 'Behaviour and homework routine', message:
        'Could we please meet to talk about homework consistency at home? I want to support better.',
        status: 'accepted', days: 5 },
      { topic: 'End of term review', message: 'I would like a brief review of the term and next term\'s targets.',
        status: 'completed', days: 14 },
    ];
    const s = samples[i % samples.length];

    const [res] = await q(
      `INSERT INTO meetings
         (parent_id, teacher_id, student_id, topic, message,
          preferred_date, preferred_time, duration_minutes, status,
          scheduled_date, scheduled_time, teacher_response, completed_notes)
       VALUES (?, ?, ?, ?, ?, ?, '10:00', 20, ?, ?, '10:00', ?, ?)`,
      [
        p.id, teacher.id, childId, s.topic, s.message,
        daysAhead(s.days), s.status,
        s.status === 'completed' ? daysAgo(2) : daysAhead(s.days),
        s.status === 'accepted'  ? 'Looking forward to meeting you.' :
        s.status === 'completed' ? 'Thank you for coming in.' : null,
        s.status === 'completed' ? 'Reviewed term progress. Student to focus on algebra practice. Parent to check homework every evening.' : null,
      ]
    );
    added++;
  }
  console.log(`      ${added} meeting requests added`);
}

/* ==================================================================
   DATA — CALENDAR EVENTS
   ================================================================== */
const CALENDAR_EVENTS = [
  { title: 'Mid-Term Examinations Begin',   category: 'Exam',    audience: 'all',     offset: 7  },
  { title: 'Mid-Term Break Starts',          category: 'Holiday', audience: 'all',     offset: 14 },
  { title: 'School Resumes After Mid-Term',  category: 'Event',   audience: 'all',     offset: 21 },
  { title: 'PTA Meeting',                    category: 'Meeting', audience: 'all',     offset: 28 },
  { title: 'Inter-House Sports Competition', category: 'Sports',  audience: 'all',     offset: 35 },
  { title: 'Cultural Day Celebration',       category: 'Event',   audience: 'all',     offset: 42 },
  { title: 'End of Term Examinations Begin', category: 'Exam',    audience: 'all',     offset: 56 },
  { title: 'Speech & Prize-Giving Day',      category: 'Event',   audience: 'all',     offset: 63 },
  { title: 'End of Term — Vacation Begins',  category: 'Holiday', audience: 'all',     offset: 66 },
  { title: 'New Term Resumes',               category: 'Event',   audience: 'all',     offset: 90 },
  { title: 'JSS 3 Mock BECE Exams',          category: 'Exam',    audience: 'student', offset: 45 },
  { title: "Children's Day Celebration",     category: 'Event',   audience: 'student', offset: 70 },
  { title: 'Staff Development Workshop',     category: 'Meeting', audience: 'teacher', offset: 20 },
  { title: 'Teachers\' Appraisal Week',      category: 'Meeting', audience: 'teacher', offset: 60 },
];

async function seedCalendarEvents() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) return;

  let added = 0;
  for (const e of CALENDAR_EVENTS) {
    const [existing] = await q('SELECT id FROM calendar_events WHERE title = ?', [e.title]);
    if (existing.length) continue;

    await q(
      `INSERT INTO calendar_events
         (title, description, date, category, audience, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        e.title,
        `${e.title} — see the school notice board for full details.`,
        daysAhead(e.offset),
        e.category, e.audience, adminUserId,
      ]
    );
    added++;
  }
  console.log(`      ${added} calendar events added`);
}

/* ==================================================================
   DATA — ASSIGNMENT TEMPLATES
   ================================================================== */
const ASSIGNMENT_TEMPLATES = [
  {
    staffNo: 'TCH/001', className: 'JSS 2A', subject: 'Mathematics', totalMarks: 20,
    title: 'Weekly Algebra Practice',
    description:
      'Complete exercises 6A and 6B from the textbook. Show all working. Focus on collecting like terms and simplifying algebraic expressions.',
  },
  {
    staffNo: 'TCH/001', className: 'JSS 2A', subject: 'Mathematics', totalMarks: 15,
    title: 'Geometry: Angles and Triangles',
    description:
      'Draw and label each type of triangle (equilateral, isosceles, scalene). Calculate the missing angles in the 8 figures provided on the board.',
  },
  {
    staffNo: 'TCH/007', className: 'JSS 2A', subject: 'English Language', totalMarks: 20,
    title: 'Reading Log — Weekly Summary',
    description:
      'Read one chapter from any Nigerian novel (see Library recommendations) and write a 200-word summary of what happened. Include the title, author and chapter number.',
  },
  {
    staffNo: 'TCH/007', className: 'JSS 2A', subject: 'English Language', totalMarks: 25,
    title: 'Narrative Essay: A Memorable Journey',
    description:
      'Write a 300-word narrative composition describing a journey you will never forget. Use vivid description, clear paragraphs, and correct punctuation.',
  },
  {
    staffNo: 'TCH/003', className: 'JSS 1B', subject: 'Basic Science', totalMarks: 20,
    title: 'Science Lab Report Template',
    description:
      'Use the standard format: Title, Aim, Materials, Method, Observation, Conclusion. Complete a lab report on the bean seedling observation from this week.',
  },
  {
    staffNo: 'TCH/004', className: 'JSS 2B', subject: 'Social Studies', totalMarks: 15,
    title: 'Map Work: Nigerian States and Capitals',
    description:
      'On the outline map provided, label all 36 states and the Federal Capital Territory. Write the capital of each state in the correct position.',
  },
  {
    staffNo: 'TCH/008', className: 'JSS 1A', subject: 'Computer Studies', totalMarks: 20,
    title: 'Computer Hardware Identification',
    description:
      'Label the diagram of a desktop computer, identifying the CPU, RAM, hard disk, motherboard, monitor, keyboard and mouse. Write one function of each.',
  },
];

async function seedAssignmentTemplates() {
  let added = 0, skipped = 0;
  for (const t of ASSIGNMENT_TEMPLATES) {
    const teacher = await getTeacherIdByStaff(t.staffNo);
    if (!teacher) continue;

    const [existing] = await q(
      'SELECT id FROM assignment_templates WHERE teacher_id = ? AND title = ? LIMIT 1',
      [teacher.id, t.title]
    );
    if (existing.length) { skipped++; continue; }

    await q(
      `INSERT INTO assignment_templates
         (teacher_id, title, subject, class_name, description, total_marks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [teacher.id, t.title, t.subject, t.className, t.description, t.totalMarks]
    );
    added++;
  }
  console.log(`      ${added} assignment templates added${skipped ? `, ${skipped} already present` : ''}`);
}

/* ==================================================================
   DATA — READING LIST BOOKMARKS for demo student
   ================================================================== */
async function seedBookmarks() {
  const student = await getDemoStudent();
  if (!student) return;

  const wanted = [
    'Things Fall Apart',
    'New General Mathematics for Junior Secondary Schools 2',
    'BECE Mathematics Past Questions 2018-2023',
    'Khan Academy — Mathematics Video Library',
    'Purple Hibiscus',
  ];

  let added = 0;
  for (const title of wanted) {
    const [res] = await q('SELECT id FROM library_resources WHERE title = ? LIMIT 1', [title]);
    if (!res.length) continue;
    const resourceId = res[0].id;

    const [existing] = await q(
      'SELECT id FROM library_bookmarks WHERE user_id = ? AND resource_id = ? LIMIT 1',
      [student.user_id, resourceId]
    );
    if (existing.length) continue;

    const progress = title.startsWith('BECE') ? 65
      : title.startsWith('Things') ? 40
      : title.startsWith('Khan') ? 25 : 0;

    const list = title.startsWith('Things') || title.startsWith('Purple') ? 'reading'
      : title.startsWith('BECE') || title.startsWith('Khan') ? 'favourite' : 'reading';

    await q(
      `INSERT INTO library_bookmarks (user_id, resource_id, list, progress, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [student.user_id, resourceId, list, progress, '']
    );
    added++;
  }
  console.log(`      ${added} library bookmarks added for ${student.name}`);
}

/* ==================================================================
   DATA — EXTRA ANNOUNCEMENTS
   ================================================================== */
const ANNOUNCEMENTS = [
  {
    title: 'Mid-Term Examination Timetable Released',
    body: 'The mid-term examination timetable is now available on the portal and on the notice board. All students should collect their exam dockets from the class teacher before Friday. No student will be allowed into the exam hall without a docket.',
    category: 'Academic',
  },
  {
    title: 'Inter-House Sports: Call for Athletes',
    body: 'Trials for the Inter-House Sports competition begin next Monday at 3pm on the school field. Interested students should register with their house captains. Athletics, football, volleyball, table tennis and relay events will be contested.',
    category: 'Event',
  },
  {
    title: 'Library Extension Hours',
    body: 'The school library will now open until 5pm on weekdays to support students preparing for the mid-term exams. Please observe silence and return all borrowed books on time.',
    category: 'Academic',
  },
  {
    title: 'PTA Meeting — All Parents Invited',
    body: 'The next Parent-Teacher Association meeting will hold at the school hall at 10am. Agenda: mid-term results review, curriculum updates, and the new digital portal walkthrough. Refreshments will be served.',
    category: 'Event',
  },
  {
    title: 'Free Medical Check-Up for Students',
    body: 'A team of volunteer doctors will visit the school next week to conduct free eye tests, dental screening and general medical check-ups. Consent forms must be signed by parents and returned to the school nurse before the visit.',
    category: 'General',
  },
];

async function seedAnnouncements() {
  let added = 0;
  for (const a of ANNOUNCEMENTS) {
    const [existing] = await q('SELECT id FROM announcements WHERE title = ?', [a.title]);
    if (existing.length) continue;
    await q(
      `INSERT INTO announcements (title, body, date, audience, category)
       VALUES (?, ?, CURDATE(), 'all', ?)`,
      [a.title, a.body, a.category]
    );
    added++;
  }
  console.log(`      ${added} announcements added`);
}

/* ==================================================================
   MAIN
   ================================================================== */
async function run() {
  console.log('\n🌱 Seeding demo content (library, question bank, behaviour, etc.)…\n');
  const started = Date.now();

  await step('Populating library resources',    seedLibrary);
  await step('Populating question bank',         seedQuestionBank);
  await step('Populating behaviour log',         seedBehaviour);
  await step('Populating lesson plans',          seedLessonPlans);
  await step('Populating meetings',              seedMeetings);
  await step('Populating calendar events',       seedCalendarEvents);
  await step('Populating assignment templates',  seedAssignmentTemplates);
  await step('Adding library bookmarks',         seedBookmarks);
  await step('Posting extra announcements',      seedAnnouncements);

  console.log(`\n✅ Demo content ready in ${Date.now() - started}ms\n`);
  console.log('   What you\'ll now see populated:');
  console.log('   ─────────────────────────────────────────────');
  console.log('   • Library            → 30 real books, past questions, videos');
  console.log('   • Question Bank      → 60 curriculum questions for every teacher');
  console.log('   • Behaviour Log      → 8 real notes for JSS 2A students');
  console.log('   • Lesson Plans       → 5 detailed plans for Maths & English');
  console.log('   • Parent Meetings    → 3 requests in different statuses');
  console.log('   • Calendar           → 14 events spread across the term');
  console.log('   • Assignment Templates → 7 reusable templates');
  console.log('   • Student Library List → 5 bookmarks for ada@school.com\n');
}

run()
  .catch((err) => {
    console.error('\n❌ Demo seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end().catch(() => {}));