import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { FaArrowLeft, FaChevronRight, FaClock, FaLayerGroup, FaSearch } from 'react-icons/fa';
import toast from 'react-hot-toast';
import Navbar from '../components/common/Navbar';
import SiteFooter from '../components/common/SiteFooter';
import { COURSE_CATEGORIES, COURSE_LEVELS } from '../data/courses';
import { studentApi } from '../services/studentApi';
import { withCourseIcon } from '../utils/courseIcons';
import { formatDurationHoursLabel, getCourseDurationHours } from '../utils/duration';

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
    description: course?.description ?? course?.summary ?? '',
    category: course?.category ?? course?.categoryName ?? 'General',
    level: course?.level ?? course?.difficulty ?? 'Beginner',
    lessons: course?.lessons ?? course?.lessonCount ?? course?.totalLessons ?? 0,
    durationHours: getCourseDurationHours(course),
    tags: Array.isArray(course?.tags) ? course.tags : [],
    outcomes: Array.isArray(course?.outcomes) ? course.outcomes : Array.isArray(course?.learningOutcomes) ? course.learningOutcomes : [],
  });
};

const CourseCatalog = () => {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('All');
  const [category, setCategory] = useState('All');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const data = await studentApi.getCourses();
        if (!active) return;
        const courseList = Array.isArray(data) ? data.map(normalizeCourse).filter((c) => c?.id) : [];
        
        // Load actual lesson counts for each course
        const coursesWithLessonCounts = await Promise.all(
          courseList.map(async (course) => {
            try {
              const lessons = await studentApi.getLessonsByCourse(course.id);
              const lessonCount = Array.isArray(lessons) ? lessons.length : 0;
              
              return {
                ...course,
                lessons: lessonCount,
                durationHours: getCourseDurationHours(course, lessons),
              };
            } catch {
              // If lesson loading fails, use original course data
              return course;
            }
          })
        );
        
        if (active) setCourses(coursesWithLessonCounts);
      } catch (err) {
        if (!active) return;
        setCourses([]);
        toast.error(err?.response?.data?.message || err?.message || 'Failed to load courses');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return courses.filter((course) => {
      const matchesLevel = level === 'All' || course.level === level;
      const matchesCategory = category === 'All' || course.category === category;

      const searchable = [
        course.title,
        course.description,
        course.category,
        course.level,
        ...(Array.isArray(course.tags) ? course.tags : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);

      return matchesLevel && matchesCategory && matchesSearch;
    });
  }, [search, level, category, courses]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700">
          <FaArrowLeft aria-hidden="true" /> Back to dashboard
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-3xl">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Course Catalog</h1>
            <p className="mt-3 text-gray-600 text-lg leading-relaxed text-justify">
              Browse the available learning tracks and pick a course that matches your goal and skill level.
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
                  placeholder="Search courses, topics, or tags..."
                  aria-label="Search courses"
                />
              </div>
            </div>

            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="input-field"
              aria-label="Filter by level"
            >
              {COURSE_LEVELS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === 'All' ? 'All levels' : opt}
                </option>
              ))}
            </select>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field"
              aria-label="Filter by category"
            >
              {COURSE_CATEGORIES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === 'All' ? 'All categories' : opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-10 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filteredCourses.length}</span>{' '}
            {filteredCourses.length === 1 ? 'course' : 'courses'}
          </p>
        </div>

        {loading ? (
          <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-10 text-center">
            <p className="text-gray-900 font-bold text-lg">Loading courses...</p>
            <p className="mt-2 text-gray-600">Please wait a moment.</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-10 text-center">
            <p className="text-gray-900 font-bold text-lg">No courses found</p>
            <p className="mt-2 text-gray-600">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <Motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.08 } },
            }}
            className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {filteredCourses.map((course) => (
              <Motion.div
                key={course.id || course._id || course.code}
                variants={{
                  hidden: { opacity: 0, y: 14 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
                }}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.99 }}
                transition={{ type: 'spring', stiffness: 360, damping: 22 }}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-primary-200 hover:shadow-md flex flex-col"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-700">
                    {course?.Icon ? <course.Icon size={22} aria-hidden="true" /> : null}
                  </div>

                  <div className="flex-1">
                    <h3 className="text-lg font-extrabold text-gray-900">{course.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-100">
                        {course.category}
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                        {course.level}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-sm text-gray-600 leading-relaxed text-justify flex-1">{course.description}</p>

                <div className="mt-6 flex items-center justify-between text-xs text-gray-600">
                  <span className="inline-flex items-center gap-1">
                    <FaLayerGroup className="text-primary-600" aria-hidden="true" /> {course.lessons || 0} {(course.lessons || 0) === 1 ? 'lesson' : 'lessons'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FaClock className="text-primary-600" aria-hidden="true" /> {formatDurationHoursLabel(course.durationHours)}
                  </span>
                </div>

                <Link
                  to={`/courses/${course.id}`}
                  className="mt-6 inline-flex items-center justify-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-colors font-medium"
                >
                  View details <FaChevronRight aria-hidden="true" />
                </Link>
              </Motion.div>
            ))}
          </Motion.div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default CourseCatalog;
