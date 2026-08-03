const TRUE_LIKE_VALUES = new Set(['1', 'active', 'enrolled', 'true', 'yes']);
const FALSE_LIKE_VALUES = new Set(['0', 'false', 'inactive', 'not-enrolled', 'not_enrolled', 'no', 'unenrolled']);

const parseEnrollmentValue = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (TRUE_LIKE_VALUES.has(normalized)) return true;
    if (FALSE_LIKE_VALUES.has(normalized)) return false;
  }

  return null;
};

export const resolveEnrollmentStatus = (course) => {
  const apiValues = [
    course?.isEnrolled,
    course?.enrolled,
    course?.is_enrolled,
    course?.enrollment?.active,
    course?.enrollment?.isActive,
    course?.enrollment?.is_active,
    course?.enrollmentStatus,
    course?.enrollment_status,
    course?.enrollment?.status,
  ];

  for (const value of apiValues) {
    const parsed = parseEnrollmentValue(value);
    if (parsed !== null) return parsed;
  }

  return null;
};
