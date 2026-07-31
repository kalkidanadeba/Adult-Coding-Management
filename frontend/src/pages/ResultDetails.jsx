import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FaArrowLeft, FaCheckCircle, FaClipboardList, FaRedo, FaTimesCircle, FaTrophy } from 'react-icons/fa';
import toast from 'react-hot-toast';
import Navbar from '../components/common/Navbar';
import SiteFooter from '../components/common/SiteFooter';
import { studentApi } from '../services/studentApi';
import { lessonRefToIdString, normalizeStudentQuiz } from '../utils/studentContent';

const formatDateTime = (iso) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
};

const parseNumberLike = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const parseBooleanLike = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'pass', 'passed', 'success', 'true', 'yes'].includes(normalized)) return true;
    if (['0', 'fail', 'failed', 'false', 'no'].includes(normalized)) return false;
  }
  return null;
};

const normalizeLesson = (lesson) => {
  const id = lesson?.code ?? lesson?.id ?? lesson?._id ?? lesson?.slug ?? lesson?.lessonId ?? lesson?.lesson_id ?? null;
  return {
    ...lesson,
    id: id != null ? String(id) : undefined,
    title: lesson?.title ?? lesson?.name ?? '',
  };
};

const normalizeAttempt = (attempt) => {
  const correctCount =
    parseNumberLike(attempt?.correctCount) ??
    parseNumberLike(attempt?.correct_answers) ??
    parseNumberLike(attempt?.correctAnswers) ??
    0;
  const total =
    parseNumberLike(attempt?.total) ??
    parseNumberLike(attempt?.total_questions) ??
    parseNumberLike(attempt?.totalQuestions) ??
    0;
  const rawPercent = parseNumberLike(attempt?.percent) ?? parseNumberLike(attempt?.score) ?? parseNumberLike(attempt?.percentage) ?? 0;
  const calculatedPercent = total > 0 ? Math.round((correctCount / total) * 100 * 10) / 10 : Math.round(rawPercent * 10) / 10;

  return {
    timestamp: attempt?.timestamp ?? attempt?.submitted_at ?? attempt?.submittedAt ?? attempt?.createdAt ?? null,
    percent: calculatedPercent,
    correctCount,
    total,
    passed:
      parseBooleanLike(attempt?.passed) ??
      parseBooleanLike(attempt?.isPassed) ??
      parseBooleanLike(attempt?.is_passed) ??
      parseBooleanLike(attempt?.status),
  };
};

const normalizeResultEntry = (entry) => {
  const attempts = Array.isArray(entry?.attempts)
    ? entry.attempts.map(normalizeAttempt)
    : Array.isArray(entry?.history)
      ? entry.history.map(normalizeAttempt)
      : [];

  const passPercent =
    parseNumberLike(entry?.passPercent) ??
    parseNumberLike(entry?.pass_percent) ??
    parseNumberLike(entry?.passingScore) ??
    parseNumberLike(entry?.passing_score) ??
    60;

  const bestPercent =
    parseNumberLike(entry?.bestPercent) ??
    parseNumberLike(entry?.best_percent) ??
    parseNumberLike(entry?.bestScore) ??
    parseNumberLike(entry?.score) ??
    Math.round(attempts.reduce((max, attempt) => Math.max(max, attempt.percent || 0), 0) * 10) / 10;

  const passed =
    parseBooleanLike(entry?.passed) ??
    parseBooleanLike(entry?.isPassed) ??
    parseBooleanLike(entry?.is_passed) ??
    parseBooleanLike(entry?.status) ??
    parseBooleanLike(entry?.result) ??
    attempts.some((attempt) => attempt?.passed === true) ??
    (bestPercent >= passPercent);

  const lastAttemptAt =
    entry?.lastAttemptAt ??
    entry?.last_attempt_at ??
    entry?.updatedAt ??
    (attempts.length ? attempts[attempts.length - 1]?.timestamp : null);

  return { attempts, bestPercent, passed, lastAttemptAt, passPercent };
};

const ResultDetails = () => {
  const { courseId, lessonId } = useParams();

  const [loading, setLoading] = useState(true);
  const [lesson, setLesson] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [progress, setProgress] = useState({ attempts: [], bestPercent: 0, passed: false, lastAttemptAt: null, passPercent: 60 });

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [lessonsData, quizzesData, resultsData] = await Promise.all([
          studentApi.getLessonsByCourse(courseId),
          studentApi.getQuizzesByCourse(courseId).catch(() => []),
          studentApi.getMyResults().catch(() => []),
        ]);

        if (!active) return;

        const lessons = Array.isArray(lessonsData) ? lessonsData.map(normalizeLesson) : [];
        setLesson(lessons.find((item) => String(item.id) === String(lessonId)) ?? null);

        const quizzes = Array.isArray(quizzesData) ? quizzesData.map(normalizeStudentQuiz) : [];
        setQuiz(quizzes.find((item) => String(item.lessonId) === String(lessonId)) ?? null);

        const matching = Array.isArray(resultsData)
          ? resultsData.find((row) => {
              const rowCourseId = lessonRefToIdString(row?.courseId ?? row?.course_id ?? row?.course);
              const rowLessonId = lessonRefToIdString(row?.lessonId ?? row?.lesson_id ?? row?.lesson);
              return String(rowCourseId ?? '') === String(courseId) && String(rowLessonId ?? '') === String(lessonId);
            })
          : null;

        setProgress(
          matching
            ? normalizeResultEntry(matching)
            : { attempts: [], bestPercent: 0, passed: false, lastAttemptAt: null, passPercent: 60 }
        );
      } catch (err) {
        if (!active) return;
        toast.error(err?.response?.data?.message || err?.message || 'Failed to load result details');
        setLesson(null);
        setQuiz(null);
        setProgress({ attempts: [], bestPercent: 0, passed: false, lastAttemptAt: null, passPercent: 60 });
      } finally {
        if (active) setLoading(false);
      }
    };

    if (courseId && lessonId) load();
    return () => {
      active = false;
    };
  }, [courseId, lessonId]);

  const attempts = Array.isArray(progress.attempts) ? progress.attempts : [];
  const passPercent =
    parseNumberLike(progress?.passPercent) ??
    parseNumberLike(quiz?.passPercent) ??
    parseNumberLike(quiz?.passingScore) ??
    60;
  const passed = Boolean(progress?.passed ?? (progress?.bestPercent ?? 0) >= passPercent);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link to="/results" className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700">
            <FaArrowLeft aria-hidden="true" /> Back to results
          </Link>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to={`/courses/${courseId}/lessons/${lessonId}/quiz`}
              className="inline-flex items-center justify-center gap-2 border-2 border-primary-500 text-primary-600 px-5 py-2.5 rounded-lg hover:bg-primary-50 transition-colors font-medium"
            >
              <FaRedo aria-hidden="true" /> Retake quiz
            </Link>
            <Link
              to={`/courses/${courseId}/lessons/${lessonId}`}
              className="inline-flex items-center justify-center bg-primary-500 text-white px-5 py-2.5 rounded-lg hover:bg-primary-600 transition-colors font-medium"
            >
              Open lesson
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-10">
            <p className="text-gray-900 font-bold text-lg">Loading result...</p>
            <p className="mt-2 text-gray-600">Please wait a moment.</p>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
              <div className="max-w-3xl">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-12 h-12 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-700">
                    <FaClipboardList size={20} aria-hidden="true" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{lesson?.title || lessonId}</h1>
                    <p className="mt-2 text-gray-600 text-lg leading-relaxed text-justify">
                      {quiz?.title ? quiz.title : 'Lesson quiz'}
                    </p>
                    <p className="mt-3 text-sm text-gray-600">
                      Pass score: <span className="font-semibold text-gray-900">{passPercent}%</span> | Best:{' '}
                      <span className="font-extrabold text-primary-700">{progress.bestPercent}%</span> | Attempts:{' '}
                      <span className="font-semibold text-gray-900">{attempts.length}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="w-full sm:max-w-xs rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <p className="text-gray-900 font-bold">Status</p>
                <div className="mt-3 flex items-center gap-2 text-sm font-semibold">
                  {passed ? (
                    <>
                      <FaTrophy className="text-primary-600" aria-hidden="true" />
                      <span className="text-primary-700">Passed</span>
                    </>
                  ) : (
                    <>
                      <FaTimesCircle className="text-red-500" aria-hidden="true" />
                      <span className="text-red-600">Not passed</span>
                    </>
                  )}
                </div>
                <p className="mt-3 text-sm text-gray-600">
                  Last attempt: <span className="font-semibold text-gray-900">{formatDateTime(progress.lastAttemptAt) || '-'}</span>
                </p>
              </div>
            </div>

            {attempts.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-8">
                <p className="text-gray-900 font-bold text-lg">No attempts yet</p>
                <p className="mt-2 text-gray-600">Take the quiz to generate a result.</p>
              </div>
            ) : (
              <div className="mt-10 space-y-8">
                <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                    <p className="text-sm text-gray-600">Best score</p>
                    <p className="mt-2 text-2xl font-extrabold text-primary-700">{progress.bestPercent}%</p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                    <p className="text-sm text-gray-600">Total attempts</p>
                    <p className="mt-2 text-2xl font-extrabold text-gray-900">{attempts.length}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                    <p className="text-sm text-gray-600">Last attempt</p>
                    <p className="mt-2 text-base font-semibold text-gray-900">{formatDateTime(progress.lastAttemptAt) || '-'}</p>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-extrabold text-gray-900">Attempt history</h2>
                  <p className="mt-2 text-sm text-gray-600">All recorded quiz results, newest first.</p>

                  <div className="mt-6 space-y-4">
                    {attempts
                      .map((attempt, idx) => ({ attempt, idx }))
                      .reverse()
                      .map(({ attempt, idx }, displayIndex) => {
                        const percent = attempt?.percent ?? 0;
                        const correctCount = attempt?.correctCount ?? 0;
                        const total = attempt?.total ?? 0;
                        const attemptPassed = Boolean(attempt?.passed ?? percent >= passPercent);

                        return (
                          <div key={attempt?.timestamp || idx} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm text-gray-600">Attempt {attempts.length - displayIndex}</p>
                                <p className="mt-2 text-2xl font-extrabold text-gray-900">{percent}%</p>
                                <p className="mt-2 text-sm text-gray-600">
                                  {correctCount}/{total} correct
                                </p>
                                <p className="mt-1 text-sm text-gray-500">{formatDateTime(attempt?.timestamp) || '-'}</p>
                              </div>

                              <div className="shrink-0 flex items-center gap-2 text-sm font-semibold">
                                {attemptPassed ? (
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
                          </div>
                        );
                      })}
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default ResultDetails;
