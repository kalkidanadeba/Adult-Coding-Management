import React, { useEffect, useRef, useState } from 'react';
import { FaCalendarAlt, FaExternalLinkAlt, FaVideo, FaClock, FaUser } from 'react-icons/fa';
import toast from 'react-hot-toast';
import Navbar from '../components/common/Navbar';
import SiteFooter from '../components/common/SiteFooter';
import { studentApi } from '../services/studentApi';
import { liveSessionApi } from '../services/liveSessionApi';

const StudentLiveSessions = () => {
  const [liveSessions, setLiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const enrolledCourseIdsRef = useRef([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        // Get dashboard data to get enrolled course IDs
        const dashboard = await studentApi.getMyDashboard().catch(() => null);
        const enrolledIds = dashboard?.enrolledCourseIds || dashboard?.courseIds || dashboard?.coursesIds || [];
        
        if (!active) return;
        enrolledCourseIdsRef.current = enrolledIds;

        // Get live sessions for enrolled courses
        const upcomingSessions = await liveSessionApi.getStudentSessions();
        
        if (!active) return;
        setLiveSessions(upcomingSessions);
      } catch (error) {
        if (!active) return;
        toast.error(error?.message || 'Unable to load live sessions');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    // Listen for live session updates from instructor side
    const handleLiveSessionsUpdate = async () => {
      try {
        const upcomingSessions = await liveSessionApi.getStudentSessions();
        setLiveSessions(upcomingSessions);
      } catch (error) {
        toast.error(error?.message || 'Unable to refresh live sessions');
      }
    };

    window.addEventListener('live-sessions:updated', handleLiveSessionsUpdate);
    return () => {
      active = false;
      window.removeEventListener('live-sessions:updated', handleLiveSessionsUpdate);
    };
  }, []);

  const formatDate = (dateString) => {
    try {
      const date = new Date(`${dateString}T00:00:00`);
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString) => {
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours, 10);
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${period}`;
    } catch {
      return timeString;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-green-100 p-3 text-green-600">
              <FaVideo className="text-2xl" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-600">Student workspace</p>
              <h1 className="mt-2 text-3xl font-extrabold text-gray-900">Live sessions</h1>
              <p className="mt-2 max-w-2xl text-gray-600">
                Join instructor-led conversations for your enrolled courses. Click "Join now" to access the meeting.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 shadow-sm text-center">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
            </div>
            <p className="mt-4 text-gray-600">Loading live sessions...</p>
          </div>
        ) : liveSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 shadow-sm text-center">
            <div className="rounded-full inline-block bg-gray-100 p-4 text-gray-400 mb-4">
              <FaVideo className="text-3xl" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No live sessions scheduled</h3>
            <p className="mt-2 text-gray-600">
              Check back soon! Instructors will announce upcoming live sessions here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {liveSessions.map((session) => (
              <div key={session.id} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                {/* Course Title */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                    {session.courseTitle || session.courseId}
                  </p>
                </div>

                {/* Session Title */}
                <h3 className="text-lg font-extrabold text-gray-900 line-clamp-2 mb-4">
                  {session.title}
                </h3>

                {/* Session Details */}
                <div className="space-y-3 mb-6 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <FaCalendarAlt className="text-green-500 flex-shrink-0" />
                    <span>{formatDate(session.date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaClock className="text-green-500 flex-shrink-0" />
                    <span>{formatTime(session.time)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaUser className="text-green-500 flex-shrink-0" />
                    <span>{session.instructorName || 'Instructor'}</span>
                  </div>
                </div>

                {/* Description */}
                {session.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {session.description}
                  </p>
                )}

                {/* Platform Badge */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-block px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full">
                    {session.platform || 'Zoom'}
                  </span>
                </div>

                {/* Join Button */}
                <a
                  href={session.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                >
                  <FaExternalLinkAlt className="text-xs" />
                  Join now
                </a>
              </div>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default StudentLiveSessions;
