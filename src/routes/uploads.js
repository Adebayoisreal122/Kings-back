import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { protect, allow } from '../middleware/auth.js';
const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_q, f, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(f.mimetype)) });
// Phone photos are often 3 to 8 MB. Oversized or unreadable files get a clear message instead of a 500.
const single = upload.single('image');
const read = (req, res, next) => single(req, res, (err) => err ? res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'That photo is too large. Please choose one under 10 MB.' : 'Could not read that file. Try a different photo.' }) : next());
r.post('/', protect, allow('admin'), read, (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Choose a JPG, PNG or WebP image under 10 MB' });
  if (!cloudinary.config().cloud_name) return res.status(503).json({ message: 'Photo uploads are not set up yet. Add CLOUDINARY_URL to server/.env and restart the server.' });
  cloudinary.uploader.upload_stream({ folder: 'kings-apartment', resource_type: 'image', transformation: [{ width: 1600, crop: 'limit' }] }, (err, out) => {
    if (err) { console.error('Cloudinary upload failed:', err.message || err); return res.status(502).json({ message: `Upload failed: ${err.message || 'could not reach Cloudinary'}` }); }
    // f_auto and q_auto are applied when the image is delivered, which keeps pages fast
    res.status(201).json({ url: out.secure_url.replace('/upload/', '/upload/f_auto,q_auto/') });
  }).end(req.file.buffer);
});
export default r;
