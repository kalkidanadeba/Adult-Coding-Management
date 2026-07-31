import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { FaAward, FaBookOpen, FaChartLine, FaCheckCircle, FaPlay, FaTrophy, FaUserCircle } from 'react-icons/fa';
import toast from 'react-hot-toast';
import Navbar from '../components/common/Navbar';
import SiteFooter from '../components/common/SiteFooter';

import { studentApi } from '../services/studentApi';
import { liveSessionApi } from '../services/liveSessionApi';
import { buildCourseCertificateStatus } from '../utils/courseCertificates';
import { withCourseIcon } from '../utils/courseIcons';
import { applyCourseLessonProgress } from '../utils/lessonProgress';

const normalizeCourse = (course) => {
  const id =
    course?.id ??
    course?._id ??
    course?.code ??
    course?.courseCode ??
    course?.course_code ??
    course?.courseId ??
    course?.course_id ??
    course?.slug ??
    null;
  return withCourseIcon({
    ...course,
    id: id != null ? String(id) : undefined,
    title: course?.title ?? course?.name ?? '',
  });
};

const normalizeResultRow = (row) => {
  const courseId = row?.courseId ?? row?.course_id ?? row?.course ?? null;
  const lessonId = row?.lessonId ?? row?.lesson_id ?? row?.lesson ?? null;
  const attemptsCount =
    typeof row?.attemptsCount === 'number'
      ? row.attemptsCount
      : Array.isArray(row?.attempts)
        ? row.attempts.length
        : 0;
  const bestPercent =
    typeof row?.bestPercent === 'number'
      ? row.bestPercent
      : typeof row?.best_percent === 'number'
        ? row.best_percent
        : typeof row?.bestScore === 'number'
          ? row.bestScore
          : typeof row?.score === 'number'
            ? row.score
            : typeof row?.percent === 'number'
              ? row.percent
              : 0;
  const passed = Boolean(row?.passed ?? row?.isPassed ?? row?.is_passed ?? row?.status === 'passed');
  const lastAttemptAt = row?.lastAttemptAt ?? row?.last_attempt_at ?? row?.updatedAt ?? row?.timestamp ?? null;

  return {
    courseId: courseId != null ? String(courseId) : null,
    lessonId: lessonId != null ? String(lessonId) : null,
    courseTitle: row?.courseTitle ?? row?.course_title ?? row?.courseName ?? row?.course_name ?? null,
    lessonTitle: row?.lessonTitle ?? row?.lesson_title ?? row?.lessonName ?? row?.lesson_name ?? null,
    attemptsCount,
    bestPercent: typeof bestPercent === 'number' ? bestPercent : 0,
    passed,
    lastAttemptAt: lastAttemptAt ? String(lastAttemptAt) : null,
  };
};

const pickArray = (...candidates) => {
  for (const value of candidates) {
    if (Array.isArray(value)) return value;
  }
  return [];
};

const Dashboard = () => {
  

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [results, setResults] = useState([]);
  const [coursesProgress, setCoursesProgress] = useState([]);
  const [liveSessions, setLiveSessions] = useState([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [dashboard, myResults, myCourses] = await Promise.all([
          studentApi.getMyDashboard().catch(() => null),
          studentApi.getMyResults().catch(() => []),
          studentApi.getMyCourses().catch(() => []),
        ]);

        const enrolledCourseIds = pickArray(
          dashboard?.enrolledCourseIds,
          dashboard?.courseIds,
          dashboard?.coursesIds,
          dashboard?.data?.enrolledCourseIds
        ).map(String);

        const upcomingSessions =
        await liveSessionApi.getStudentSessions();

        if (!active) return;
        setLiveSessions(upcomingSessions);

        if (!active) return;
        setDashboardData(dashboard);

        const normalizedResults = Array.isArray(myResults) ? myResults.map(normalizeResultRow).filter((r) => r.courseId && r.lessonId) : [];
        setResults(normalizedResults);

        const courseRowsRaw = pickArray(
          dashboard?.courses,
          dashboard?.myCourses,
          dashboard?.enrolledCourses,
          dashboard?.enrollments,
          dashboard?.data?.courses,
          dashboard?.data?.enrolledCourses
        );

        let selectedCourses = [];

        if (courseRowsRaw.length) {
          selectedCourses = courseRowsRaw
            .map((entry) => {
              const courseObj = entry?.course ?? entry;
              const normalizedCourse = courseObj ? normalizeCourse(courseObj) : null;
              const courseId =
                entry?.courseId ??
                entry?.course_id ??
                normalizedCourse?.id ??
                entry?.id ??
                entry?._id ??
                entry?.code ??
                null;
              return {
                courseId: courseId != null ? String(courseId) : null,
                course: normalizedCourse,
              };
            })
            .filter((row) => row.courseId && row.course?.title);
        }

        if (!selectedCourses.length) {
          selectedCourses = Array.isArray(myCourses)
            ? myCourses
                .map(normalizeCourse)
                .filter((c) => c?.id)
                .map((course) => ({ courseId: String(course.id), course }))
            : [];
        }

        if (!selectedCourses.length) {
          if (!enrolledCourseIds.length) {
            setCoursesProgress([]);
            return;
          }

          const allCourses = await studentApi.getCourses().catch(() => []);
          selectedCourses = Array.isArray(allCourses)
            ? allCourses
                .map(normalizeCourse)
                .filter((c) => c?.id && enrolledCourseIds.includes(String(c.id)))
                .map((course) => ({ courseId: String(course.id), course }))
            : [];
        }

        const progressRows = await Promise.all(
          selectedCourses.map(async (entry) => {
            try {
              const [lessonsData, quizzesData] = await Promise.all([
                studentApi.getLessonsByCourse(entry.courseId),
                studentApi.getQuizzesByCourse(entry.courseId).catch(() => []),
              ]);

              const lessons = applyCourseLessonProgress(entry.courseId, Array.isArray(lessonsData) ? lessonsData : []);
              const completedCount = lessons.filter((l) => Boolean(l?.completed ?? l?.isCompleted ?? l?.is_completed ?? l?.status === 'completed')).length;
              const totalCount = lessons.length;
              const percent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
              const firstIncomplete =
                lessons.find((l) => !(l?.completed ?? l?.isCompleted ?? l?.is_completed ?? l?.status === 'completed'))?.id ??
                lessons[0]?.id ??
                null;
              const certificateStatus = buildCourseCertificateStatus({
                courseId: entry.courseId,
                lessons,
                quizzes: Array.isArray(quizzesData) ? quizzesData : [],
                results: normalizedResults,
              });

              return {
                courseId: String(entry.courseId),
                course: entry.course,
                totalCount,
                completedCount,
                percent,
                continueLessonId: firstIncomplete != null ? String(firstIncomplete) : null,
                certificateStatus,
              };
            } catch {
              return {
                courseId: String(entry.courseId),
                course: entry.course,
                totalCount: 0,
                completedCount: 0,
                percent: 0,
                continueLessonId: null,
                certificateStatus: buildCourseCertificateStatus({
                  courseId: entry.courseId,
                  lessons: [],
                  quizzes: [],
                  results: normalizedResults,
                }),
              };
            }
          }),
        );

        if (!active) return;
        setCoursesProgress(progressRows);
      } catch (err) {
        if (!active) return;
        toast.error(err?.response?.data?.message || err?.message || 'Failed to load dashboard');
        setCoursesProgress([]);
        setResults([]);
        setDashboardData(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleLiveSessionsUpdate = async () => {
      try {
        const upcomingSessions =
          await liveSessionApi.getStudentSessions();

        setLiveSessions(upcomingSessions);
      } catch {
        setLiveSessions([]);
      }
    };

    window.addEventListener('live-sessions:updated', handleLiveSessionsUpdate);
    return () => window.removeEventListener('live-sessions:updated', handleLiveSessionsUpdate);
  }, [dashboardData]);

  const stats = useMemo(() => {
    const enrolledCourses = coursesProgress.length;
    const totalLessons = coursesProgress.reduce((sum, row) => sum + (row.totalCount || 0), 0);
    const completedLessons = coursesProgress.reduce((sum, row) => sum + (row.completedCount || 0), 0);
    const overallLessonPercent = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;

    const quizzesAttempted = results.length;
    const quizzesPassed = results.filter((r) => r.passed).length;
    const averageBest = quizzesAttempted ? Math.round(results.reduce((sum, r) => sum + (r.bestPercent || 0), 0) / quizzesAttempted) : 0;

    return {
      enrolledCourses,
      totalLessons,
      completedLessons,
      overallLessonPercent,
      quizzesAttempted,
      quizzesPassed,
      averageBest,
    };
  }, [coursesProgress, results]);

  const recentQuizResults = useMemo(() => {
    const rows = [...results];
    rows.sort((a, b) => String(b.lastAttemptAt || '').localeCompare(String(a.lastAttemptAt || '')));
    return rows.slice(0, 4);
  }, [results]);

  const statCards = [
    { label: 'Enrolled courses', value: stats.enrolledCourses, Icon: FaBookOpen },
    { label: 'Lessons completed', value: `${stats.completedLessons}/${stats.totalLessons}`, Icon: FaCheckCircle },
    { label: 'Overall progress', value: `${stats.overallLessonPercent}%`, Icon: FaChartLine },
    { label: 'Quizzes passed', value: `${stats.quizzesPassed}/${stats.quizzesAttempted}`, Icon: FaTrophy },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-3xl">
            
            <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
            <p className="mt-3 text-gray-600 text-lg leading-relaxed text-justify">
              Track your course progress, continue learning, and review recent quiz activity.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => (
            <Motion.div
              key={card.label}
              whileHover={{ scale: 1.01, y: -1 }}
              whileTap={{ scale: 0.99 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-primary-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600">{card.label}</p>
                  <p className="mt-2 text-2xl font-extrabold text-gray-900">{card.value}</p>
                </div>
                <div className="shrink-0 w-12 h-12 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-700">
                  <card.Icon size={20} aria-hidden="true" />
                </div>
              </div>
            </Motion.div>
          ))}
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr,360px] items-start">
          <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-extrabold text-gray-900">My courses</h2>
            <p className="mt-2 text-sm text-gray-600">Continue where you left off.</p>

            {loading ? (
              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <p className="text-gray-900 font-bold">Loading your dashboard…</p>
                <p className="mt-2 text-sm text-gray-600">Please wait a moment.</p>
              </div>
            ) : coursesProgress.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <p className="text-gray-900 font-bold">No enrolled courses yet</p>
                <p className="mt-2 text-sm text-gray-600">Browse the catalog and enroll to start learning.</p>
                <Link
                  to="/courses"
                  className="mt-4 inline-flex items-center justify-center bg-primary-500 text-white px-5 py-2.5 rounded-lg hover:bg-primary-600 transition-colors font-medium"
                >
                  Browse courses
                </Link>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {coursesProgress.map((item) => (
                  <Motion.div
                    key={item.courseId}
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-6 hover:bg-white hover:border-primary-200 hover:shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                      <div className="min-w-0">
                        <h3 className="text-lg font-extrabold text-gray-900">{item.course?.title || item.courseId}</h3>
                        <p className="mt-2 text-sm text-gray-600">
                          {item.completedCount} of {item.totalCount} lessons completed ({item.percent}%)
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          {item.certificateStatus?.passedQuizCount ?? 0} of {item.certificateStatus?.requiredQuizCount ?? 0} required quizzes passed
                        </p>
                        <div className="mt-3 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-primary-500" style={{ width: `${item.percent}%` }} />
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                        {item.certificateStatus?.eligible ? (
                          <Link
                            to={`/courses/${item.courseId}/certificate`}
                            className="inline-flex items-center justify-center gap-2 bg-[#0f646c] text-white px-4 py-2.5 rounded-lg hover:bg-[#0b5157] transition-colors font-medium"
                          >
                            <FaAward aria-hidden="true" /> Certificate
                          </Link>
                        ) : null}
                        <Link
                          to={`/courses/${item.courseId}/lessons`}
                          className="inline-flex items-center justify-center border-2 border-primary-500 text-primary-600 px-4 py-2.5 rounded-lg hover:bg-primary-50 transition-colors font-medium"
                        >
                          View lessons
                        </Link>
                        {item.continueLessonId ? (
                          <Link
                            to={`/courses/${item.courseId}/lessons/${item.continueLessonId}`}
                            className="inline-flex items-center justify-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-colors font-medium"
                          >
                            <FaPlay aria-hidden="true" /> Continue
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </Motion.div>
                ))}
              </div>
            )}
          </section>

          <aside className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm lg:sticky lg:top-24">
            <div className="rounded-2xl border border-primary-100 bg-primary-50 p-4">
              <h2 className="text-lg font-extrabold text-gray-900">Upcoming live sessions</h2>
              <p className="mt-1 text-sm text-gray-600">Join instructor-led conversations for your enrolled courses.</p>

              {liveSessions.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-primary-200 bg-white p-4 text-sm text-gray-600">
                  No sessions are scheduled right now.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {liveSessions.map((session) => (
                    <div key={session.id} className="rounded-xl border border-primary-100 bg-white p-3">
                      <p className="text-sm font-extrabold text-gray-900">{session.title}</p>
                      <p className="mt-1 text-xs text-gray-600">{session.courseTitle || session.courseId}</p>
                      <p className="mt-2 text-xs text-gray-600">{session.date} • {session.time}</p>
                      <p className="mt-1 text-xs text-gray-500">Instructor: {session.instructorName || 'Instructor'}</p>
                      <a
                        href={session.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center justify-center rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white"
                      >
                        Join now
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <h2 className="mt-8 text-xl font-extrabold text-gray-900">Recent quiz activity</h2>
            <p className="mt-2 text-sm text-gray-600">Your latest quiz attempts across lessons.</p>

            {loading ? (
              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <p className="text-gray-900 font-bold">Loading results…</p>
                <p className="mt-2 text-sm text-gray-600">Please wait a moment.</p>
              </div>
            ) : recentQuizResults.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <p className="text-gray-900 font-bold">No quiz attempts yet</p>
                <p className="mt-2 text-sm text-gray-600">Take a quiz from any lesson to see results here.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {recentQuizResults.map((row) => (
                  <div key={`${row.courseId}-${row.lessonId}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                    <p className="text-sm font-extrabold text-gray-900 truncate">{row.courseTitle || row.courseId}</p>
                    <p className="mt-1 text-xs text-gray-600 truncate">{row.lessonTitle || row.lessonId}</p>
                    <p className="mt-3 text-sm text-gray-700">
                      Best: <span className="font-extrabold text-primary-700">{row.bestPercent}%</span>{' '}
                      <span className="text-gray-500">({row.passed ? 'Passed' : 'Not passed'})</span>
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Attempts: {row.attemptsCount}</p>
                    <Link
                      to={`/results/${row.courseId}/${row.lessonId}`}
                      className="mt-4 inline-flex items-center justify-center border-2 border-primary-500 text-primary-600 px-4 py-2 rounded-lg hover:bg-primary-50 transition-colors font-medium w-full"
                    >
                      View result
                    </Link>
                  </div>
                ))}
              </div>
            )}

            <Link
              to="/results"
              className="mt-6 inline-flex items-center justify-center gap-2 bg-primary-500 text-white px-5 py-2.5 rounded-lg hover:bg-primary-600 transition-colors font-medium w-full"
            >
              <FaTrophy aria-hidden="true" /> View all results
            </Link>
          </aside>
        </div>

        {dashboardData?.message ? (
          <p className="mt-6 text-xs text-gray-500">Server message: {String(dashboardData.message)}</p>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  );
};

export default Dashboard;
