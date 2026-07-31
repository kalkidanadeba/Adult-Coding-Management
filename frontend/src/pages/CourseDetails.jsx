import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FaArrowLeft, FaClock, FaLayerGroup, FaSignal } from 'react-icons/fa';
import toast from 'react-hot-toast';
import Navbar from '../components/common/Navbar';
import SiteFooter from '../components/common/SiteFooter';
import Button from '../components/ui/Button';
import { studentApi } from '../services/studentApi';
import { withCourseIcon } from '../utils/courseIcons';
import { formatDurationHoursLabel, getCourseDurationHours } from '../utils/duration';
import { resolveEnrollmentStatus } from '../utils/enrollment';

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
    durationHours: getCourseDurationHours(course),
    tags: Array.isArray(course?.tags) ? course.tags : [],
    outcomes: Array.isArray(course?.outcomes) ? course.outcomes : Array.isArray(course?.learningOutcomes) ? course.learningOutcomes : [],
    isEnrolled: resolveEnrollmentStatus(course, id),
  });
};

const getCourseIdentifier = (course, fallbackId) =>
  fallbackId ??
  course?.id ??
  course?._id ??
  course?.courseId ??
  course?.course_id ??
  course?.courseCode ??
  course?.course_code ??
  course?.code ??
  course?.slug ??
  null;

const CourseDetails = () => {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [data, myCourses] = await Promise.all([
          studentApi.getCourseById(courseId),
          studentApi.getMyCourses().catch(() => []),
        ]);
        if (!active) return;

        let normalized = data ? normalizeCourse(data, courseId) : null;

        if (normalized?.id) {
          try {
            const lessons = await studentApi.getLessonsByCourse(normalized.id);
            const lessonCount = Array.isArray(lessons) ? lessons.length : 0;

            normalized = {
              ...normalized,
              lessons: lessonCount,
              durationHours: getCourseDurationHours(normalized, lessons),
            };
          } catch {
            // Keep the original normalized course if lesson fetch fails.
          }
        }

        setCourse(normalized);

        if (typeof normalized?.isEnrolled === 'boolean') {
          setEnrolled(Boolean(normalized.isEnrolled));
          return;
        }

        const enrolledIds = new Set(
          (Array.isArray(myCourses) ? myCourses : [])
            .map((item) => getCourseIdentifier(item))
            .filter(Boolean)
            .map(String),
        );
        const normalizedId = getCourseIdentifier(normalized, courseId);
        setEnrolled(normalizedId != null ? enrolledIds.has(String(normalizedId)) : false);
      } catch (err) {
        if (!active) return;
        setCourse(null);
        setEnrolled(false);
        toast.error(err?.response?.data?.message || err?.message || 'Failed to load course');
      } finally {
        if (active) setLoading(false);
      }
    };

    if (courseId) {
      load();
    } else {
      setCourse(null);
      setEnrolled(false);
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [courseId]);

  const handleEnroll = async () => {
    if (!courseId || enrolling) return;

    setEnrolling(true);

    try {
      await studentApi.enrollInCourse(courseId);
      setEnrolled(true);
      toast.success('Enrolled successfully!');
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to enroll. Please try again.', {
        style: {
          background: '#ef4444',
          color: '#fff',
        },
      });
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/courses" className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700">
          <FaArrowLeft aria-hidden="true" /> Back to catalog
        </Link>

        {!course ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-10">
            <h1 className="text-2xl font-extrabold text-gray-900">{loading ? 'Loading course...' : 'Course not found'}</h1>
            <p className="mt-3 text-gray-600">
              {loading ? 'Please wait a moment.' : 'The course you are looking for may have been moved or removed.'}
            </p>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
              <div className="max-w-2xl">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-14 h-14 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-700">
                    <course.Icon size={26} aria-hidden="true" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-extrabold text-gray-900">{course.title}</h1>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-100">
                        {course.category}
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                        {course.level}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-6 text-gray-600 text-lg leading-relaxed text-justify">{course.description}</p>

                <div className="mt-8 grid gap-3 sm:grid-cols-3 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <FaLayerGroup className="text-primary-600" aria-hidden="true" />
                    <span>
                      <span className="font-semibold">{course.lessons}</span> {course.lessons === 1 ? 'lesson' : 'lessons'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaClock className="text-primary-600" aria-hidden="true" />
                    <span>
                      <span className="font-semibold">{formatDurationHoursLabel(course.durationHours)}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaSignal className="text-primary-600" aria-hidden="true" />
                    <span className="font-semibold">{course.level}</span>
                  </div>
                </div>
              </div>

              <div className="w-full sm:max-w-xs rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <p className="text-gray-900 font-bold">Ready to start?</p>
                <p className="mt-2 text-gray-600 text-sm leading-relaxed">
                  {enrolled ? 'Open the lessons and continue where you left off.' : 'Enroll to unlock the lessons and start learning.'}
                </p>
                <div className="mt-6">
                  <Button
                    variant="primary"
                    fullWidth={true}
                    onClick={handleEnroll}
                    loading={enrolling}
                    disabled={enrolled}
                  >
                    {enrolled ? 'Enrolled' : 'Enroll now'}
                  </Button>

                  {enrolled ? (
                    <Link to={`/courses/${courseId}/lessons`} className="btn-outline mt-3 text-center block">
                      View lessons
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            {Array.isArray(course.outcomes) && course.outcomes.length ? (
              <div className="mt-10">
                <h2 className="text-xl font-extrabold text-gray-900">What you will learn</h2>
                <ul className="mt-4 space-y-2 text-gray-700">
                  {course.outcomes.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-2 w-2 h-2 rounded-full bg-primary-500 shrink-0" />
                      <span className="text-justify">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default CourseDetails;
