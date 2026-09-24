/* ------------------------------------------------------------------
   File storage — uses Cloudinary if credentials exist,
   otherwise saves to local ./uploads/ folder.
------------------------------------------------------------------- */

const path = require('path');
const fs = require('fs');

let cloudinary = null;
try {
  cloudinary = require('cloudinary').v2;
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  } else {
    cloudinary = null;
  }
} catch {
  cloudinary = null;
}

const LOCAL_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });

/**
 * Upload a buffer to cloud (or local).
 * @param {Buffer} buffer
 * @param {string} filename
 * @param {string} folder — cloudinary folder e.g. 'avatars' or 'notes'
 * @returns {Promise<{ url: string, publicId?: string, provider: 'cloudinary' | 'local' }>}
 */
async function uploadFile(buffer, filename, folder = 'misc') {
  // ---- Cloudinary path ----
  if (cloudinary) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `school-portal/${folder}`,
          public_id: `${Date.now()}-${filename.replace(/\.[^.]*$/, '')}`,
          resource_type: 'auto',
        },
        (err, result) => {
          if (err) return reject(err);
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            provider: 'cloudinary',
          });
        }
      );
      stream.end(buffer);
    });
  }

  // ---- Local disk fallback ----
  const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const subdir = path.join(LOCAL_DIR, folder);
  if (!fs.existsSync(subdir)) fs.mkdirSync(subdir, { recursive: true });

  fs.writeFileSync(path.join(subdir, safeName), buffer);

  return {
    url: `/uploads/${folder}/${safeName}`,
    provider: 'local',
  };
}

async function deleteFile(publicIdOrUrl) {
  if (!publicIdOrUrl) return;

  // Cloudinary public ID (contains a slash path like "school-portal/avatars/xxx")
  if (cloudinary && publicIdOrUrl.startsWith('school-portal/')) {
    try {
      await cloudinary.uploader.destroy(publicIdOrUrl);
    } catch (err) {
      console.warn('Cloudinary delete failed:', err.message);
    }
    return;
  }

  // Local path
  if (publicIdOrUrl.startsWith('/uploads/')) {
    const rel = publicIdOrUrl.replace(/^\/uploads\//, '');
    const full = path.join(LOCAL_DIR, rel);
    if (fs.existsSync(full)) {
      try { fs.unlinkSync(full); } catch {}
    }
  }
}

module.exports = { uploadFile, deleteFile, LOCAL_DIR };