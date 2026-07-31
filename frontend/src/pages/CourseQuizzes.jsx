import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { FaArrowLeft, FaClipboardList, FaTrophy } from 'react-icons/fa';
import toast from 'react-hot-toast';
import Navbar from '../components/common/Navbar';
import SiteFooter from '../components/common/SiteFooter';
import { studentApi } from '../services/studentApi';
import { withCourseIcon } from '../utils/courseIcons';
import { resolveEnrollmentStatus } from '../utils/enrollment';
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
    isEnrolled: resolveEnrollmentStatus(course, id),
  });
};

const normalizeLesson = (lesson) => {
  const id = lesson?.code ?? lesson?.id ?? lesson?._id ?? lesson?.slug ?? lesson?.lessonId ?? lesson?.lesson_id ?? null;
  return { ...lesson, id: id != null ? String(id) : undefined, title: lesson?.title ?? lesson?.name ?? '' };
};

const CourseQuizzes = () => {
  const { courseId } = useParams();

  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setEnrolled(true);

      try {
        const [courseData, lessonsData, quizzesData] = await Promise.all([
          studentApi.getCourseById(courseId).catch(() => null),
          studentApi.getLessonsByCourse(courseId),
          studentApi.getQuizzesByCourse(courseId).catch(() => []),
        ]);

        if (!active) return;

        const normalizedCourse = courseData ? normalizeCourse(courseData, courseId) : null;
        setCourse(normalizedCourse);
        if (normalizedCourse && typeof normalizedCourse.isEnrolled === 'boolean') {
          setEnrolled(Boolean(normalizedCourse.isEnrolled));
        }

        const normalizedLessons = Array.isArray(lessonsData) ? lessonsData.map(normalizeLesson) : [];
        setLessons(normalizedLessons);

        const normalizedQuizzes = Array.isArray(quizzesData) ? quizzesData.map(normalizeStudentQuiz).filter((q) => q?.lessonId) : [];
        setQuizzes(normalizedQuizzes);
      } catch (err) {
        if (!active) return;
        if (err?.response?.status === 403) {
          setEnrolled(false);
          setQuizzes([]);
          setLessons([]);
        } else {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to load quizzes');
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

  const lessonTitleById = useMemo(() => {
    const map = new Map();
    for (const l of lessons) {
      if (l?.id) map.set(String(l.id), l.title || String(l.id));
    }
    return map;
  }, [lessons]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link to={courseId ? `/courses/${courseId}` : '/courses'} className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700">
            <FaArrowLeft aria-hidden="true" /> Back to course
          </Link>
        </div>

        <h1 className="mt-6 text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
          {course?.title ? `${course.title} quizzes` : 'Quizzes'}
        </h1>
        <p className="mt-3 text-gray-600 text-lg leading-relaxed text-justify">
          Take quizzes to test your understanding and track your progress.
        </p>

        {loading ? (
          <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-10">
            <p className="text-gray-900 font-bold text-lg">Loading quizzes...</p>
            <p className="mt-2 text-gray-600">Please wait a moment.</p>
          </div>
        ) : !course ? (
          <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-10">
            <p className="text-gray-900 font-bold text-lg">Course not found</p>
            <p className="mt-2 text-gray-600">The course you are looking for may have been moved or removed.</p>
          </div>
        ) : !enrolled ? (
          <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-10">
            <p className="text-gray-900 font-bold text-lg">Enroll to access quizzes</p>
            <p className="mt-2 text-gray-600">You need to enroll in this course before you can access its quizzes.</p>
            <Link
              to={`/courses/${courseId}`}
              className="mt-6 inline-flex items-center justify-center bg-primary-500 text-white px-5 py-2.5 rounded-lg hover:bg-primary-600 transition-colors font-medium"
            >
              Go to course details
            </Link>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-10">
            <p className="text-gray-900 font-bold text-lg">No quizzes available</p>
            <p className="mt-2 text-gray-600">Quizzes will appear here once they are added.</p>
          </div>
        ) : (
          <Motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
            className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {quizzes.map((q) => {
              const lessonTitle = lessonTitleById.get(String(q.lessonId)) || q.lessonId;
              return (
                <Motion.div
                  key={q.id || `${q.lessonId}-${q.title}`}
                  variants={{
                    hidden: { opacity: 0, y: 14 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
                  }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 22 }}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-primary-200 hover:shadow-md flex flex-col"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-12 h-12 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-700">
                      {q.passed ? <FaTrophy size={20} aria-hidden="true" /> : <FaClipboardList size={20} aria-hidden="true" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-extrabold text-gray-900 truncate">{q.title}</h3>
                      <p className="mt-1 text-sm text-gray-600 truncate">Lesson: {lessonTitle}</p>
                      <p className="mt-2 text-xs text-gray-600">
                        Pass score: <span className="font-semibold text-gray-900">{q.passPercent}%</span> | Questions:{' '}
                        <span className="font-semibold text-gray-900">{q.questionsCount}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3">
                    <Link
                      to={`/courses/${courseId}/lessons/${q.lessonId}/quiz`}
                      className="inline-flex items-center justify-center bg-primary-500 text-white px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-colors font-medium"
                    >
                      {q.passed ? 'Retake quiz' : 'Take quiz'}
                    </Link>
                    <Link
                      to={`/courses/${courseId}/lessons/${q.lessonId}`}
                      className="inline-flex items-center justify-center border-2 border-primary-500 text-primary-600 px-4 py-2.5 rounded-lg hover:bg-primary-50 transition-colors font-medium"
                    >
                      Open lesson
                    </Link>
                  </div>
                </Motion.div>
              );
            })}
          </Motion.div>
        )}
        <SiteFooter />
      </main>
    </div>
  );
};

export default CourseQuizzes;
