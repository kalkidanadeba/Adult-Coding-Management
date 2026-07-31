import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { FaArrowLeft, FaClipboardList, FaClock, FaQuestionCircle, FaRedo, FaTrophy, FaTimesCircle } from 'react-icons/fa';
import toast from 'react-hot-toast';
import Navbar from '../components/common/Navbar';
import SiteFooter from '../components/common/SiteFooter';
import Button from '../components/ui/Button';
import { studentApi } from '../services/studentApi';
import { withCourseIcon } from '../utils/courseIcons';
import { resolveEnrollmentStatus } from '../utils/enrollment';
import {
  clearQuizTimerSession,
  formatQuizCountdown,
  getQuizTimeLimitSeconds,
  readQuizTimerSession,
  writeQuizTimerSession,
} from '../utils/quizProgress';
import { lessonRefToIdString, normalizeStudentQuiz } from '../utils/studentContent';

const normalizeCourse = (course, fallbackId) => {
  const id = course?.code ?? course?.id ?? course?._id ?? course?.slug ?? fallbackId;
  return withCourseIcon({
    ...course,
    id: id != null ? String(id) : undefined,
    title: course?.title ?? course?.name ?? '',
    isEnrolled: resolveEnrollmentStatus(course, id),
  });
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
  const correctCount = parseNumberLike(attempt?.correctCount) ?? parseNumberLike(attempt?.correct_answers) ?? parseNumberLike(attempt?.correctAnswers) ?? 0;
  const total = parseNumberLike(attempt?.total) ?? parseNumberLike(attempt?.total_questions) ?? parseNumberLike(attempt?.totalQuestions) ?? 0;
  const rawPercent = parseNumberLike(attempt?.percent) ?? parseNumberLike(attempt?.score) ?? parseNumberLike(attempt?.percentage) ?? 0;
  
  // Calculate percentage out of 100 if we have correctCount and total
  const calculatedPercent = total > 0 ? Math.round((correctCount / total) * 100 * 10) / 10 : Math.round(rawPercent * 10) / 10;
  
  return {
    timestamp: attempt?.timestamp ?? attempt?.submitted_at ?? attempt?.submittedAt ?? attempt?.createdAt ?? null,
    percent: calculatedPercent,
    correctCount,
    total,
    answers: attempt?.answers ?? null,
    passed:
      parseBooleanLike(attempt?.passed) ??
      parseBooleanLike(attempt?.isPassed) ??
      parseBooleanLike(attempt?.is_passed) ??
      parseBooleanLike(attempt?.status),
  };
};

const normalizeResultEntry = (entry) => {
  const attempts = Array.isArray(entry?.attempts) ? entry.attempts.map(normalizeAttempt) : Array.isArray(entry?.history) ? entry.history.map(normalizeAttempt) : [];
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
    Math.round(attempts.reduce((max, a) => Math.max(max, a.percent || 0), 0) * 10) / 10;

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

  return {
    attempts,
    bestPercent,
    passed,
    lastAttemptAt,
    passPercent,
  };
};

const asObject = (value) => (value && typeof value === 'object' ? value : {});

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

const getSubmissionAnswers = (value) => {
  const candidates = [
    value,
    value?.data,
    value?.result,
    value?.attempt,
    value?.submission,
    value?.quizResult,
    value?.quiz_result,
    value?.data?.result,
    value?.data?.attempt,
    value?.data?.submission,
  ]
    .map(asObject)
    .filter((candidate) => Object.keys(candidate).length > 0);

  for (const candidate of candidates) {
    if (Array.isArray(candidate.answers)) return candidate.answers;
    if (candidate?.answers && typeof candidate.answers === 'object') return candidate.answers;
  }

  return null;
};

const getQuestionFeedback = (answers, questionId) => {
  if (!answers) return null;
  const normalizedQuestionId = questionId != null ? String(questionId) : '';

  if (Array.isArray(answers)) {
    return answers.find(
      (item) =>
        String(item?.questionId ?? item?.question_id ?? item?.id ?? item?.question) === normalizedQuestionId,
    );
  }

  if (typeof answers === 'object') {
    return (
      answers[normalizedQuestionId] ??
      Object.values(answers).find(
        (item) =>
          String(item?.questionId ?? item?.question_id ?? item?.id ?? item?.question) === normalizedQuestionId,
      ) ??
      null
    );
  }

  return null;
};

const normalizeQuizValue = (value) => {
  if (value == null) return '';
  if (typeof value === 'object') {
    return String(
      value?.value ??
        value?.label ??
        value?.text ??
        value?.optionText ??
        value?.option_text ??
        value?.id ??
        value?.optionId ??
        value,
    );
  }
  return String(value);
};

const getFeedbackCorrectIndex = (feedbackItem, options) => {
  if (!feedbackItem || !Array.isArray(options)) return null;

  const candidateIndex =
    parseNumberLike(feedbackItem?.correctAnswer) ??
    parseNumberLike(feedbackItem?.correct_answer) ??
    parseNumberLike(feedbackItem?.correctAnswerIndex) ??
    parseNumberLike(feedbackItem?.correct_answer_index) ??
    parseNumberLike(feedbackItem?.correctOption) ??
    parseNumberLike(feedbackItem?.correct_option) ??
    parseNumberLike(feedbackItem?.correctOptionIndex) ??
    parseNumberLike(feedbackItem?.correct_option_index);

  if (candidateIndex != null && Number.isFinite(candidateIndex) && candidateIndex >= 0 && candidateIndex < options.length) {
    return candidateIndex;
  }

  const normalizedValue = normalizeQuizValue(
    feedbackItem?.correctAnswer ?? feedbackItem?.correct_answer ?? feedbackItem?.correctOption ?? feedbackItem?.correct_option,
  );

  if (normalizedValue) {
    const matchedIndex = options.findIndex(
      (opt) =>
        normalizeQuizValue(opt?.value) === normalizedValue || normalizeQuizValue(opt?.text) === normalizedValue,
    );
    if (matchedIndex >= 0) return matchedIndex;
  }

  return null;
};

const unwrapSubmissionResult = (value) => {
  const candidates = [
    value,
    value?.data,
    value?.result,
    value?.attempt,
    value?.submission,
    value?.quizResult,
    value?.quiz_result,
    value?.data?.result,
    value?.data?.attempt,
    value?.data?.submission,
  ]
    .map(asObject)
    .filter((candidate) => Object.keys(candidate).length > 0);

  const scoreKeys = [
    'passed',
    'isPassed',
    'is_passed',
    'status',
    'percent',
    'percentage',
    'score',
    'correctCount',
    'correct_answers',
    'correctAnswers',
    'total',
    'total_questions',
    'totalQuestions',
    'passPercent',
    'passingScore',
    'passing_score',
  ];

  return (
    candidates.find((candidate) => scoreKeys.some((key) => candidate[key] !== undefined && candidate[key] !== null)) ??
    asObject(value)
  );
};

const buildQuizSubmissionPayload = (quiz, answers) => {
  const answersForApi = {};
  const answerEntries = [];
  let answeredCount = 0;

  for (const [index, question] of (quiz?.questions ?? []).entries()) {
    const questionId = question?.id ?? String(index);
    const selected = answers[questionId];
    const hasAnswer = selected !== undefined && selected !== null;

    if (hasAnswer) {
      answeredCount += 1;
      answersForApi[questionId] = selected;
      answerEntries.push({
        questionId,
        answerIndex: selected,
        selectedOption: selected,
        selectedOptionIndex: selected,
        optionIndex: selected,
        answer: selected,
      });
      continue;
    }

    answerEntries.push({
      questionId,
      answerIndex: null,
      selectedOption: null,
      selectedOptionIndex: null,
      optionIndex: null,
      answer: null,
      skipped: true,
    });
  }

  const orderedAnswers = (quiz?.questions ?? []).map((question, index) => {
    const questionId = question?.id ?? String(index);
    const selected = answers[questionId];
    return selected !== undefined && selected !== null ? selected : null;
  });

  return { answersForApi, answerEntries, orderedAnswers, answeredCount };
};

const LessonQuiz = () => {
  const { courseId, lessonId } = useParams();

  const [course, setCourse] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState(true);
  const [progress, setProgress] = useState({ attempts: [], bestPercent: 0, passed: false, lastAttemptAt: null });

  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [attemptKey, setAttemptKey] = useState(0);
  const timedOutRef = useRef(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setEnrolled(true);

      try {
        const [courseData, lessonsData, quizzesData, resultsData] = await Promise.all([
          studentApi.getCourseById(courseId).catch(() => null),
          studentApi.getLessonsByCourse(courseId),
          studentApi.getQuizzesByCourse(courseId),
          studentApi.getMyResults().catch(() => []),
        ]);

        if (!active) return;

        const normalizedCourse = courseData ? normalizeCourse(courseData, courseId) : null;
        setCourse(normalizedCourse);
        if (normalizedCourse && typeof normalizedCourse.isEnrolled === 'boolean') {
          setEnrolled(Boolean(normalizedCourse.isEnrolled));
        }

        const normalizedLessons = Array.isArray(lessonsData) ? lessonsData.map(normalizeLesson) : [];
        setLesson(normalizedLessons.find((l) => String(l.id) === String(lessonId)) ?? null);

        const normalizedQuizzes = Array.isArray(quizzesData) ? quizzesData.map(normalizeStudentQuiz) : [];
        setQuiz(
          normalizedQuizzes.find((q) => String(q.lessonId) === String(lessonId)) ??
            normalizedQuizzes.find((q) => String(q.id) === String(lessonId)) ??
            null
        );

        const matchingResult =
          Array.isArray(resultsData)
            ? resultsData.find((row) => {
                const rowCourseId = lessonRefToIdString(row?.courseId ?? row?.course_id ?? row?.course);
                const rowLessonId = lessonRefToIdString(row?.lessonId ?? row?.lesson_id ?? row?.lesson);
                return String(rowCourseId ?? '') === String(courseId) && String(rowLessonId ?? '') === String(lessonId);
              })
            : null;
        setProgress(matchingResult ? normalizeResultEntry(matchingResult) : { attempts: [], bestPercent: 0, passed: false, lastAttemptAt: null });
      } catch (err) {
        if (!active) return;

        if (err?.response?.status === 403) {
          setEnrolled(false);
          setCourse(null);
          setLesson(null);
          setQuiz(null);
          setProgress({ attempts: [], bestPercent: 0, passed: false, lastAttemptAt: null });
        } else {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to load quiz');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    if (courseId && lessonId) load();
    return () => {
      active = false;
    };
  }, [courseId, lessonId]);

  const questionCount = quiz?.questions?.length || 0;
  const timeLimitSeconds = useMemo(() => (quiz ? getQuizTimeLimitSeconds(quiz) : null), [quiz]);

  const resetQuiz = () => {
    clearQuizTimerSession(courseId, lessonId);
    timedOutRef.current = false;
    setAnswers({});
    setSubmitted(false);
    setResult(null);
    setSubmitting(false);
    setRemainingSeconds(null);
    setAttemptKey((key) => key + 1);
  };

  useEffect(() => {
    if (!quiz || submitted || !timeLimitSeconds || !courseId || !lessonId) {
      setRemainingSeconds(null);
      return;
    }

    const now = Date.now();
    const stored = readQuizTimerSession(courseId, lessonId);
    let startedAt = now;

    if (stored?.startedAt && stored?.limitSeconds === timeLimitSeconds) {
      startedAt = stored.startedAt;
    } else {
      writeQuizTimerSession(courseId, lessonId, { startedAt: now, limitSeconds: timeLimitSeconds });
    }

    const syncRemaining = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      return Math.max(0, timeLimitSeconds - elapsed);
    };

    setRemainingSeconds(syncRemaining());

    const intervalId = window.setInterval(() => {
      setRemainingSeconds(syncRemaining());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [quiz, submitted, courseId, lessonId, timeLimitSeconds, attemptKey]);

  const isComplete = useMemo(() => {
    if (!quiz?.questions?.length) return false;
    return quiz.questions.every((q, idx) => {
      const questionId = q?.id ?? String(idx);
      return answers[questionId] !== undefined && answers[questionId] !== null;
    });
  }, [quiz, answers]);

  const handleSelect = (questionId, optionIndex) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = useCallback(async ({ force = false } = {}) => {
    if (!quiz) return;
    if (!quiz.questions?.length) return;
    if (submitted) return;
    if (!force && !isComplete) {
      toast.error('Please answer all questions before submitting.', {
        style: { background: '#ef4444', color: '#fff' },
      });
      return;
    }
    if (submitting) return;

    const { answersForApi, answerEntries, orderedAnswers, answeredCount } = buildQuizSubmissionPayload(quiz, answers);
    const passPercent = typeof quiz.passPercent === 'number' ? quiz.passPercent : 60;
    const total = quiz.questions.length;
    const hasAnswerKeys = quiz.questions.every((q) => typeof q?.answerIndex === 'number');

    const gradeLocally = () => {
      let correctCount = 0;
      if (hasAnswerKeys) {
        for (const [index, q] of quiz.questions.entries()) {
          const questionId = q?.id ?? String(index);
          const selected = answers[questionId];
          if (selected === q.answerIndex) correctCount += 1;
        }
      }
      const percent = total ? Math.round((correctCount / total) * 100) : 0;
      return { correctCount, percent, passed: percent >= passPercent };
    };

    const applyAttemptResult = ({
      correctCount,
      totalQuestions,
      percent,
      passed,
      server = null,
      timedOut = false,
      submissionAnswers = null,
    }) => {
      const attemptForUI = {
        timestamp: new Date().toISOString(),
        percent,
        correctCount,
        total: totalQuestions,
        answers,
        timedOut,
      };

      setProgress((prev) => {
        const attempts = [...(prev.attempts || []), attemptForUI].slice(-20);
        const bestPercent = Math.max(prev.bestPercent || 0, percent || 0);
        return {
          attempts,
          bestPercent,
          passed: Boolean(prev.passed || passed || bestPercent >= passPercent),
          lastAttemptAt: attemptForUI.timestamp,
        };
      });

      setResult({
        correctCount,
        total: totalQuestions,
        percent,
        passPercent,
        passed,
        server,
        timedOut,
        answers: submissionAnswers,
      });
      setSubmitted(true);
      clearQuizTimerSession(courseId, lessonId);
      setRemainingSeconds(null);
    };

    setSubmitting(true);

    try {
      if (force && answeredCount === 0) {
        applyAttemptResult({
          correctCount: 0,
          totalQuestions: total,
          percent: 0,
          passed: false,
          timedOut: true,
        });
        toast.error("Time's up. You didn't answer any questions. Reset the quiz to try again.");
        return;
      }

      let serverResult = null;
      let serverError = null;
      const shouldCallServer = answeredCount > 0 && (isComplete || force);

      if (shouldCallServer) {
        try {
          serverResult = await studentApi.submitQuizAttempt({
            courseId,
            lessonId,
            quizId: quiz.id,
            answers: answersForApi,
            orderedAnswers,
            responses: answerEntries,
            answerList: answerEntries,
            submittedAnswers: answerEntries,
            timedOut: force,
            timeExpired: force,
          });
        } catch (err) {
          serverError = err;
        }
      }

      const localGrade = gradeLocally();
      const normalizedServer = serverResult && typeof serverResult === 'object' ? serverResult : null;
      const serverSummary = normalizedServer ? unwrapSubmissionResult(normalizedServer) : null;
      const submissionAnswers = normalizedServer ? getSubmissionAnswers(normalizedServer) : null;
      const serverPercent =
        parseNumberLike(serverSummary?.percent) ??
        parseNumberLike(serverSummary?.percentage) ??
        parseNumberLike(serverSummary?.score) ??
        parseNumberLike(serverSummary?.bestScore);
      const canUseLocalGrade = hasAnswerKeys && (serverError != null || !normalizedServer);
      const finalPercent = serverPercent ?? (canUseLocalGrade ? localGrade.percent : 0);
      const finalCorrect =
        parseNumberLike(serverSummary?.correctCount) ??
        parseNumberLike(serverSummary?.correct_answers) ??
        parseNumberLike(serverSummary?.correctAnswers) ??
        parseNumberLike(serverSummary?.correct) ??
        (canUseLocalGrade ? localGrade.correctCount : 0);
      const finalPass =
        parseNumberLike(serverSummary?.passPercent) ??
        parseNumberLike(serverSummary?.passingScore) ??
        parseNumberLike(serverSummary?.passing_score) ??
        parseNumberLike(serverSummary?.pass_percentage) ??
        passPercent;
      const parsedServerPassed =
        parseBooleanLike(serverSummary?.passed) ??
        parseBooleanLike(serverSummary?.isPassed) ??
        parseBooleanLike(serverSummary?.is_passed) ??
        parseBooleanLike(serverSummary?.status);
      const finalPassed =
        parsedServerPassed ??
        (canUseLocalGrade ? localGrade.passed : serverPercent != null ? serverPercent >= finalPass : false);

      applyAttemptResult({
        correctCount: finalCorrect,
        totalQuestions: total,
        percent: finalPercent,
        passed: finalPassed,
        server: normalizedServer,
        timedOut: force,
        submissionAnswers,
      });

      if (force && serverError && !canUseLocalGrade) {
        toast.error(
          serverError?.response?.data?.message ||
            "Time's up, but your attempt could not be saved. Reset the quiz and try again.",
        );
        return;
      }

      if (force && serverError && canUseLocalGrade) {
        toast("Time's up. Your answers were scored locally.", { icon: '⏱️' });
        return;
      }

      if (force && answeredCount < total) {
        toast("Time's up. Unanswered questions were counted as incorrect.", { icon: '⏱️' });
        return;
      }

      if (serverError && canUseLocalGrade) {
        toast.error(serverError?.response?.data?.message || serverError?.message || 'Could not reach the server. Showing your local score.');
        return;
      }

      if (serverError) {
        toast.error(serverError?.response?.data?.message || serverError?.message || 'Failed to submit quiz. Please try again.');
        return;
      }

      toast.success(finalPassed ? 'Great job! You passed the quiz.' : 'Quiz submitted. Try again to improve your score.');
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to submit quiz. Please try again.', {
        style: { background: '#ef4444', color: '#fff' },
      });
    } finally {
      setSubmitting(false);
    }
  }, [answers, courseId, isComplete, lessonId, quiz, submitted, submitting]);

  useEffect(() => {
    if (remainingSeconds !== 0 || remainingSeconds == null || submitted || submitting || timedOutRef.current) return;

    timedOutRef.current = true;
    void handleSubmit({ force: true });
  }, [remainingSeconds, submitted, submitting, handleSubmit]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link
            to={courseId ? `/courses/${courseId}/lessons/${lessonId}` : '/courses'}
            className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
          >
            <FaArrowLeft aria-hidden="true" /> Back to lesson
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
            <p className="text-gray-900 font-bold text-lg">Loading quiz...</p>
            <p className="mt-2 text-gray-600">Please wait a moment.</p>
          </div>
        ) : !course ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-10">
            <p className="text-gray-900 font-bold text-lg">Course not found</p>
            <p className="mt-2 text-gray-600">The course you are looking for may have been moved or removed.</p>
          </div>
        ) : !lesson ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-10">
            <p className="text-gray-900 font-bold text-lg">Lesson not found</p>
            <p className="mt-2 text-gray-600">The lesson you are looking for may have been moved or removed.</p>
          </div>
        ) : !enrolled ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-10">
            <p className="text-gray-900 font-bold text-lg">Enroll to take the quiz</p>
            <p className="mt-2 text-gray-600">You need to enroll in this course before you can access quizzes.</p>
            <Link
              to={`/courses/${courseId}`}
              className="mt-6 inline-flex items-center justify-center bg-primary-500 text-white px-5 py-2.5 rounded-lg hover:bg-primary-600 transition-colors font-medium"
            >
              Go to course details
            </Link>
          </div>
        ) : !quiz ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-10">
            <p className="text-gray-900 font-bold text-lg">Quiz not available</p>
            <p className="mt-2 text-gray-600">This lesson does not have a quiz yet.</p>
            <Link
              to={`/courses/${courseId}/lessons`}
              className="mt-6 inline-flex items-center justify-center border-2 border-primary-500 text-primary-600 px-5 py-2.5 rounded-lg hover:bg-primary-50 transition-colors font-medium"
            >
              Back to lessons
            </Link>
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
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{quiz.title}</h1>
                    <p className="mt-2 text-gray-600 text-lg leading-relaxed text-justify">
                      Lesson: <span className="font-semibold text-gray-900">{lesson.title}</span>
                    </p>
                    <p className="mt-2 text-sm text-gray-600">
                      Pass score: <span className="font-semibold text-gray-900">{quiz.passPercent ?? 60}%</span> | Questions:{' '}
                      <span className="font-semibold text-gray-900">{questionCount}</span>
                      {quiz.timeLimitMinutes ? (
                        <>
                          {' '}
                          | Time limit: <span className="font-semibold text-gray-900">{quiz.timeLimitMinutes} min</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
              </div>

              {!submitted && remainingSeconds != null ? (
                <div
                  className={`shrink-0 rounded-2xl border px-5 py-4 ${
                    remainingSeconds <= 60 ? 'border-red-200 bg-red-50' : 'border-primary-200 bg-primary-50'
                  }`}
                  aria-live="polite"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <FaClock aria-hidden="true" className={remainingSeconds <= 60 ? 'text-red-600' : 'text-primary-700'} />
                    Time remaining
                  </div>
                  <p className={`mt-1 text-3xl font-extrabold tabular-nums ${remainingSeconds <= 60 ? 'text-red-700' : 'text-primary-800'}`}>
                    {formatQuizCountdown(remainingSeconds)}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-10 space-y-6">
              {quiz.questions.map((q, idx) => {
                const questionId = q?.id ?? String(idx);
                const selected = answers[questionId];
                const showFeedback = submitted;
                const normalizedOptions = Array.isArray(q.options)
                  ? q.options
                  : Array.isArray(q.choices)
                    ? q.choices
                    : [];
                const feedbackItem = getQuestionFeedback(result?.answers, questionId);
                const feedbackCorrectIndex = getFeedbackCorrectIndex(feedbackItem, normalizedOptions);
                const correctAnswerIndex =
                  typeof q?.answerIndex === 'number' ? q.answerIndex : feedbackCorrectIndex;
                const hasAnswerKey = typeof correctAnswerIndex === 'number';
                const isCorrect = hasAnswerKey ? selected === correctAnswerIndex : false;
                const correctAnswerText = hasAnswerKey
                  ? String(normalizedOptions[correctAnswerIndex]?.text ?? normalizedOptions[correctAnswerIndex] ?? '')
                  : feedbackItem?.correctAnswer != null
                    ? String(feedbackItem.correctAnswer)
                    : null;

                return (
                  <Motion.div
                    key={questionId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut', delay: idx * 0.03 }}
                    className="rounded-2xl border border-gray-200 bg-white p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Question {idx + 1}</p>
                        <h2 className="mt-1 text-lg font-extrabold text-gray-900 flex items-center gap-2">
                          <FaQuestionCircle className="text-primary-600" aria-hidden="true" />
                          <span className="text-justify">{q.prompt ?? q.question ?? ''}</span>
                        </h2>
                      </div>

                      {showFeedback && hasAnswerKey ? (
                        <div className="shrink-0 flex items-center gap-2 text-sm font-semibold">
                          {isCorrect ? (
                            <>
                              <FaTrophy className="text-primary-600" aria-hidden="true" />
                              <span className="text-primary-700">Correct</span>
                            </>
                          ) : (
                            <>
                              <FaTimesCircle className="text-red-500" aria-hidden="true" />
                              <span className="text-red-600">Incorrect</span>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-5 grid gap-3">
                      {normalizedOptions.map((opt, optIndex) => {
                        const checked = selected === optIndex;
                        const disabled = submitted;
                        const optionLabel = String(opt?.text ?? opt ?? '');

                        const isCorrectOption = submitted && hasAnswerKey && optIndex === correctAnswerIndex;
                        const isIncorrectSelection = submitted && checked && hasAnswerKey && optIndex !== correctAnswerIndex;
                        const selectedIncorrectOnly = submitted && checked && !hasAnswerKey && feedbackItem?.isCorrect === false;
                        const correctness = isCorrectOption
                          ? 'border-green-500 bg-green-50 ring-1 ring-green-200'
                          : isIncorrectSelection || selectedIncorrectOnly
                            ? 'border-red-500 bg-red-50 ring-1 ring-red-200'
                            : checked
                              ? 'border-primary-200 bg-primary-50'
                              : 'border-gray-200 bg-white';
                        const optionTextColor = isCorrectOption
                          ? 'text-green-900'
                          : isIncorrectSelection || selectedIncorrectOnly
                            ? 'text-red-900'
                            : 'text-gray-800';

                        return (
                          <label
                            key={`${questionId}-${optIndex}`}
                            className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${correctness} ${
                              disabled ? 'cursor-not-allowed opacity-90' : 'hover:border-primary-200'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`q-${questionId}`}
                              checked={checked}
                              onChange={() => handleSelect(questionId, optIndex)}
                              disabled={disabled}
                              className="mt-1 w-4 h-4 text-primary-500 border-gray-300 focus:ring-primary-300"
                            />
                            <span className={`${optionTextColor} text-sm leading-relaxed text-justify`}>{optionLabel}</span>
                          </label>
                        );
                      })}
                    </div>

                    {submitted && q.explanation ? (
                      <p className="mt-4 text-sm text-gray-600 text-justify">
                        <span className="font-semibold text-gray-900">Explanation: </span>
                        {q.explanation}
                      </p>
                    ) : null}

                    {submitted && hasAnswerKey && !isCorrect && correctAnswerText ? (
                      <p className="mt-3 text-sm text-primary-800 text-justify">
                        <span className="font-semibold text-primary-900">Correct answer: </span>
                        {correctAnswerText}
                      </p>
                    ) : null}
                  </Motion.div>
                );
              })}
            </div>

            <div className="mt-10 w-full sm:max-w-xs rounded-2xl border border-gray-200 bg-gray-50 p-6 mx-auto">
              <p className="text-gray-900 font-bold">Your quiz stats</p>
              <p className="mt-2 text-sm text-gray-600">
                Attempts: <span className="font-semibold text-gray-900">{progress.attempts.length}</span>
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Best score: <span className="font-semibold text-gray-900">{progress.bestPercent}%</span>
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Status:{' '}
                <span className={`font-semibold ${progress.passed ? 'text-primary-700' : 'text-gray-900'}`}>
                  {progress.passed ? 'Passed' : 'Not passed'}
                </span>
              </p>

              <div className="mt-6 space-y-3">
                <Button variant="primary" fullWidth={true} onClick={() => handleSubmit()} loading={submitting} disabled={submitted}>
                  Submit answers
                </Button>
                <button type="button" onClick={resetQuiz} className="btn-outline text-center block w-full">
                  <span className="inline-flex items-center justify-center gap-2">
                    <FaRedo aria-hidden="true" /> Reset
                  </span>
                </button>
              </div>
            </div>

            {submitted && result ? (
              <div className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <p className="text-gray-900 font-extrabold text-lg">Result</p>
                <p className="mt-2 text-gray-700">
                  Score: <span className="font-extrabold text-primary-700">{result.percent}%</span> ({result.correctCount}/
                  {result.total}) | Pass score: <span className="font-semibold">{result.passPercent}%</span>
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  {result.timedOut && result.correctCount === 0 && Object.keys(answers).length === 0
                    ? "Time ran out before any answers were submitted."
                    : result.timedOut
                      ? 'Time ran out before you finished. Unanswered questions were counted as incorrect.'
                      : result.passed
                        ? 'You passed this quiz.'
                        : 'You did not pass yet. Review the explanations and try again.'}
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <button type="button" onClick={resetQuiz} className="btn-outline text-center block w-full sm:w-auto">
                    Try again
                  </button>
                  <Link to={`/results/${courseId}/${lessonId}`} className="btn-outline text-center block w-full sm:w-auto">
                    View result
                  </Link>
                  <Link
                    to={`/courses/${courseId}/lessons`}
                    className="bg-primary-500 text-white px-5 py-3 rounded-lg hover:bg-primary-600 transition-colors font-medium text-center w-full sm:w-auto"
                  >
                    Back to lessons
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default LessonQuiz;
