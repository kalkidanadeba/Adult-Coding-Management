const path = require('path');
const express = require('express');
const { uploadsRoot } = require('../utils/fileUpload.helpers');

const EXTENSION_CONTENT_TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

const INLINE_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.txt',
  '.mp3',
  '.wav',
  '.mp4',
  '.webm'
]);

const setUploadHeaders = (res, filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = EXTENSION_CONTENT_TYPES[extension];

  if (contentType) {
    res.setHeader('Content-Type', contentType);
  }

  if (INLINE_EXTENSIONS.has(extension)) {
    res.setHeader('Content-Disposition', 'inline');
  }
};

const uploadStaticHandler = express.static(uploadsRoot, {
  fallthrough: false,
  setHeaders: setUploadHeaders
});

const serveUploads = (req, res, next) => {
  uploadStaticHandler(req, res, (error) => {
    if (!error) {
      return;
    }

    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    return next(error);
  });
};

module.exports = {
  serveUploads
};
