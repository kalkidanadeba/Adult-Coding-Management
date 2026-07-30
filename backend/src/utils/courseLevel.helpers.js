const CANONICAL_COURSE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

/**
 * Maps API / UI values to stored course levels (Title Case, matching catalog filters).
 */
function normalizeCourseLevel(input) {
  if (input === undefined || input === null) {
    return undefined;
  }
  const raw = String(input).trim();
  if (raw === '') {
    return undefined;
  }
  if (CANONICAL_COURSE_LEVELS.includes(raw)) {
    return raw;
  }
  const key = raw.toLowerCase();
  if (key === 'beginner') return 'Beginner';
  if (key === 'intermediate' || key === 'intermidiate') return 'Intermediate';
  if (key === 'advanced') return 'Advanced';
  return null;
}

module.exports = {
  CANONICAL_COURSE_LEVELS,
  normalizeCourseLevel
};
