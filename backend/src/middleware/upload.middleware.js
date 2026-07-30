const path = require('path');
const multer = require('multer');
const {
  ensureUploadDirectories,
  profilePhotoDir,
  lessonResourcesDir
} = require('../utils/fileUpload.helpers');

ensureUploadDirectories();

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
]);

const LESSON_RESOURCE_MIME_TYPES = new Set([
  ...IMAGE_MIME_TYPES,
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'audio/mpeg',
  'audio/wav',
  'video/mp4',
  'video/webm'
]);

const createDiskStorage = (destinationDir, buildFilename) =>
  multer.diskStorage({
    destination: (req, file, cb) => cb(null, destinationDir),
    filename: (req, file, cb) => {
      try {
        cb(null, buildFilename(req, file));
      } catch (error) {
        cb(error);
      }
    }
  });

const profilePhotoStorage = createDiskStorage(profilePhotoDir, (req, file) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const safeExtension = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)
    ? extension
    : '.jpg';

  return `${req.user.id}-${Date.now()}${safeExtension}`;
});

const lessonResourceStorage = createDiskStorage(lessonResourcesDir, (req, file) => {
  const extension = path.extname(file.originalname).toLowerCase() || '.bin';
  const prefix = req.user?.id || 'lesson';
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
});

const createFileFilter = (allowedMimeTypes, errorMessage) => (req, file, cb) => {
  if (allowedMimeTypes.has(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(new Error(errorMessage));
};

const profilePhotoUpload = multer({
  storage: profilePhotoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: createFileFilter(IMAGE_MIME_TYPES, 'Only image files are allowed for profile photos')
});

const lessonResourceUpload = multer({
  storage: lessonResourceStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: createFileFilter(
    LESSON_RESOURCE_MIME_TYPES,
    'Unsupported lesson file type'
  )
});

const handleUpload =
  (uploadMiddleware) =>
  (req, res, next) => {
    uploadMiddleware(req, res, (error) => {
      if (!error) {
        next();
        return;
      }

      if (error instanceof multer.MulterError) {
        const message =
          error.code === 'LIMIT_FILE_SIZE'
            ? 'Uploaded file is too large'
            : error.message;

        return res.status(400).json({
          success: false,
          message
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message || 'File upload failed'
      });
    });
  };

module.exports = {
  uploadProfilePhoto: handleUpload(profilePhotoUpload.single('photo')),
  uploadLessonResources: handleUpload(lessonResourceUpload.array('files', 10))
};
