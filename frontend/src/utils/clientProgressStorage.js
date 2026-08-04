const getAvailableStorages = () => {
  if (typeof window === 'undefined') return [];
  return [localStorage, sessionStorage];
};

const CLIENT_PROGRESS_KEYS = ['lessonProgress', 'quizProgress'];

const getPrimaryStorage = () => {
  const storages = getAvailableStorages();
  const local = storages[0] ?? null;
  const session = storages[1] ?? null;

  if (local && (local.getItem('token') || local.getItem('user'))) {
    return local;
  }

  if (session && (session.getItem('token') || session.getItem('user'))) {
    return session;
  }

  return local ?? session ?? null;
};

const getOrderedStorages = () => {
  const storages = getAvailableStorages();
  const primary = getPrimaryStorage();

  if (!primary) return storages;
  return [primary, ...storages.filter((storage) => storage !== primary)];
};

const parseStoredUser = (rawUser) => {
  if (!rawUser) return null;

  try {
    const parsed = JSON.parse(rawUser);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const getStoredUser = () => {
  for (const storage of getOrderedStorages()) {
    const user = parseStoredUser(storage.getItem('user'));
    if (user) return user;
  }

  return null;
};

const getStoredToken = () => {
  for (const storage of getOrderedStorages()) {
    const token = storage.getItem('token');
    if (token) return token;
  }

  return null;
};

const normalizeOwnerKey = (value, { lowercase = true } = {}) => {
  if (value == null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;

  return encodeURIComponent(lowercase ? normalized.toLowerCase() : normalized);
};

const getUserOwnerKeys = (user) =>
  Array.from(
    new Set(
      [user?.id, user?._id, user?.email, user?.username]
        .map((value) => normalizeOwnerKey(value))
        .filter(Boolean),
    ),
  );

const getAuthSnapshot = (overrides = {}) => ({
  user: overrides.user ?? getStoredUser(),
  token: overrides.token ?? getStoredToken(),
});

const getProgressOwnerKeys = (overrides = {}) => {
  const { user, token } = getAuthSnapshot(overrides);
  const userOwnerKeys = getUserOwnerKeys(user);
  const tokenOwnerKey = normalizeOwnerKey(token, { lowercase: false });

  return Array.from(new Set([...userOwnerKeys, ...(tokenOwnerKey ? [tokenOwnerKey] : [])]));
};

const getClientProgressOwnerKey = (overrides = {}) => {
  const ownerKeys = getProgressOwnerKeys(overrides);
  if (ownerKeys.length > 0) {
    return ownerKeys[0];
  }

  return 'anonymous';
};

const parseProgressPayload = (raw) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const serializeProgressPayload = (value) => JSON.stringify(value);

const mergeLessonProgressPayloads = (payloads) => {
  const merged = {};

  for (const payload of payloads) {
    if (!payload || typeof payload !== 'object') continue;

    for (const [courseId, entry] of Object.entries(payload)) {
      if (!entry || typeof entry !== 'object') continue;

      const current = merged[courseId] && typeof merged[courseId] === 'object' ? merged[courseId] : { completed: [], lastViewed: null };
      const completed = Array.isArray(entry?.completed) ? entry.completed.map(String) : [];
      const lastViewed = entry?.lastViewed != null && entry.lastViewed !== '' ? String(entry.lastViewed) : null;

      merged[courseId] = {
        completed: Array.from(new Set([...(current.completed ?? []), ...completed])),
        lastViewed: lastViewed ?? current.lastViewed ?? null,
      };
    }
  }

  return merged;
};

const parseTimestamp = (value) => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? Number.NEGATIVE_INFINITY : parsed.getTime();
};

const getAttemptSignature = (attempt) => {
  if (!attempt || typeof attempt !== 'object') return null;
  const timestamp = attempt?.timestamp ?? attempt?.submittedAt ?? attempt?.submitted_at ?? attempt?.createdAt ?? null;
  const percent = attempt?.percent ?? attempt?.score ?? attempt?.percentage ?? '';
  const correctCount = attempt?.correctCount ?? attempt?.correct_answers ?? attempt?.correctAnswers ?? '';
  const total = attempt?.total ?? attempt?.total_questions ?? attempt?.totalQuestions ?? '';
  return `${timestamp ?? ''}|${percent}|${correctCount}|${total}`;
};

const mergeQuizProgressPayloads = (payloads) => {
  const merged = {};

  for (const payload of payloads) {
    if (!payload || typeof payload !== 'object') continue;

    for (const [courseId, lessons] of Object.entries(payload)) {
      if (!lessons || typeof lessons !== 'object') continue;

      if (!merged[courseId] || typeof merged[courseId] !== 'object') {
        merged[courseId] = {};
      }

      for (const [lessonId, entry] of Object.entries(lessons)) {
        if (!entry || typeof entry !== 'object') continue;

        const current = merged[courseId][lessonId] && typeof merged[courseId][lessonId] === 'object'
          ? merged[courseId][lessonId]
          : { attempts: [], bestPercent: 0, passed: false, lastAttemptAt: null };

        const attemptsMap = new Map(
          (Array.isArray(current.attempts) ? current.attempts : [])
            .map((attempt) => [getAttemptSignature(attempt), attempt])
            .filter(([signature]) => signature),
        );

        for (const attempt of Array.isArray(entry?.attempts) ? entry.attempts : []) {
          const signature = getAttemptSignature(attempt);
          if (!signature) continue;
          attemptsMap.set(signature, attempt);
        }

        const attempts = Array.from(attemptsMap.values()).sort(
          (a, b) => parseTimestamp(a?.timestamp ?? a?.submittedAt ?? a?.submitted_at ?? a?.createdAt) - parseTimestamp(b?.timestamp ?? b?.submittedAt ?? b?.submitted_at ?? b?.createdAt),
        );

        const bestPercent = Math.max(
          Number(current.bestPercent) || 0,
          Number(entry?.bestPercent) || 0,
          ...attempts.map((attempt) => Number(attempt?.percent ?? attempt?.score ?? attempt?.percentage) || 0),
        );

        const lastAttemptAtCandidates = [
          current.lastAttemptAt,
          entry?.lastAttemptAt,
          ...attempts.map((attempt) => attempt?.timestamp ?? attempt?.submittedAt ?? attempt?.submitted_at ?? attempt?.createdAt ?? null),
        ].filter(Boolean);
        const lastAttemptAt = lastAttemptAtCandidates.reduce(
          (latest, candidate) => (parseTimestamp(candidate) > parseTimestamp(latest) ? candidate : latest),
          null,
        );

        merged[courseId][lessonId] = {
          attempts,
          bestPercent,
          passed: Boolean(current.passed || entry?.passed),
          lastAttemptAt,
        };
      }
    }
  }

  return merged;
};

const mergeProgressPayloads = (baseKey, payloads) => {
  if (baseKey === 'lessonProgress') return mergeLessonProgressPayloads(payloads);
  if (baseKey === 'quizProgress') return mergeQuizProgressPayloads(payloads);
  return payloads.find(Boolean) ?? null;
};

const getScopedStorageKey = (baseKey, ownerKey = getClientProgressOwnerKey()) => `${baseKey}:${ownerKey}`;

const writeScopedStorageValue = (baseKey, ownerKey, value) => {
  const storages = getOrderedStorages();
  const primary = storages[0] ?? null;

  if (!primary || !ownerKey) return;

  const scopedKey = getScopedStorageKey(baseKey, ownerKey);
  primary.setItem(scopedKey, value);

  for (const storage of storages.slice(1)) {
    storage.removeItem(scopedKey);
  }
};

export const readScopedStorageItem = (baseKey) => {
  const progressOwnerKeys = getProgressOwnerKeys();
  const ownerKeys = progressOwnerKeys.length > 0 ? progressOwnerKeys : ['anonymous'];
  const seenKeys = new Set();

  for (const ownerKey of ownerKeys) {
    const scopedKey = getScopedStorageKey(baseKey, ownerKey);
    if (seenKeys.has(scopedKey)) continue;
    seenKeys.add(scopedKey);

    for (const storage of getOrderedStorages()) {
      const raw = storage.getItem(scopedKey);
      if (raw != null) return raw;
    }
  }

  return null;
};

export const writeScopedStorageItem = (baseKey, value) => {
  writeScopedStorageValue(baseKey, getClientProgressOwnerKey(), value);
};

export const migrateClientProgressOwnership = (overrides = {}) => {
  const ownerKeys = getProgressOwnerKeys(overrides);
  const canonicalOwnerKey = getClientProgressOwnerKey(overrides);

  if (!canonicalOwnerKey || canonicalOwnerKey === 'anonymous' || ownerKeys.length === 0) return;

  for (const baseKey of CLIENT_PROGRESS_KEYS) {
    const payloads = [];

    for (const ownerKey of ownerKeys) {
      const scopedKey = getScopedStorageKey(baseKey, ownerKey);

      for (const storage of getOrderedStorages()) {
        const parsed = parseProgressPayload(storage.getItem(scopedKey));
        if (parsed) payloads.push(parsed);
      }
    }

    if (!payloads.length) continue;

    const mergedPayload = mergeProgressPayloads(baseKey, payloads);
    if (!mergedPayload) continue;

    writeScopedStorageValue(baseKey, canonicalOwnerKey, serializeProgressPayload(mergedPayload));

    for (const ownerKey of ownerKeys) {
      if (ownerKey === canonicalOwnerKey) continue;
      const scopedKey = getScopedStorageKey(baseKey, ownerKey);
      for (const storage of getAvailableStorages()) {
        storage.removeItem(scopedKey);
      }
    }
  }
};

export const removeLegacyScopedStorageItem = (baseKey) => {
  for (const storage of getAvailableStorages()) {
    storage.removeItem(baseKey);
  }
};

export const clearLegacyProgressCaches = () => {
  removeLegacyScopedStorageItem('lessonProgress');
  removeLegacyScopedStorageItem('quizProgress');
};
