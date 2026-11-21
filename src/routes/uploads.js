import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { protect, allow } from '../middleware/auth.js';
const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_q, f, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(f.mimetype)) });
r.post('/', protect, allow('admin'), upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Choose a JPG, PNG or WebP image under 5 MB' });
  cloudinary.uploader.upload_stream({ folder: 'kings-apartment', resource_type: 'image', transformation: [{ width: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }] },
    (err, out) => (err ? res.status(500).json({ message: 'Upload failed. Try again.' }) : res.status(201).json({ url: out.secure_url })),
  ).end(req.file.buffer);
});
export default r;
