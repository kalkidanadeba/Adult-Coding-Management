const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const uploadsRoot = path.join(__dirname, '../../uploads');
const profilePhotoDir = path.join(uploadsRoot, 'profile-photos');
const lessonResourcesDir = path.join(uploadsRoot, 'lesson-resources');

const MIME_EXTENSION_MAP = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'video/mp4': '.mp4',
  'video/webm': '.webm'
};

const ensureUploadDirectories = () => {
  [uploadsRoot, profilePhotoDir, lessonResourcesDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

const getExtensionFromMimeType = (mimeType) => MIME_EXTENSION_MAP[mimeType?.toLowerCase()] || '';

const buildPublicUploadPath = (folder, filename) => `/api/uploads/${folder}/${filename}`;

const resolveStoredUploadPath = (publicPath) => {
  if (!publicPath || typeof publicPath !== 'string') {
    return publicPath;
  }

  if (publicPath.startsWith('/api/uploads/')) {
    return publicPath;
  }

  if (publicPath.startsWith('/uploads/')) {
    return publicPath.replace('/uploads/', '/api/uploads/');
  }

  return publicPath;
};

const isDataUrl = (value) => typeof value === 'string' && value.startsWith('data:');

const parseDataUrl = (dataUrl) => {
  const match = dataUrl.match(/^data:([^;,]+)?(?:;[^,]*)?;base64,(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1] || 'application/octet-stream',
    buffer: Buffer.from(match[2], 'base64')
  };
};

const createUniqueFilename = (prefix, extension) => {
  const safeExtension = extension && extension.startsWith('.') ? extension : `.${extension || 'bin'}`;
  return `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExtension}`;
};

const saveBufferToUploads = async (buffer, folder, prefix, extension) => {
  ensureUploadDirectories();
  const targetDir = folder === 'profile-photos' ? profilePhotoDir : lessonResourcesDir;
  const filename = createUniqueFilename(prefix, extension);
  const absolutePath = path.join(targetDir, filename);

  await fs.promises.writeFile(absolutePath, buffer);

  return buildPublicUploadPath(folder, filename);
};

const getExtensionFromFilename = (filename) => {
  const extension = path.extname(filename || '').toLowerCase();
  return extension || '';
};

const saveDataUrlToUploads = async (dataUrl, folder, prefix, filenameHint = '') => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    return dataUrl;
  }

  const extension =
    getExtensionFromMimeType(parsed.mimeType) ||
    getExtensionFromFilename(filenameHint) ||
    '.bin';

  return saveBufferToUploads(parsed.buffer, folder, prefix, extension);
};

const deleteLocalUploadIfExists = async (publicPath) => {
  if (!publicPath || typeof publicPath !== 'string') {
    return;
  }

  const normalizedPublicPath = publicPath.replace(/^https?:\/\/[^/]+/i, '');
  if (
    !normalizedPublicPath.startsWith('/uploads/') &&
    !normalizedPublicPath.startsWith('/api/uploads/')
  ) {
    return;
  }

  const relativePath = normalizedPublicPath.replace(/^\/(?:api\/)?uploads\//, '');
  const absolutePath = path.join(uploadsRoot, relativePath);

  try {
    await fs.promises.unlink(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
};

const normalizeLessonResourceEntry = (entry) => {
  if (entry == null) {
    return null;
  }

  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return normalizeLessonResourceEntry(parsed);
      }
    } catch (error) {
      return trimmed;
    }
  }

  if (typeof entry === 'object') {
    const url = entry.url || entry.href || entry.src || entry.dataUrl;
    if (!url) {
      return null;
    }

    return {
      kind: entry.kind || (isDataUrl(url) ? 'file' : 'link'),
      name: entry.name || entry.title || entry.filename || 'Resource',
      url,
      ...(entry.mimeType ? { mimeType: entry.mimeType } : {}),
      ...(entry.size ? { size: entry.size } : {})
    };
  }

  return null;
};

const serializeLessonResourceEntry = (entry) => {
  if (typeof entry === 'string') {
    return entry;
  }

  if (entry && typeof entry === 'object') {
    return JSON.stringify(entry);
  }

  return null;
};

const persistLessonResources = async (resources = []) => {
  if (!Array.isArray(resources) || resources.length === 0) {
    return resources;
  }

  ensureUploadDirectories();

  const persistedResources = [];

  for (const resourceEntry of resources) {
    const normalized = normalizeLessonResourceEntry(resourceEntry);

    if (!normalized) {
      continue;
    }

    if (typeof normalized === 'string') {
      persistedResources.push(normalized);
      continue;
    }

    if (isDataUrl(normalized.url)) {
      const savedUrl = await saveDataUrlToUploads(
        normalized.url,
        'lesson-resources',
        'lesson-resource',
        normalized.name
      );

      persistedResources.push(
        serializeLessonResourceEntry({
          ...normalized,
          kind: 'file',
          url: savedUrl
        })
      );
      continue;
    }

    persistedResources.push(serializeLessonResourceEntry(normalized));
  }

  return persistedResources;
};

const normalizeResourceEntryForResponse = (entry) => {
  if (entry == null) {
    return entry;
  }

  if (typeof entry === 'string') {
    try {
      const parsed = JSON.parse(entry);
      if (parsed && typeof parsed === 'object' && parsed.url) {
        return JSON.stringify({
          ...parsed,
          url: resolveStoredUploadPath(parsed.url)
        });
      }
    } catch (error) {
      if (entry.startsWith('/uploads/') || entry.startsWith('/api/uploads/')) {
        return resolveStoredUploadPath(entry);
      }
    }

    return entry;
  }

  if (typeof entry === 'object' && entry.url) {
    return {
      ...entry,
      url: resolveStoredUploadPath(entry.url)
    };
  }

  return entry;
};

const normalizeLessonResourcesForResponse = (resources) => {
  if (!Array.isArray(resources)) {
    return resources;
  }

  return resources.map(normalizeResourceEntryForResponse);
};

module.exports = {
  uploadsRoot,
  profilePhotoDir,
  lessonResourcesDir,
  ensureUploadDirectories,
  buildPublicUploadPath,
  resolveStoredUploadPath,
  saveBufferToUploads,
  saveDataUrlToUploads,
  deleteLocalUploadIfExists,
  persistLessonResources,
  normalizeLessonResourceEntry,
  normalizeLessonResourcesForResponse
};
