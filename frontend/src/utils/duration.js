const parseDurationNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const roundHours = (hours) => {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? rounded : rounded;
};

const firstFiniteNumber = (...values) => {
  for (const value of values) {
    const parsed = parseDurationNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

export const getLessonDurationMinutes = (lesson) =>
  firstFiniteNumber(
    lesson?.durationMinutes,
    lesson?.duration_minutes,
    lesson?.duration,
    lesson?.estimated_duration,
    lesson?.estimatedDuration,
  ) ?? 0;

export const getCourseDurationHours = (course, lessons = []) => {
  if (Array.isArray(lessons) && lessons.length) {
    const totalMinutes = lessons.reduce((sum, lesson) => sum + getLessonDurationMinutes(lesson), 0);
    if (totalMinutes > 0) return roundHours(totalMinutes / 60);
  }

  const explicitHours = firstFiniteNumber(course?.durationHours, course?.duration_hours);
  if (explicitHours !== null) return roundHours(explicitHours);

  const durationMinutes = firstFiniteNumber(
    course?.durationMinutes,
    course?.duration_minutes,
    course?.duration,
    course?.estimated_duration,
    course?.estimatedDuration,
  );

  return durationMinutes !== null ? roundHours(durationMinutes / 60) : 0;
};

export const formatDurationHoursLabel = (hours) => {
  const normalized = roundHours(parseDurationNumber(hours) ?? 0);
  return `${normalized} ${normalized === 1 ? 'hour' : 'hours'}`;
};
