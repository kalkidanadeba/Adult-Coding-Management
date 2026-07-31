import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { FaAward, FaCheckCircle, FaClipboardList, FaClock, FaLayerGroup, FaRegCircle, FaTrophy } from 'react-icons/fa';
import toast from 'react-hot-toast';
import Navbar from '../components/common/Navbar';
import SiteFooter from '../components/common/SiteFooter';
import { studentApi } from '../services/studentApi';
import { buildCourseCertificateStatus } from '../utils/courseCertificates';
import { withCourseIcon } from '../utils/courseIcons';
import { formatDurationHoursLabel, getLessonDurationMinutes } from '../utils/duration';
import { resolveEnrollmentStatus } from '../utils/enrollment';
import { resolveLessonCompletedState } from '../utils/lessonProgress';
import { normalizeStudentQuiz } from '../utils/studentContent';

const normalizeCourse = (course, fallbackId) => {
  const id =
    course?.id ??
    course?._id ??
    course?.code ??
    course?.courseCode ??
    course?.course_code ??
    course?.courseId ??
    course?.course_id ??
    course?.slug ??
    fallbackId;
  return withCourseIcon({
    ...course,
    id: id != null ? String(id) : undefined,
    title: course?.title ?? course?.name ?? '',
    description: course?.description ?? course?.summary ?? '',
    category: course?.category ?? course?.categoryName ?? 'General',
    level: course?.level ?? course?.difficulty ?? 'Beginner',
    lessons: course?.lessons ?? course?.lessonCount ?? course?.totalLessons ?? 0,
    durationHours: course?.durationHours ?? course?.duration ?? course?.duration_hours ?? 0,
    outcomes: Array.isArray(course?.outcomes) ? course.outcomes : Array.isArray(course?.learningOutcomes) ? course.learningOutcomes : [],
    isEnrolled: resolveEnrollmentStatus(course, id),
  });
};

const normalizeLesson = (lesson, courseId) => {
  const id = lesson?.code ?? lesson?.id ?? lesson?._id ?? lesson?.slug ?? lesson?.lessonId ?? lesson?.lesson_id ?? null;
  return {
    ...lesson,
    id: id != null ? String(id) : undefined,
    title: lesson?.title ?? lesson?.name ?? '',
    summary: lesson?.summary ?? lesson?.description ?? '',
    durationMinutes: getLessonDurationMinutes(lesson),
    order: lesson?.order ?? lesson?.orderIndex ?? lesson?.order_index ?? lesson?.position ?? 0,
    completed: resolveLessonCompletedState(courseId, lesson),
  };
};

const CourseLessons = () => {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [lessonsRaw, setLessonsRaw] = useState([]);
  const [quizzesRaw, setQuizzesRaw] = useState([]);
  const [resultsRaw, setResultsRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setEnrolled(true);

      try {
        const [courseData, lessonsData, quizzesData, resultsData] = await Promise.all([
          studentApi.getCourseById(courseId).catch(() => null),
          studentApi.getLessonsByCourse(courseId),
          studentApi.getQuizzesByCourse(courseId).catch(() => []),
          studentApi.getMyResults().catch(() => []),
        ]);

        if (!active) return;

        const normalizedCourse = courseData ? normalizeCourse(courseData, courseId) : null;
        setCourse(normalizedCourse);

        const lessons = Array.isArray(lessonsData) ? lessonsData.map((lesson) => normalizeLesson(lesson, courseId)) : [];
        lessons.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setLessonsRaw(lessons);

        const quizzes = Array.isArray(quizzesData) ? quizzesData.map(normalizeStudentQuiz).filter((q) => q?.lessonId) : [];
        setQuizzesRaw(quizzes);
        setResultsRaw(Array.isArray(resultsData) ? resultsData : []);

        if (normalizedCourse && typeof normalizedCourse.isEnrolled === 'boolean') {
          setEnrolled(Boolean(normalizedCourse.isEnrolled));
        }
      } catch (err) {
        if (!active) return;

        if (err?.response?.status === 403) {
          setEnrolled(false);
          setLessonsRaw([]);
          setQuizzesRaw([]);
          setResultsRaw([]);
        } else {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to load lessons');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    if (courseId) load();
    return () => {
      active = false;
    };
  }, [courseId]);

  const lessons = useMemo(() => lessonsRaw, [lessonsRaw]);
  const certificateStatus = useMemo(
    () =>
      buildCourseCertificateStatus({
        courseId,
        lessons: lessonsRaw,
        quizzes: quizzesRaw,
        results: resultsRaw,
      }),
    [courseId, lessonsRaw, quizzesRaw, resultsRaw],
  );

  const quizByLessonId = useMemo(() => {
    const map = new Map();
    for (const quiz of quizzesRaw) {
      if (!quiz?.lessonId) continue;
      map.set(String(quiz.lessonId), quiz);
    }
    return map;
  }, [quizzesRaw]);

  const quizPassByLessonId = useMemo(() => {
    const map = new Map();
    for (const quiz of certificateStatus.quizStatus ?? []) {
      if (!quiz?.lessonId) continue;
      map.set(String(quiz.lessonId), Boolean(quiz.passed));
    }
    return map;
  }, [certificateStatus.quizStatus]);

  const completedCount = lessons.filter((lesson) => lesson.completed).length;
  const percent = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;

  const continueLessonId = useMemo(() => {
    if (!lessons.length) return null;
    const firstIncomplete = lessons.find((lesson) => !lesson.completed);
    return firstIncomplete?.id ?? lessons[0]?.id ?? null;
  }, [lessons]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <Link
              to={courseId ? `/courses/${courseId}` : '/courses'}
              className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
            >
              Back to course
            </Link>

            <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              {course?.title || 'Lessons'}
            </h1>
            <p className="mt-3 text-gray-600 text-lg leading-relaxed text-justify">
              Follow the lessons in order, mark each one complete, and track your progress.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-10">
            <p className="text-gray-900 font-bold text-lg">Loading lessons...</p>
            <p className="mt-2 text-gray-600">Please wait a moment.</p>
          </div>
        ) : !course ? (
          <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-10">
            <p className="text-gray-900 font-bold text-lg">Course not found</p>
            <p className="mt-2 text-gray-600">The course you are looking for may have been moved or removed.</p>
          </div>
        ) : !enrolled ? (
          <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-10">
            <p className="text-gray-900 font-bold text-lg">Enroll to access lessons</p>
            <p className="mt-2 text-gray-600">You need to enroll in this course before you can view its lessons.</p>
            <Link
              to={`/courses/${courseId}`}
              className="mt-6 inline-flex items-center justify-center bg-primary-500 text-white px-5 py-2.5 rounded-lg hover:bg-primary-600 transition-colors font-medium"
            >
              Go to course details
            </Link>
          </div>
        ) : lessons.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-10">
            <p className="text-gray-900 font-bold text-lg">No lessons available</p>
            <p className="mt-2 text-gray-600">Lessons will appear here once they are added.</p>
          </div>
        ) : (
          <div className="mt-10 grid lg:grid-cols-[1fr,320px] gap-8 items-start">
            <Motion.div
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.06 } },
              }}
              className="space-y-4"
            >
              {lessons.map((lesson, index) => {
                const completed = Boolean(lesson.completed);
                const StatusIcon = completed ? FaCheckCircle : FaRegCircle;
                const quiz = quizByLessonId.get(String(lesson.id));
                const quizPassed = quizPassByLessonId.get(String(lesson.id)) === true;

                return (
                  <Motion.div
                    key={lesson.id}
                    variants={{
                      hidden: { opacity: 0, y: 12 },
                      show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
                    }}
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                    className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-primary-200 hover:shadow-md"
                  >
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 w-12 h-12 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-700">
                        <span className="font-extrabold">{index + 1}</span>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h2 className="text-lg font-extrabold text-gray-900">{lesson.title}</h2>
                            <p className="mt-2 text-sm text-gray-600 leading-relaxed text-justify">{lesson.summary}</p>
                          </div>

                          <div className="shrink-0 flex items-center gap-2 text-sm text-gray-700">
                            <StatusIcon className={completed ? 'text-primary-600' : 'text-gray-300'} aria-hidden="true" />
                            <span className="font-medium">{completed ? 'Completed' : 'In Progress'}</span>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                            <span className="inline-flex items-center gap-1">
                              <FaClock className="text-primary-600" aria-hidden="true" /> {formatDurationHoursLabel((lesson.durationMinutes || 0) / 60)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <FaLayerGroup className="text-primary-600" aria-hidden="true" /> Lesson
                            </span>
                            {quiz ? (
                              <span className="inline-flex items-center gap-1">
                                {quizPassed ? (
                                  <FaTrophy className="text-primary-600" aria-hidden="true" />
                                ) : (
                                  <FaClipboardList className="text-primary-600" aria-hidden="true" />
                                )}
                                {quizPassed ? 'Quiz passed' : 'Quiz available'}
                              </span>
                            ) : null}
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                            <Link
                              to={`/courses/${courseId}/lessons/${lesson.id}`}
                              className="inline-flex items-center justify-center bg-primary-500 text-white px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-colors font-medium"
                            >
                              Open lesson
                            </Link>

                            {quiz ? (
                              <Link
                                to={`/courses/${courseId}/lessons/${lesson.id}/quiz`}
                                className="inline-flex items-center justify-center gap-2 border-2 border-primary-500 text-primary-600 px-4 py-2.5 rounded-lg hover:bg-primary-50 transition-colors font-medium"
                              >
                                {quizPassed ? <FaTrophy aria-hidden="true" /> : <FaClipboardList aria-hidden="true" />}
                                Quiz
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Motion.div>
                );
              })}
            </Motion.div>

            <aside className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
              <p className="text-gray-900 font-extrabold text-lg">Your progress</p>
              <p className="mt-2 text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{completedCount}</span> of{' '}
                <span className="font-semibold text-gray-900">{lessons.length}</span> lessons completed
              </p>
              <p className="mt-1 text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{certificateStatus.passedQuizCount}</span> of{' '}
                <span className="font-semibold text-gray-900">{certificateStatus.requiredQuizCount}</span> required quizzes passed
              </p>

              <div className="mt-4">
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-2 text-sm font-semibold text-primary-700">{percent}%</p>
              </div>

              {continueLessonId ? (
                <Link
                  to={`/courses/${courseId}/lessons/${continueLessonId}`}
                  className="mt-6 inline-flex items-center justify-center bg-primary-500 text-white px-5 py-2.5 rounded-lg hover:bg-primary-600 transition-colors font-medium w-full"
                >
                  Continue learning
                </Link>
              ) : null}

              {certificateStatus.eligible ? (
                <Link
                  to={`/courses/${courseId}/certificate`}
                  className="mt-3 inline-flex items-center justify-center gap-2 bg-[#0f646c] text-white px-5 py-2.5 rounded-lg hover:bg-[#0b5157] transition-colors font-medium w-full"
                >
                  <FaAward aria-hidden="true" /> View certificate
                </Link>
              ) : (
                <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Certificate unlocks after all lessons are completed and all lesson quizzes are passed.
                </p>
              )}
            </aside>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default CourseLessons;
