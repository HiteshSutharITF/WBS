const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Configure Multer storage with module-wise directories
 */
const createMulter = (moduleFolder = 'media') => {
  const uploadPath = path.join(__dirname, '..', 'uploads', moduleFolder);
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${moduleFolder}-${uniqueSuffix}${ext}`);
    }
  });

  const fileFilter = (req, file, cb) => {
    // Allowed mime types
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      // Audio
      'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/aac',
      // Video
      'video/mp4', 'video/3gpp',
      // Documents
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not permitted.`));
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 25 * 1024 * 1024 // 25 MB max limit
    }
  });
};

module.exports = {
  uploadMedia: createMulter('media'),
  uploadTemplate: createMulter('templates'),
  uploadAvatar: createMulter('avatars'),
  uploadImport: createMulter('imports')
};
