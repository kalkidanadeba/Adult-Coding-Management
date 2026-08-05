const LIVE_SESSIONS_STORAGE_KEY = 'aclms_live_sessions';

const readStoredSessions = () => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(LIVE_SESSIONS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStoredSessions = (sessions) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LIVE_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
};


const normalizeSession = (session) => ({
  id: session?.id ?? session?._id ?? `session-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title: session?.title ?? '',
  description: session?.description ?? '',
  courseId: session?.courseId ?? session?.course_id ?? '',
  courseTitle: session?.courseTitle ?? session?.course_title ?? session?.course?.title ?? '',
  instructorName: session?.instructorName ?? session?.instructor_name ?? session?.instructor?.name ?? 'Instructor',
  date: session?.date ?? '',
  time: session?.time ?? '',
  platform: session?.platform ?? 'Zoom',
  meetingLink: session?.meetingLink ?? session?.meeting_link ?? '',
  createdAt: session?.createdAt ?? new Date().toISOString(),
});

const sortByDateTime = (left, right) => {
  const leftKey = `${left?.date ?? ''}T${left?.time ?? '00:00'}`;
  const rightKey = `${right?.date ?? ''}T${right?.time ?? '00:00'}`;
  return leftKey.localeCompare(rightKey);
};

export const liveSessionService = {
  getAll: async () => {
    const stored = readStoredSessions();
    if (stored.length) {
      return stored.map(normalizeSession).sort(sortByDateTime);
    }

    return [];
  },

  getUpcomingForCourses: async (courseIds = []) => {
    const ids = Array.from(new Set((courseIds || []).filter(Boolean).map((value) => String(value))));
    const sessions = (await liveSessionService.getAll()).filter((session) => {
      if (!session?.date) return false;
      if (!ids.length) return true;
      return ids.includes(String(session.courseId));
    });

    return sessions.sort(sortByDateTime);
  },

  create: async (payload) => {
    const nextSession = normalizeSession({
      ...payload,
      createdAt: new Date().toISOString(),
    });

    const sessions = readStoredSessions().map(normalizeSession);
    const updated = [nextSession, ...sessions];
    writeStoredSessions(updated);
    return nextSession;
  },

  update: async (id, payload) => {
    const sessions = readStoredSessions().map(normalizeSession);
    const index = sessions.findIndex((session) => String(session.id) === String(id));

    if (index < 0) {
      return null;
    }

    const updatedSession = normalizeSession({
      ...sessions[index],
      ...payload,
      id,
    });

    sessions[index] = updatedSession;
    writeStoredSessions(sessions);
    return updatedSession;
  },

  delete: async (id) => {
    const sessions = readStoredSessions().map(normalizeSession);
    const filtered = sessions.filter((session) => String(session.id) !== String(id));
    writeStoredSessions(filtered);
    return true;
  },
};

export default liveSessionService;
