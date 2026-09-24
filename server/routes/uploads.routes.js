const router = require('express').Router();
const multer = require('multer');
const pool = require('../db');
const { protect } = require('../middleware/auth');
const { uploadFile, deleteFile } = require('../utils/cloudStorage');

router.use(protect);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPG, PNG, WEBP or GIF allowed'));
  },
});

/* POST /api/uploads/avatar */
router.post('/avatar', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const role = req.user.role;
  let table = null;
  if (role === 'student') table = 'students';
  else if (role === 'teacher') table = 'teachers';
  else if (role === 'admin') table = 'admins';
  else if (role === 'parent') table = 'parents';

  if (!table) return res.status(400).json({ message: 'Unknown role' });

  try {
    const [old] = await pool.execute(
      `SELECT photo FROM ${table} WHERE user_id = ?`,
      [req.user.id]
    );
    if (old.length && old[0].photo) {
      await deleteFile(old[0].photo);
    }

    const result = await uploadFile(req.file.buffer, req.file.originalname, 'avatars');

    await pool.execute(
      `UPDATE ${table} SET photo = ? WHERE user_id = ?`,
      [result.url, req.user.id]
    );

    res.json({
      message: 'Profile photo updated',
      url: result.url,
      provider: result.provider,
    });
  } catch (err) {
    console.error('Avatar upload failed:', err);
    res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

module.exports = router;