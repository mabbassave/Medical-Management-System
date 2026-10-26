import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Define the path to the uploads directory (Backend/uploads)
const uploadDir = path.resolve(__dirname, '../../../uploads');

// Automatically create the "uploads" folder if it doesn't exist when the server starts
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer diskStorage to save files with a unique filename (timestamp + original name)
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    // Re-verify directory exists in case it was removed while server is running
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    // Unique filename: Date.now() + original filename
    const uniqueFilename = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueFilename);
  },
});

// File filter: only allow pdf, jpg, jpeg, png files
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

  if (allowedExtensions.includes(ext) || allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, JPG, JPEG, and PNG files are allowed'));
  }
};

// Multer upload middleware with 5MB size limit
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit
  },
});
