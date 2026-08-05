import api from './api';

export const liveSessionApi = {
  getInstructorSessions: async () => {
  const res = await api.get('/live-sessions');

  return (res.data.liveSessions || []).map((session) => ({
    id: session._id,

    title: session.title,

    date: session.startAt
      ? new Date(session.startAt).toISOString().split('T')[0]
      : '',

    time: session.startAt
      ? new Date(session.startAt)
          .toTimeString()
          .slice(0, 5)
      : '',

    meetingLink: session.meetingUrl,

    courseId: session.course?._id,
    courseTitle: session.course?.title,

    durationMinutes: session.durationMinutes,

    status: session.status,
  }));
},

  getStudentSessions: async () => {
  const res = await api.get('/live-sessions/student');

  return (res.data.liveSessions || []).map((session) => ({
    id: session._id,
    title: session.title,

    date: session.startAt
      ? new Date(session.startAt).toISOString().split('T')[0]
      : '',

    time: session.startAt
      ? new Date(session.startAt)
          .toTimeString()
          .slice(0, 5)
      : '',

    meetingLink: session.meetingUrl,

    courseId: session.course?._id,
    courseTitle: session.course?.title,

    instructorName:
      session.instructor?.name || 'Instructor',

    durationMinutes: session.durationMinutes,

    status: session.status,
  }));
},

  createSession: async (payload) => {
    const res = await api.post('/live-sessions', payload);
    return res.data.liveSession;
  },

  updateSession: async (id, payload) => {
    const res = await api.put(`/live-sessions/${id}`, payload);
    return res.data.liveSession;
  },

  deleteSession: async (id) => {
    await api.delete(`/live-sessions/${id}`);
  }
};