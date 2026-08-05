import React, { useEffect, useMemo, useState } from 'react';
import { FaCalendarAlt, FaExternalLinkAlt, FaPlus, FaTrash, FaVideo } from 'react-icons/fa';
import toast from 'react-hot-toast';
import Navbar from '../components/common/Navbar';
import SiteFooter from '../components/common/SiteFooter';
import { studentApi } from '../services/studentApi';
import { liveSessionApi } from '../services/liveSessionApi';

const emptyForm = {
  title: '',
  description: '',
  courseId: '',
  courseTitle: '',
  instructorName: '',
  date: '',
  time: '',
  platform: 'Zoom',
  meetingLink: '',
};

const InstructorLiveSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [courseData, liveSessions] = await Promise.all([
          studentApi.getCourses().catch(() => []),
          liveSessionApi.getInstructorSessions().catch(() => []),
        ]);

        if (!active) return;

        setCourses(Array.isArray(courseData) ? courseData : []);
        setSessions(Array.isArray(liveSessions) ? liveSessions : []);
      } catch (error) {
        if (!active) return;
        toast.error(error?.message || 'Unable to load live sessions');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const courseOptions = useMemo(() => {
  return (courses || []).map((course) => ({
    value: course?._id || '',
    label: course?.title ?? course?.name ?? 'Untitled course',
  }));
}, [courses]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      !form.title ||
      !form.date ||
      !form.time ||
      !form.courseId ||
      !form.meetingLink
    ) {
      toast.error(
        'Please fill in the title, course, date, time, and meeting link.'
      );
      return;
    }

    const startAt = new Date(
      `${form.date}T${form.time}:00`
    );

    const payload = {
      title: form.title,
      description: form.description,
      courseId: form.courseId,
      startAt,
      durationMinutes: 60,
      meetingUrl: form.meetingLink,
      status: 'scheduled',
    };

    try {
      if (editingId) {
        await liveSessionApi.updateSession(editingId, payload);
      } else {
        await liveSessionApi.createSession(payload);
      }

      const refreshed = await liveSessionApi.getInstructorSessions();

      setSessions(refreshed);
      setForm(emptyForm);
      setEditingId(null);

      toast.success(editingId ? 'Live session updated' : 'Live session created');

      window.dispatchEvent(new CustomEvent('live-sessions:updated'));
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Unable to save the live session');
    }
  };

  const handleEdit = (session) => {
  const startDate = session.startAt
    ? new Date(session.startAt)
    : null;

  setEditingId(session._id || session.id);

  setForm({
    title: session.title || '',
    description: session.description || '',
    courseId:
      session.course?._id ||
      session.courseId ||
      '',
    courseTitle:
      session.course?.title ||
      '',
    instructorName:
      session.instructor?.name ||
      '',
    date: startDate
      ? startDate.toISOString().split('T')[0]
      : '',
    time: startDate
      ? startDate.toTimeString().slice(0, 5)
      : '',
    platform: session.platform || 'Zoom',
    meetingLink:
      session.meetingUrl || '',
  });
};

  const handleDelete = async (sessionId) => {
    try {
      await liveSessionApi.deleteSession(sessionId);
      const refreshed = await liveSessionApi.getInstructorSessions();
      setSessions(refreshed);
      toast.success('Live session removed');
      window.dispatchEvent(new CustomEvent('live-sessions:updated'));
    } catch (error) {
      toast.error(error?.message || 'Unable to delete the live session');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-600">Instructor workspace</p>
            <h1 className="mt-2 text-3xl font-extrabold text-gray-900">Live sessions</h1>
            <p className="mt-3 max-w-2xl text-gray-600">
              Create, edit, and manage sessions for enrolled learners and share a direct join link.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1.1fr,0.9fr]">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-gray-900">Session planner</h2>
                <p className="mt-1 text-sm text-gray-600">Add the details students will see in the dashboard.</p>
              </div>
              <div className="rounded-full bg-primary-50 p-3 text-primary-600">
                <FaVideo />
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-gray-700">
                  Session title
                  <input
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="Live coding session"
                    required
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Instructor name
                  <input
                    value={form.instructorName}
                    onChange={(event) => setForm((current) => ({ ...current, instructorName: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="Your name"
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-gray-700">
                Description
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  rows="3"
                  placeholder="What students should expect"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-gray-700">
                  Course
                  <select
                    value={form.courseId}
                    onChange={(event) => setForm((current) => ({ ...current, courseId: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    required
                  >
                    <option value="">Select a course</option>
                    {courseOptions.map((course) => (
                      <option key={course.value} value={course.value}>
                        {course.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Platform
                  <select
                    value={form.platform}
                    onChange={(event) => setForm((current) => ({ ...current, platform: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="Zoom">Zoom</option>
                    <option value="Google Meet">Google Meet</option>
                    <option value="Microsoft Teams">Microsoft Teams</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-gray-700">
                  Date
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    required
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Time
                  <input
                    type="time"
                    value={form.time}
                    onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    required
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-gray-700">
                Meeting link
                <input
                  type="url"
                  value={form.meetingLink}
                  onChange={(event) => setForm((current) => ({ ...current, meetingLink: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="https://"
                  required
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 font-semibold text-white hover:bg-primary-700"
                >
                  <FaPlus /> {editingId ? 'Save changes' : 'Create session'}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyForm);
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 font-semibold text-gray-700"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-gray-900">Scheduled sessions</h2>
                <p className="mt-1 text-sm text-gray-600">Students will see these on their dashboard.</p>
              </div>
            </div>

            {loading ? (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-600">
                Loading schedules…
              </div>
            ) : sessions.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-600">
                No sessions yet. Create one to get started.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {sessions.map((session) => (
                  <div key={session.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-extrabold text-gray-900">{session.title}</p>
                        <p className="mt-1 text-sm text-gray-600">{session.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(session)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(session.id)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1">
                        <FaCalendarAlt /> {new Date(session.startAt).toLocaleString()}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1">{session.course?.title || 'Course'}</span>
                      <span className="rounded-full bg-white px-3 py-1">{session.platform}</span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <a
                        href={session.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white"
                      >
                        Join session <FaExternalLinkAlt />
                      </a>
                      <span className="text-sm text-gray-600">Instructor: {session.instructorName || 'Instructor'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

      </main>

      <SiteFooter />
    </div>
  );
};

export default InstructorLiveSessions;
