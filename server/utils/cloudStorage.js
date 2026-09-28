/* ------------------------------------------------------------------
   File storage — Upstash Blob.
   Keeps the same external API as before:
     uploadFile(buffer, filename, folder)
     deleteFile(urlOrKey)
------------------------------------------------------------------- */

const path = require('path');
const fs = require('fs');

let bucket = null;
let configured = false;

try {
  const { Bucket } = require('@upstash/blob');
  if (process.env.UPSTASH_BLOB_TOKEN) {
    bucket = Bucket.fromEnv();   // reads UPSTASH_BLOB_TOKEN
    configured = true;
    console.log('📦 Upstash Blob storage enabled');
  } else {
    console.log('📦 Upstash Blob disabled — UPSTASH_BLOB_TOKEN not set');
  }
} catch (e) {
  console.log('📦 Upstash Blob disabled — @upstash/blob not installed');
}

/* Local fallback folder — used only when Upstash isn't configured */
const LOCAL_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });

function safeName(filename) {
  const base = String(filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const stamp = Date.now();
  const rand = Math.round(Math.random() * 1e6);
  return `${stamp}-${rand}-${base}`;
}

/**
 * Upload a buffer to Upstash Blob.
 * @param {Buffer} buffer
 * @param {string} filename
 * @param {string} folder — 'avatars', 'notes', etc.
 * @returns {Promise<{url, publicId, provider}>}
 */
async function uploadFile(buffer, filename, folder = 'misc') {
  const key = `${folder}/${safeName(filename)}`;

  if (configured && bucket) {
    try {
      const blob = await bucket.put(key, buffer);
      return {
        url: blob.url,
        publicId: key,       // used later for deleteFile
        provider: 'upstash',
      };
    } catch (err) {
      console.error('Upstash upload failed:', err.message);
      // Fall through to local disk so uploads don't crash
    }
  }

  /* Local disk fallback */
  const name = safeName(filename);
  const subdir = path.join(LOCAL_DIR, folder);
  if (!fs.existsSync(subdir)) fs.mkdirSync(subdir, { recursive: true });
  fs.writeFileSync(path.join(subdir, name), buffer);

  return {
    url: `/uploads/${folder}/${name}`,
    publicId: `${folder}/${name}`,
    provider: 'local',
  };
}

/**
 * Delete a file. Pass the publicId we returned from uploadFile.
 */
async function deleteFile(publicIdOrUrl) {
  if (!publicIdOrUrl) return;

  /* Upstash path */
  if (configured && bucket && !publicIdOrUrl.startsWith('/uploads/')) {
    // If we were given a full URL, turn it back into a key
    let key = publicIdOrUrl;
    if (/^https?:\/\//.test(publicIdOrUrl)) {
      try {
        const u = new URL(publicIdOrUrl);
        // Upstash public URLs look like:
        //   https://xxxx.blob.upstash.io/avatars/xxx.jpg
        // The key is everything after the host
        key = u.pathname.replace(/^\/+/, '');
      } catch { /* fall through */ }
    }
    try {
      await bucket.delete(key);
      return;
    } catch (err) {
      console.warn('Upstash delete failed:', err.message);
    }
  }

  /* Local fallback */
  let rel = null;
  if (publicIdOrUrl.startsWith('/uploads/')) {
    rel = publicIdOrUrl.replace(/^\/uploads\//, '');
  } else if (!/^https?:\/\//.test(publicIdOrUrl)) {
    rel = publicIdOrUrl.replace(/^\/+/, '');
  }
  if (rel) {
    const full = path.join(LOCAL_DIR, rel);
    if (fs.existsSync(full)) {
      try { fs.unlinkSync(full); } catch {}
    }
  }
}

module.exports = { uploadFile, deleteFile, LOCAL_DIR, provider: configured ? 'upstash' : 'local' };