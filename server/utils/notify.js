const { notifications, students, users, nextId } = require('../data/db');

// Send a notification to one user
function notify({ userId, type, title, body, link }) {
  notifications.unshift({
    id: nextId(notifications),
    userId,
    type,
    title,
    body,
    link: link || null,
    read: false,
    createdAt: new Date().toISOString()
  });
}

function notifyClassStudents(className, payload) {
  const classStudents = students.filter((s) => s.className === className);
  classStudents.forEach((s) => {
    if (s.userId) notify({ ...payload, userId: s.userId });
  });
}

function notifyAllUsers(payload) {
  users.forEach((u) => {
    notify({ ...payload, userId: u.id });
  });
}

module.exports = { notify, notifyClassStudents, notifyAllUsers };