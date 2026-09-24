/* ------------------------------------------------------------------
   Central place for "what can this teacher actually do?"
   ------------------------------------------------------------------ */

const pool = require('../db');

/**
 * Fetch everything the app needs to know about a teacher:
 *  - their type (class_teacher | subject_teacher)
 *  - the form class they own (class teachers only)
 *  - the list of (className, subject) pairs they are assigned to teach
 */
async function getTeacherContext(userId) {
  const [rows] = await pool.execute(
    `SELECT id, name, form_class, subjects, teacher_type
     FROM teachers WHERE user_id = ?`,
    [userId]
  );
  if (!rows.length) return null;
  const t = rows[0];

  const [assigns] = await pool.execute(
    `SELECT class_name, subject FROM teacher_assignments
     WHERE teacher_id = ? ORDER BY class_name, subject`,
    [t.id]
  );

  let subjects = [];
  try { subjects = JSON.parse(t.subjects || '[]'); } catch { subjects = []; }

  return {
    teacherId: t.id,
    name: t.name,
    formClass: t.form_class || '',
    teacherType: t.teacher_type || 'class_teacher',
    subjects,
    assignments: assigns.map((a) => ({
      className: a.class_name,
      subject: a.subject,
    })),
  };
}

/**
 * Can this teacher post content to (className, subject)?
 */
function canTeach(ctx, className, subject) {
  if (!ctx || !className || !subject) return false;

  // Class teacher: any subject inside their own form class
  if (ctx.teacherType === 'class_teacher' && ctx.formClass === className) {
    return true;
  }

  // Subject teacher (or any teacher): must have an explicit assignment
  return ctx.assignments.some(
    (a) => a.className === className && a.subject === subject
  );
}

/**
 * All (className, subject) pairs this teacher can post to.
 */
function teachablePairs(ctx) {
  if (!ctx) return [];

  if (ctx.teacherType === 'class_teacher' && ctx.formClass) {
    const own = ctx.assignments.filter((a) => a.className === ctx.formClass);
    if (own.length) return own;
    return ctx.subjects.map((s) => ({ className: ctx.formClass, subject: s }));
  }

  return ctx.assignments;
}

module.exports = { getTeacherContext, canTeach, teachablePairs };