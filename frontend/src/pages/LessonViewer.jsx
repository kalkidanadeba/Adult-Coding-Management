import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { FaArrowLeft, FaCheckCircle, FaChevronLeft, FaChevronRight, FaClipboardList, FaDownload, FaFileAlt, FaLink, FaRegCircle, FaTrophy } from 'react-icons/fa';
import toast from 'react-hot-toast';
import Navbar from '../components/common/Navbar';
import SiteFooter from '../components/common/SiteFooter';
import Button from '../components/ui/Button';
import { studentApi } from '../services/studentApi';
import { withCourseIcon } from '../utils/courseIcons';
import { resolveEnrollmentStatus } from '../utils/enrollment';
import { resolveLessonCompletedState, setLastViewedLesson, setLessonCompleted as persistLessonCompleted } from '../utils/lessonProgress';
import { getEmbeddableVideoUrl, getLessonVideoUrl, isDirectVideoFile, normalizeLessonContent, normalizeLessonResources } from '../utils/lessonContent';
import { resolveAssetUrl } from '../utils/profile';
import { normalizeStudentQuiz } from '../utils/studentContent';

const RunnableCodeBlock = lazy(() => import('../components/ui/RunnableCodeBlock'));

const normalizeCourse = (course, fallbackId) => {
  const id = course?.code ?? course?.id ?? course?._id ?? course?.slug ?? fallbackId;
  return withCourseIcon({
    ...course,
    id: id != null ? String(id) : undefined,
    title: course?.title ?? course?.name ?? '',
    isEnrolled: resolveEnrollmentStatus(course, id),
  });
};

const normalizeLesson = (lesson, courseId) => {
  const id = lesson?.code ?? lesson?.id ?? lesson?._id ?? lesson?.slug ?? lesson?.lessonId ?? lesson?.lesson_id ?? null;
  const normalizedContent = normalizeLessonContent(lesson);
  return {
    ...lesson,
    id: id != null ? String(id) : undefined,
    title: lesson?.title ?? lesson?.name ?? '',
    summary: lesson?.summary ?? lesson?.description ?? '',
    durationMinutes: lesson?.durationMinutes ?? lesson?.duration ?? lesson?.estimated_duration ?? 0,
    order: lesson?.order ?? lesson?.orderIndex ?? lesson?.order_index ?? lesson?.position ?? 0,
    completed: resolveLessonCompletedState(courseId, lesson),
    content: normalizedContent.length ? normalizedContent : null,
    videoUrl: getLessonVideoUrl(lesson),
    resources: normalizeLessonResources(lesson),
  };
};

const formatFileSize = (size) => {
  const value = Number(size);
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const getResourceMetaLabel = (resource) => {
  if (resource?.kind === 'file') {
    return [resource?.mimeType || 'File', formatFileSize(resource?.size)].filter(Boolean).join(' | ');
  }

  try {
    const parsed = new URL(resource?.url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'External resource';
  }
};

const CodeBlockFallback = ({ language }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
    Loading {language || 'code'} editor...
  </div>
);

const LessonViewer = () => {
  const { courseId, lessonId } = useParams();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [lesson, setLesson] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [enrolled, setEnrolled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [savingCompletion, setSavingCompletion] = useState(false);

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

        const normalizedLessons = Array.isArray(lessonsData) ? lessonsData.map((lesson) => normalizeLesson(lesson, courseId)) : [];
        normalizedLessons.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setLessons(normalizedLessons);

        const current = normalizedLessons.find((l) => String(l.id) === String(lessonId)) ?? null;
        setLesson(current);
        setCompleted(Boolean(current?.completed));

        const normalizedQuizzes = Array.isArray(quizzesData) ? quizzesData.map(normalizeStudentQuiz) : [];
        const lessonQuiz = normalizedQuizzes.find((q) => String(q.lessonId) === String(lessonId)) ?? null;
        setQuiz(lessonQuiz);

        if (normalizedCourse && typeof normalizedCourse.isEnrolled === 'boolean') {
          setEnrolled(Boolean(normalizedCourse.isEnrolled));
        }
      } catch (err) {
        if (!active) return;

        if (err?.response?.status === 403) {
          setEnrolled(false);
          setLessons([]);
          setLesson(null);
          setQuiz(null);
        } else {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to load lesson');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    if (courseId) load();
    return () => {
      active = false;
    };
  }, [courseId, lessonId]);

  useEffect(() => {
    if (!courseId || !lessonId) return;
    setLastViewedLesson(courseId, lessonId);
  }, [courseId, lessonId]);

  const index = useMemo(() => lessons.findIndex((l) => String(l.id) === String(lessonId)), [lessons, lessonId]);
  const prevLessonId = index > 0 ? lessons[index - 1]?.id : null;
  const nextLessonId = index >= 0 && index < lessons.length - 1 ? lessons[index + 1]?.id : null;
  const embeddableVideoUrl = getEmbeddableVideoUrl(lesson?.videoUrl);
  const showNativeVideo = isDirectVideoFile(lesson?.videoUrl);

  const StatusIcon = completed ? FaCheckCircle : FaRegCircle;
  const quizPassed = Boolean(quiz?.passed);

  const toggleComplete = async () => {
    if (!courseId || !lessonId) return;
    if (savingCompletion) return;

    const next = !completed;
    setSavingCompletion(true);
    try {
      await studentApi.markLessonCompleted({ courseId, lessonId, completed: next });
      persistLessonCompleted(courseId, lessonId, next);
      setCompleted(next);
      setLesson((prev) => (prev ? { ...prev, completed: next } : prev));
      setLessons((prev) => prev.map((l) => (String(l.id) === String(lessonId) ? { ...l, completed: next } : l)));
      toast.success(next ? 'Lesson marked complete!' : 'Lesson marked as not completed');
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update lesson status');
    } finally {
      setSavingCompletion(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link to={courseId ? `/courses/${courseId}/lessons` : '/courses'} className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700">
            <FaArrowLeft aria-hidden="true" /> Back to lessons
          </Link>

          {course ? (
            <div className="text-sm text-gray-600">
              <Link to={`/courses/${courseId}`} className="hover:text-primary-700">
                {course.title}
              </Link>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-10">
            <p className="text-gray-900 font-bold text-lg">Loading lesson...</p>
            <p className="mt-2 text-gray-600">Please wait a moment.</p>
          </div>
        ) : !course ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-10">
            <p className="text-gray-900 font-bold text-lg">Course not found</p>
            <p className="mt-2 text-gray-600">The course you are looking for may have been moved or removed.</p>
          </div>
        ) : !enrolled ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-10">
            <p className="text-gray-900 font-bold text-lg">Enroll to access lessons</p>
            <p className="mt-2 text-gray-600">You need to enroll in this course before you can view its lessons.</p>
            <Link
              to={`/courses/${courseId}`}
              className="mt-6 inline-flex items-center justify-center bg-primary-500 text-white px-5 py-2.5 rounded-lg hover:bg-primary-600 transition-colors font-medium"
            >
              Go to course details
            </Link>
          </div>
        ) : !lesson ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-10">
            <p className="text-gray-900 font-bold text-lg">Lesson not found</p>
            <p className="mt-2 text-gray-600">The lesson you are looking for may have been moved or removed.</p>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
              <div className="max-w-3xl">
                <div className="flex items-start gap-3">
                  <StatusIcon className={completed ? 'text-primary-600' : 'text-gray-300'} size={20} aria-hidden="true" />
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{lesson.title}</h1>
                    <p className="mt-2 text-gray-600 text-lg leading-relaxed text-justify">{lesson.summary}</p>
                  </div>
                </div>
              </div>

              <div className="w-full sm:max-w-xs rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <p className="text-gray-900 font-bold">Lesson actions</p>
                <p className="mt-2 text-sm text-gray-600">Mark the lesson complete to update your progress.</p>
                <div className="mt-6 space-y-3">
                  <Button variant="primary" fullWidth={true} onClick={toggleComplete} loading={savingCompletion}>
                    {completed ? 'Completed' : 'Mark as complete'}
                  </Button>

                  {quiz ? (
                    <Link
                      to={`/courses/${courseId}/lessons/${lessonId}/quiz`}
                      className="btn-outline text-center block"
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        {quizPassed ? <FaTrophy aria-hidden="true" /> : <FaClipboardList aria-hidden="true" />}
                        {quizPassed ? 'Quiz passed' : 'Take quiz'}
                      </span>
                    </Link>
                  ) : null}
                  {nextLessonId ? (
                    <Link
                      to={`/courses/${courseId}/lessons/${nextLessonId}`}
                      className="btn-outline text-center block"
                    >
                      Next lesson
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-10 space-y-6">
              {lesson.videoUrl ? (
                <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-extrabold text-gray-900">Lesson video</h2>
                      <p className="text-sm text-gray-600">Watch the walkthrough or open the source video in a new tab.</p>
                    </div>
                    <a
                      href={lesson.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-primary-600 hover:text-primary-700 break-all"
                    >
                      {lesson.videoUrl}
                    </a>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-black">
                    {showNativeVideo ? (
                      <video controls className="aspect-video w-full" src={lesson.videoUrl}>
                        Your browser does not support the video tag.
                      </video>
                    ) : embeddableVideoUrl ? (
                      <iframe
                        title={`${lesson.title} video`}
                        src={embeddableVideoUrl}
                        className="aspect-video w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    ) : (
                      <div className="flex aspect-video items-center justify-center px-6 text-center text-sm text-gray-200">
                        This video link cannot be embedded here, but the link above is ready to open.
                      </div>
                    )}
                  </div>
                </section>
              ) : null}

              

              {Array.isArray(lesson.content) && lesson.content.length ? (
                lesson.content.map((block, idx) => {
                  if (block?.type === 'text') {
                    const textBody = block.text ?? block.value;
                    return (
                      <p key={idx} className="text-gray-700 leading-relaxed whitespace-pre-line text-justify">
                        {textBody}
                      </p>
                    );
                  }

                  if (block?.type === 'list') {
                    const rows = Array.isArray(block.items) ? block.items : Array.isArray(block.value) ? block.value : [];
                    return (
                      <ul key={idx} className="list-disc pl-6 space-y-2 text-gray-700">
                        {rows.map((item, itemIndex) => (
                          <li key={`${idx}-${itemIndex}`} className="text-justify">
                            {item}
                          </li>
                        ))}
                      </ul>
                    );
                  }

                  if (block?.type === 'code') {
                    const snippet = block.code ?? block.value;
                    return (
                      <Motion.div key={`${lessonId}-${idx}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <Suspense fallback={<CodeBlockFallback language={block.language || 'js'} />}>
                          <RunnableCodeBlock language={block.language || 'js'} code={snippet || ''} />
                        </Suspense>
                      </Motion.div>
                    );
                  }

                  return null;
                })
              ) : typeof lesson.content === 'string' && lesson.content.trim() ? (
                lesson.content
                  .split(/\n{2,}/g)
                  .map((paragraph, idx) => (
                    <p key={idx} className="text-gray-700 leading-relaxed text-justify">
                      {paragraph}
                    </p>
                  ))
              ) : (
                <p className="text-gray-600">No content available for this lesson yet.</p>
              )}
            </div>
            {Array.isArray(lesson.resources) && lesson.resources.length ? (
                <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div>
                    <h2 className="text-lg font-extrabold text-gray-900">Learning resources</h2>
                    <p className="text-sm text-gray-600">Use these extra files and links to learn from different sources.</p>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {lesson.resources.map((resource, idx) => {
                      const isFileResource = resource?.kind === 'file';
                      const resourceUrl = resolveAssetUrl(resource?.url) || resource?.url;
                      const isPdfResource =
                        resource?.mimeType === 'application/pdf' ||
                        /\.pdf$/i.test(resource?.name || '') ||
                        /\.pdf(?:$|[?#])/i.test(resourceUrl || '');
                      const ResourceIcon = isFileResource ? FaFileAlt : FaLink;

                      return (
                        <a
                          key={resource?.id ?? `${resource?.url}-${idx}`}
                          href={resourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          download={isFileResource && !isPdfResource ? resource?.name || true : undefined}
                          className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-4 transition-colors hover:border-primary-200 hover:bg-primary-50"
                        >
                          <div className="min-w-0 flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary-100 bg-primary-50 text-primary-700">
                              <ResourceIcon aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-gray-900">{resource?.name || `Resource ${idx + 1}`}</p>
                              <p className="truncate text-sm text-gray-600">{getResourceMetaLabel(resource)}</p>
                            </div>
                          </div>

                          <span className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-primary-700">
                            {isFileResource ? <FaDownload aria-hidden="true" /> : <FaLink aria-hidden="true" />}
                            {isFileResource ? (isPdfResource ? 'View' : 'Download') : 'Open'}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </section>
              ) : null}

            <div className="mt-10 flex items-center justify-between gap-4 flex-wrap">
              {prevLessonId ? (
                <Link
                  to={`/courses/${courseId}/lessons/${prevLessonId}`}
                  className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                >
                  <FaChevronLeft aria-hidden="true" /> Previous
                </Link>
              ) : (
                <span />
              )}

              {nextLessonId ? (
                <Link
                  to={`/courses/${courseId}/lessons/${nextLessonId}`}
                  className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                >
                  Next <FaChevronRight aria-hidden="true" />
                </Link>
              ) : (
                <span className="text-sm text-gray-600">You reached the last lesson.</span>
              )}
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default LessonViewer;
