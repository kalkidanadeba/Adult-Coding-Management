const { resolveStoredUploadPath } = require('./fileUpload.helpers');

const SUPPORTED_PHOTO_FIELDS = [
  'photo',
  'profilePhoto',
  'avatar',
  'image',
  'picture',
  'profilePicture',
  'profile_picture',
  'userPhoto',
  'photoUrl',
  'avatarUrl',
  'imageUrl',
  'profileImage',
  'profile_image'
];

const toPlainObject = (value) => {
  if (!value) {
    return value;
  }

  if (typeof value.toObject === 'function') {
    return value.toObject();
  }

  if (typeof value === 'object') {
    return { ...value };
  }

  return value;
};

const normalizePhotoValue = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'object') {
    return normalizePhotoValue(
      value.url ??
      value.path ??
      value.href ??
      value.src
    );
  }

  const normalizedValue = String(value).trim();
  if (!normalizedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalizedValue);
    if (parsed !== normalizedValue) {
      const nestedValue = normalizePhotoValue(parsed);
      if (nestedValue !== undefined) {
        return nestedValue;
      }
    }
  } catch (error) {
  
  }

  return resolveStoredUploadPath(normalizedValue);
};

const extractIncomingPhotoValue = (payload = {}) => {
  for (const field of SUPPORTED_PHOTO_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      return normalizePhotoValue(payload[field]);
    }
  }

  return undefined;
};

const buildAbsoluteAssetUrl = (req, resourcePath) => {
  if (!resourcePath || typeof resourcePath !== 'string') {
    return resourcePath ?? null;
  }

  if (
    resourcePath.startsWith('http://') ||
    resourcePath.startsWith('https://') ||
    resourcePath.startsWith('data:')
  ) {
    return resourcePath;
  }

  const host = req?.get ? req.get('host') : req?.headers?.host;
  if (!host) {
    return resourcePath;
  }

  const forwardedProto = req?.headers?.['x-forwarded-proto'];
  const protocol = typeof forwardedProto === 'string'
    ? forwardedProto.split(',')[0].trim()
    : req?.protocol;

  if (!protocol) {
    return resourcePath;
  }

  return `${protocol}://${host}${resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`}`;
};

const serializeUserForResponse = (user, req) => {
  if (!user) {
    return user;
  }

  const payload = toPlainObject(user);
  delete payload.password;
  delete payload.passwordResetToken;
  delete payload.passwordResetExpires;
  delete payload.__v;

  const normalizedProfilePhoto = normalizePhotoValue(
    payload.profilePhoto ??
    payload.photo ??
    payload.avatar ??
    payload.image
  ) ?? null;

  return {
    ...payload,
    id: payload.id || payload._id?.toString?.() || payload._id,
    profilePhoto: normalizedProfilePhoto,
    photo: buildAbsoluteAssetUrl(req, normalizedProfilePhoto)
  };
};

const buildAuthUserResponse = (user, req) => {
  const payload = serializeUserForResponse(user, req);

  if (!payload) {
    return payload;
  }

  return {
    id: payload.id,
    name: payload.name,
    email: payload.email,
    role: payload.role,
    photo: payload.photo,
    profilePhoto: payload.profilePhoto
  };
};

module.exports = {
  extractIncomingPhotoValue,
  serializeUserForResponse,
  buildAuthUserResponse
};
