const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');

router.use(protect, allow('admin'));

/* GET /api/audit — list, filter, paginate */
router.get('/', async (req, res) => {
  const {
    q, resource, role, userId, method, status,
    from, to,
    page = '1', limit = '50',
  } = req.query;

  const where = [];
  const values = [];

  if (q) {
    where.push('(user_name LIKE ? OR path LIKE ? OR meta LIKE ?)');
    const like = `%${q}%`;
    values.push(like, like, like);
  }
  if (resource && resource !== 'all') {
    where.push('resource = ?');
    values.push(resource);
  }
  if (role && role !== 'all') {
    where.push('user_role = ?');
    values.push(role);
  }
  if (userId) {
    where.push('user_id = ?');
    values.push(Number(userId));
  }
  if (method && method !== 'all') {
    where.push('method = ?');
    values.push(method);
  }
  if (status && status !== 'all') {
    if (status === 'success') where.push('status BETWEEN 200 AND 299');
    else if (status === 'redirect') where.push('status BETWEEN 300 AND 399');
    else if (status === 'client') where.push('status BETWEEN 400 AND 499');
    else if (status === 'server') where.push('status BETWEEN 500 AND 599');
  }
  if (from) { where.push('created_at >= ?'); values.push(from + ' 00:00:00'); }
  if (to)   { where.push('created_at <= ?'); values.push(to + ' 23:59:59'); }

  const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(10, Number(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  try {
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM audit_log ${whereSQL}`,
      values
    );

    const [rows] = await pool.execute(
      `SELECT * FROM audit_log
       ${whereSQL}
       ORDER BY id DESC
       LIMIT ${limitNum} OFFSET ${offset}`,
      values
    );

    /* Distinct resources for the filter dropdown */
    const [resources] = await pool.execute(
      `SELECT DISTINCT resource FROM audit_log
       WHERE resource IS NOT NULL
       ORDER BY resource`
    );

    res.json({
      page: pageNum,
      pageSize: limitNum,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / limitNum),
      resources: resources.map((r) => r.resource),
      rows: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        userRole: r.user_role,
        method: r.method,
        path: r.path,
        resource: r.resource,
        entityId: r.entity_id,
        status: r.status,
        ip: r.ip,
        userAgent: r.user_agent,
        meta: (() => {
          try { return r.meta ? JSON.parse(r.meta) : null; }
          catch { return r.meta; }
        })(),
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error('Audit list failed:', err);
    res.status(500).json({ message: err.message || 'Failed to load audit log' });
  }
});

/* GET /api/audit/summary — small stats for the header */
router.get('/summary', async (req, res) => {
  try {
    const [[totals]] = await pool.execute(
      `SELECT
        COUNT(*) AS all_time,
        SUM(CASE WHEN created_at >= CURDATE() THEN 1 ELSE 0 END) AS today,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS last_7_days,
        SUM(CASE WHEN status BETWEEN 400 AND 499 THEN 1 ELSE 0 END) AS client_errors
       FROM audit_log`
    );

    const [byResource] = await pool.execute(
      `SELECT resource, COUNT(*) AS count
       FROM audit_log
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         AND resource IS NOT NULL
       GROUP BY resource
       ORDER BY count DESC
       LIMIT 8`
    );

    const [byUser] = await pool.execute(
      `SELECT user_name, user_role, COUNT(*) AS count
       FROM audit_log
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         AND user_name IS NOT NULL
       GROUP BY user_name, user_role
       ORDER BY count DESC
       LIMIT 5`
    );

    res.json({
      totals: {
        allTime: Number(totals.all_time),
        today: Number(totals.today),
        last7Days: Number(totals.last_7_days),
        clientErrors: Number(totals.client_errors),
      },
      byResource: byResource.map((r) => ({
        resource: r.resource,
        count: Number(r.count),
      })),
      byUser: byUser.map((u) => ({
        name: u.user_name,
        role: u.user_role,
        count: Number(u.count),
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* DELETE /api/audit/purge — admin can clear entries older than N days */
router.delete('/purge', async (req, res) => {
  const days = Math.max(7, Number(req.query.days) || 90);
  try {
    const [result] = await pool.execute(
      'DELETE FROM audit_log WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [days]
    );
    res.json({ message: `Purged ${result.affectedRows} entries older than ${days} days` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;