import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { FaCheckCircle, FaClipboardList, FaSearch, FaTimesCircle, FaTrophy } from 'react-icons/fa';
import toast from 'react-hot-toast';
import Navbar from '../components/common/Navbar';
import SiteFooter from '../components/common/SiteFooter';
import { studentApi } from '../services/studentApi';

const formatDateTime = (iso) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
};

const normalizeAttempt = (attempt) => ({
  timestamp: attempt?.timestamp ?? attempt?.submitted_at ?? attempt?.submittedAt ?? attempt?.createdAt ?? null,
  percent: attempt?.percent ?? attempt?.score ?? attempt?.percentage ?? 0,
});

const normalizeRow = (row) => {
  const courseId = row?.courseId ?? row?.course_id ?? row?.course ?? null;
  const lessonId = row?.lessonId ?? row?.lesson_id ?? row?.lesson ?? null;

  const attempts = Array.isArray(row?.attempts) ? row.attempts.map(normalizeAttempt) : Array.isArray(row?.history) ? row.history.map(normalizeAttempt) : [];
  const attemptsCount =
    typeof row?.attemptsCount === 'number'
      ? row.attemptsCount
      : typeof row?.attempt_number === 'number'
        ? row.attempt_number
        : attempts.length;

  const bestPercent =
    typeof row?.bestPercent === 'number'
      ? Math.round(row.bestPercent * 10) / 10
      : typeof row?.best_percent === 'number'
        ? Math.round(row.best_percent * 10) / 10
        : typeof row?.bestScore === 'number'
          ? Math.round(row.bestScore * 10) / 10
          : typeof row?.score === 'number'
            ? Math.round(row.score * 10) / 10
            : Math.round(attempts.reduce((max, a) => Math.max(max, a.percent || 0), 0) * 10) / 10;

  const lastAttemptAt =
    row?.lastAttemptAt ??
    row?.last_attempt_at ??
    row?.updatedAt ??
    (attempts.length ? attempts[attempts.length - 1]?.timestamp : null);

  const passed =
    typeof row?.passed === 'boolean'
      ? row.passed
      : typeof row?.isPassed === 'boolean'
        ? row.isPassed
        : typeof row?.is_passed === 'boolean'
          ? row.is_passed
          : row?.status === 'passed'
            ? true
            : bestPercent >= 60;

  const courseTitle =
    row?.courseTitle ??
    row?.course_title ??
    row?.courseName ??
    row?.course_name ??
    row?.course?.title ??
    null;
  const lessonTitle =
    row?.lessonTitle ??
    row?.lesson_title ??
    row?.lessonName ??
    row?.lesson_name ??
    row?.lesson?.title ??
    null;
  const quizTitle =
    row?.quizTitle ??
    row?.quiz_title ??
    row?.quizName ??
    row?.quiz_name ??
    row?.quiz?.title ??
    'Lesson quiz';

  return {
    courseId: courseId != null ? String(courseId) : null,
    lessonId: lessonId != null ? String(lessonId) : null,
    courseTitle: courseTitle || (courseId != null ? String(courseId) : ''),
    lessonTitle: lessonTitle || (lessonId != null ? String(lessonId) : ''),
    quizTitle,
    bestPercent: typeof bestPercent === 'number' ? bestPercent : 0,
    passed,
    attemptsCount,
    lastAttemptAt: lastAttemptAt ? String(lastAttemptAt) : null,
  };
};

const Results = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [courseFilter, setCourseFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await studentApi.getMyResults();
        if (!active) return;
        const normalized = Array.isArray(data) ? data.map(normalizeRow).filter((r) => r.courseId && r.lessonId) : [];
        normalized.sort((a, b) => String(b.lastAttemptAt || '').localeCompare(String(a.lastAttemptAt || '')));
        setRows(normalized);
      } catch (err) {
        if (!active) return;
        setRows([]);
        toast.error(err?.response?.data?.message || err?.message || 'Failed to load results');
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
    const unique = new Map();
    for (const row of rows) {
      unique.set(row.courseId, row.courseTitle);
    }
    return Array.from(unique.entries()).map(([id, title]) => ({ id, title }));
  }, [rows]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesCourse = courseFilter === 'All' || row.courseId === courseFilter;
      const matchesStatus = status === 'All' || (status === 'Passed' ? row.passed : !row.passed);

      const searchable = `${row.courseTitle} ${row.lessonTitle} ${row.quizTitle}`.toLowerCase();
      const matchesSearch = !query || searchable.includes(query);

      return matchesCourse && matchesStatus && matchesSearch;
    });
  }, [rows, courseFilter, status, search]);

  const stats = useMemo(() => {
    const attempted = rows.length;
    const passed = rows.filter((r) => r.passed).length;
    const averageBest = attempted ? Math.round(rows.reduce((sum, r) => sum + (r.bestPercent || 0), 0) / attempted) : 0;
    return { attempted, passed, averageBest };
  }, [rows]);

  const statCards = [
    { label: 'Quizzes attempted', value: stats.attempted, Icon: FaClipboardList },
    { label: 'Quizzes passed', value: stats.passed, Icon: FaTrophy },
    { label: 'Average best score', value: `${stats.averageBest}%`, Icon: FaCheckCircle },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-3xl">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Results</h1>
            <p className="mt-3 text-gray-600 text-lg leading-relaxed text-justify">
              Review each lesson quiz in one simple card with your best score and total attempts.
            </p>
          </div>

          <div className="w-full lg:max-w-xl grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="relative">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-field pl-11"
                  placeholder="Search course, lesson, or quiz..."
                  aria-label="Search results"
                />
              </div>
            </div>

            <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="input-field" aria-label="Filter by course">
              <option value="All">All courses</option>
              {courseOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.title}
                </option>
              ))}
            </select>

            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-field" aria-label="Filter by status">
              <option value="All">All statuses</option>
              <option value="Passed">Passed</option>
              <option value="Not passed">Not passed</option>
            </select>
          </div>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
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

        <div className="mt-10 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filtered.length}</span>{' '}
            {filtered.length === 1 ? 'quiz' : 'quizzes'}
          </p>
        </div>

        {loading ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-10 text-center">
            <p className="text-gray-900 font-bold text-lg">Loading results...</p>
            <p className="mt-2 text-gray-600">Please wait a moment.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-10 text-center">
            <p className="text-gray-900 font-bold text-lg">No results found</p>
            <p className="mt-2 text-gray-600">Take a quiz from a lesson to generate results.</p>
            <Link
              to="/courses"
              className="mt-6 inline-flex items-center justify-center bg-primary-500 text-white px-5 py-2.5 rounded-lg hover:bg-primary-600 transition-colors font-medium"
            >
              Go to courses
            </Link>
          </div>
        ) : (
          <Motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.08 } },
            }}
            className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {filtered.map((row) => (
              <Motion.div
                key={`${row.courseId}-${row.lessonId}`}
                variants={{
                  hidden: { opacity: 0, y: 14 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
                }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.99 }}
                transition={{ type: 'spring', stiffness: 360, damping: 22 }}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-primary-200 hover:shadow-md flex flex-col"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 truncate">{row.courseTitle}</p>
                    <h3 className="mt-1 text-lg font-extrabold text-gray-900 truncate">{row.lessonTitle}</h3>
                    {row.quizTitle && row.quizTitle !== 'Lesson quiz' ? (
                      <p className="mt-2 text-sm text-gray-600 text-justify">{row.quizTitle}</p>
                    ) : null}
                  </div>

                  <div className="shrink-0 flex items-center gap-2 text-sm font-semibold">
                    {row.passed ? (
                      <>
                        <FaCheckCircle className="text-primary-600" aria-hidden="true" />
                        <span className="text-primary-700">Passed</span>
                      </>
                    ) : (
                      <>
                        <FaTimesCircle className="text-red-500" aria-hidden="true" />
                        <span className="text-red-600">Not passed</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-5 text-sm text-gray-700 space-y-1">
                  <p>
                    Best score: <span className="font-extrabold text-primary-700">{row.bestPercent}%</span>
                  </p>
                  <p>
                    Attempts: <span className="font-semibold">{row.attemptsCount}</span>
                  </p>
                  <p className="text-xs text-gray-500">Last attempt: {formatDateTime(row.lastAttemptAt) || '—'}</p>
                </div>

                <div className="mt-6 grid gap-3">
                  <Link
                    to={`/results/${row.courseId}/${row.lessonId}`}
                    className="inline-flex items-center justify-center bg-primary-500 text-white px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-colors font-medium"
                  >
                    View result
                  </Link>
                  <Link
                    to={`/courses/${row.courseId}/lessons/${row.lessonId}/quiz`}
                    className="inline-flex items-center justify-center border-2 border-primary-500 text-primary-600 px-4 py-2.5 rounded-lg hover:bg-primary-50 transition-colors font-medium"
                  >
                    Retake quiz
                  </Link>
                </div>
              </Motion.div>
            ))}
          </Motion.div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default Results;
