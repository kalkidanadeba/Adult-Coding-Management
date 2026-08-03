const FALLBACK_API_URL = 'http://localhost:3000/api';

const PROFILE_FIELDS = [
  'id',
  '_id',
  'name',
  'email',
  'role',
  'photo',
  'avatar',
  'image',
  'picture',
  'profilePicture',
  'profile_picture',
  'userPhoto',
  'profilePhoto',
  'photoUrl',
  'photoURL',
  'avatarUrl',
  'avatarURL',
  'imageUrl',
  'imageURL',
  'profileImage',
  'profile_image',
];

const getObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value;
};

const pickAvatarSource = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  const objectValue = getObject(value);
  if (!objectValue) {
    return null;
  }

  return objectValue.url || objectValue.secure_url || objectValue.path || objectValue.src || null;
};

const getApiOrigin = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  const configuredApiUrl =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? FALLBACK_API_URL : `${window.location.origin}/api`);

  try {
    return new URL(configuredApiUrl, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
};

export const resolveAssetUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  if (/^(?:https?:|data:|blob:)/i.test(url)) {
    return url;
  }

  if (url.startsWith('//')) {
    return `${window.location.protocol}${url}`;
  }

  const normalizedPath = url.startsWith('/') ? url : `/${url}`;

  try {
    return new URL(normalizedPath, getApiOrigin()).href;
  } catch {
    return normalizedPath;
  }
};

export const resolveUserAvatarUrl = (user) =>
  resolveAssetUrl(
    pickAvatarSource(user?.photo) ||
      pickAvatarSource(user?.avatar) ||
      pickAvatarSource(user?.image) ||
      pickAvatarSource(user?.picture) ||
      pickAvatarSource(user?.profilePicture) ||
      pickAvatarSource(user?.profile_picture) ||
      pickAvatarSource(user?.userPhoto) ||
      pickAvatarSource(user?.profileImage) ||
      pickAvatarSource(user?.profilePhoto) ||
      pickAvatarSource(user?.profile_image) ||
      user?.photoUrl ||
      user?.photoURL ||
      user?.avatarUrl ||
      user?.avatarURL ||
      user?.imageUrl ||
      user?.imageURL ||
      null,
  );

const USER_SHAPE_KEYS = new Set([
  ...PROFILE_FIELDS,
  'status',
  'isActive',
  'createdAt',
  'updatedAt',
]);

const looksLikeUserObject = (value) => {
  const objectValue = getObject(value);
  if (!objectValue) {
    return false;
  }

  return Object.keys(objectValue).some((key) => USER_SHAPE_KEYS.has(key));
};

export const extractUserFromPayload = (payload) => {
  const candidates = [
    payload,
    payload?.user,
    payload?.profile,
    payload?.currentUser,
    payload?.account,
    payload?.data,
    payload?.data?.user,
    payload?.data?.profile,
    payload?.data?.currentUser,
    payload?.data?.account,
  ];

  for (const candidate of candidates) {
    if (looksLikeUserObject(candidate)) {
      return candidate;
    }
  }

  return null;
};

export const mergeProfileResponseIntoUser = (currentUser, responseData = {}, submittedProfile = {}) => {
  const responseSources = [
    responseData,
    responseData?.user,
    responseData?.profile,
    responseData?.currentUser,
    responseData?.account,
    responseData?.data,
    responseData?.data?.user,
    responseData?.data?.profile,
    responseData?.data?.currentUser,
    responseData?.data?.account,
  ];

  const mergedFields = responseSources.reduce((accumulator, source) => {
    const objectSource = getObject(source);

    if (!objectSource) {
      return accumulator;
    }

    PROFILE_FIELDS.forEach((field) => {
      if (objectSource[field] !== undefined) {
        accumulator[field] = objectSource[field];
      }
    });

    return accumulator;
  }, {});

  const nextUser = {
    ...(currentUser ?? {}),
    ...(submittedProfile?.name !== undefined ? { name: submittedProfile.name } : {}),
    ...mergedFields,
  };

  return Object.keys(nextUser).length > 0 ? nextUser : null;
};
