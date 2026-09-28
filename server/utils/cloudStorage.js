/* ------------------------------------------------------------------
   File storage — Cloudinary.
   Same external API as before:
     uploadFile(buffer, filename, folder)
     deleteFile(urlOrKey)
------------------------------------------------------------------- */

const path = require('path');
const fs = require('fs');

let cloudinary = null;
let configured = false;

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
    configured = true;
    console.log(`📦 Cloudinary storage enabled → ${process.env.CLOUDINARY_CLOUD_NAME}`);
  } else {
    cloudinary = null;
    console.log('📦 Cloudinary disabled — CLOUDINARY_* env vars not set');
  }
} catch (e) {
  cloudinary = null;
  console.log('📦 Cloudinary disabled — cloudinary package not installed');
}

/* Local fallback folder — used only when Cloudinary isn't configured */
const LOCAL_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
if (!configured) {
  console.log(`📦 Using local disk storage → ${LOCAL_DIR}`);
}

/**
 * Upload a buffer to Cloudinary.
 * @param {Buffer} buffer
 * @param {string} filename
 * @param {string} folder — 'avatars', 'notes', etc.
 * @returns {Promise<{url, publicId, provider}>}
 */
async function uploadFile(buffer, filename, folder = 'misc') {
  if (configured && cloudinary) {
    return new Promise((resolve, reject) => {
      const baseName = String(filename || 'file').replace(/\.[^.]*$/, '');
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `school-portal/${folder}`,
          public_id: `${Date.now()}-${baseName}`,
          resource_type: 'auto',
        },
        (err, result) => {
          if (err) {
            console.error('Cloudinary upload failed:', err.message);
            // fall through to local on error
            return reject(err);
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,   // used for deleteFile
            provider: 'cloudinary',
          });
        }
      );
      stream.end(buffer);
    });
  }

  /* Local disk fallback */
  const safeName = `${Date.now()}-${String(filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const subdir = path.join(LOCAL_DIR, folder);
  if (!fs.existsSync(subdir)) fs.mkdirSync(subdir, { recursive: true });
  fs.writeFileSync(path.join(subdir, safeName), buffer);

  return {
    url: `/uploads/${folder}/${safeName}`,
    publicId: `${folder}/${safeName}`,
    provider: 'local',
  };
}

/**
 * Delete a file from Cloudinary or local disk.
 * Accepts either the publicId we stored or a full Cloudinary URL.
 */
async function deleteFile(publicIdOrUrl) {
  if (!publicIdOrUrl) return;

  /* Cloudinary path */
  if (configured && cloudinary && !publicIdOrUrl.startsWith('/uploads/')) {
    let publicId = publicIdOrUrl;

    // If it's a full Cloudinary URL, extract the public ID
    const m = String(publicIdOrUrl).match(
      /res\.cloudinary\.com\/[^/]+\/(?:image|raw|video)\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i
    );
    if (m) publicId = m[1];

    if (publicId.startsWith('school-portal/')) {
      try {
        await cloudinary.uploader.destroy(publicId);
        return;
      } catch (err) {
        console.warn('Cloudinary delete failed:', err.message);
      }
    }
  }

  /* Local fallback */
  let rel = null;
  if (publicIdOrUrl.startsWith('/uploads/')) {
    rel = publicIdOrUrl.replace(/^\/uploads\//, '');
  } else if (!/^https?:\/\//.test(publicIdOrUrl) && !publicIdOrUrl.startsWith('school-portal/')) {
    rel = publicIdOrUrl.replace(/^\/+/, '');
  }
  if (rel) {
    const full = path.join(LOCAL_DIR, rel);
    if (fs.existsSync(full)) {
      try { fs.unlinkSync(full); } catch {}
    }
  }
}

module.exports = {
  uploadFile,
  deleteFile,
  LOCAL_DIR,
  provider: configured ? 'cloudinary' : 'local',
};