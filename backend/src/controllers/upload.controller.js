const { buildPublicUploadPath } = require('../utils/fileUpload.helpers');

const uploadLessonResources = async (req, res) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({
        success: false,
        message: 'No files were uploaded'
      });
    }

    const resources = req.files.map((file) => ({
      kind: 'file',
      name: file.originalname,
      url: buildPublicUploadPath('lesson-resources', file.filename),
      mimeType: file.mimetype,
      size: file.size
    }));

    return res.status(201).json({
      success: true,
      message: `${resources.length} file${resources.length === 1 ? '' : 's'} uploaded successfully`,
      resources
    });
  } catch (error) {
    console.error('Upload lesson resources error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error uploading lesson files',
      error: error.message
    });
  }
};

module.exports = {
  uploadLessonResources
};
