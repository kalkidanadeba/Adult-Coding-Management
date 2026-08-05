import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaEdit, FaPlus, FaTrash } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { adminApi } from '../../services/adminApi';

const DEFAULT_OPTIONS_TEXT = 'Option A\nOption B\nOption C\nOption D';

const buildLocalId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const getEntityId = (value) => value?._id ?? value?.id ?? '';

const getQuizLessonId = (quiz) => {
  const lesson = quiz?.lesson;
  if (lesson && typeof lesson === 'object') return String(lesson?._id ?? lesson?.id ?? '');
  return String(quiz?.lessonId ?? quiz?.lesson_id ?? lesson ?? '');
};

const getQuestionPrompt = (question) =>
  question?.questionText ?? question?.question_text ?? question?.prompt ?? question?.question ?? '';

const getQuestionOptions = (question) => {
  if (Array.isArray(question?.options)) return question.options;
  if (Array.isArray(question?.choices)) return question.choices;
  return [];
};

const getQuestionCorrectAnswer = (question) => {
  const rawValue =
    question?.correctAnswer ??
    question?.correct_answer ??
    question?.answerIndex ??
    question?.answer_index ??
    0;
  const numeric = Number(rawValue);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
};

const getQuestionPoints = (question) => {
  const numeric = Number(question?.points);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
};

const createQuestionDraft = (question = {}) => {
  const options = getQuestionOptions(question);

  return {
    clientId: buildLocalId(),
    persistedId: question?._id ?? question?.id ?? question?.questionId ?? question?.question_id ?? null,
    questionText: getQuestionPrompt(question),
    options: options.length ? options.map(String).join('\n') : DEFAULT_OPTIONS_TEXT,
    correctAnswer: getQuestionCorrectAnswer(question),
    points: getQuestionPoints(question),
    explanation: question?.explanation ?? question?.explanationText ?? question?.explanation_text ?? '',
  };
};

const createEmptyForm = () => ({
  title: '',
  description: '',
  passingScore: 70,
  timeLimitMinutes: 15,
  isPublished: true,
  questions: [createQuestionDraft()],
});

const parseOptions = (value) =>
  String(value ?? '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

const AdminQuizzes = () => {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [courseLessons, setCourseLessons] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [form, setForm] = useState(() => createEmptyForm());
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const currentQuiz = useMemo(
    () => quizzes.find((quiz) => getQuizLessonId(quiz) === String(lessonId)),
    [quizzes, lessonId]
  );

  const resetForm = () => {
    setForm(createEmptyForm());
    setEditingId(null);
  };

  const updateFormField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateQuestion = (clientId, field, value) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.clientId === clientId ? { ...question, [field]: value } : question
      ),
    }));
  };

  const addQuestion = () => {
    setForm((prev) => ({
      ...prev,
      questions: [...prev.questions, createQuestionDraft()],
    }));
  };

  const removeQuestion = (clientId) => {
    setForm((prev) => {
      if (prev.questions.length === 1) {
        toast.error('A quiz needs at least one question.');
        return prev;
      }

      return {
        ...prev,
        questions: prev.questions.filter((question) => question.clientId !== clientId),
      };
    });
  };

  const loadCourses = useCallback(async () => {
    try {
      const data = await adminApi.getCourses();
      const list = Array.isArray(data) ? data : [];
      setCourses(list);

      const firstCourseId = getEntityId(list[0]);
      if (firstCourseId) {
        setCourseId((prev) => prev || firstCourseId);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load courses');
    }
  }, []);

  const loadLessonsAndQuizzes = useCallback(async (nextCourseId) => {
    if (!nextCourseId) return;

    setLoading(true);
    try {
      const [lessonsData, quizzesData] = await Promise.all([
        adminApi.getLessonsByCourse(nextCourseId),
        adminApi.getQuizzesByCourse(nextCourseId),
      ]);

      const lessonsList = Array.isArray(lessonsData) ? lessonsData : [];
      setCourseLessons(lessonsList);
      setQuizzes(Array.isArray(quizzesData) ? quizzesData : []);

      const firstLessonId = getEntityId(lessonsList[0]);
      setLessonId((prev) => {
        const hasCurrentLesson = lessonsList.some((lesson) => String(getEntityId(lesson)) === String(prev));
        return hasCurrentLesson ? prev : firstLessonId;
      });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    loadLessonsAndQuizzes(courseId);
  }, [courseId, loadLessonsAndQuizzes]);

  const handleCourseChange = async (nextCourseId) => {
    setCourseId(nextCourseId);
    setLessonId('');
    resetForm();
    await loadLessonsAndQuizzes(nextCourseId);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!courseId || !lessonId) {
      toast.error('Select course and lesson.');
      return;
    }

    if (!form.title.trim()) {
      toast.error('Quiz title is required.');
      return;
    }

    const preparedQuestions = form.questions.map((question, index) => {
      const options = parseOptions(question.options);
      return { question, options, index };
    });

    const invalidQuestion = preparedQuestions.find(
      ({ question, options }) => !question.questionText.trim() || options.length < 2
    );

    if (invalidQuestion) {
      toast.error(`Question ${invalidQuestion.index + 1} needs a prompt and at least 2 options.`);
      return;
    }

    const payload = {
      course: courseId,
      lesson: lessonId || undefined,
      lessonId: lessonId || undefined,
      title: form.title.trim(),
      description: form.description.trim(),
      passingScore: Number(form.passingScore) || 70,
      timeLimitMinutes: Number(form.timeLimitMinutes) || 15,
      isPublished: Boolean(form.isPublished),
      questions: preparedQuestions.map(({ question, options }) => ({
        ...(question.persistedId ? { _id: question.persistedId } : {}),
        questionText: question.questionText.trim(),
        options,
        correctAnswer: Math.min(Math.max(Number(question.correctAnswer) || 0, 0), options.length - 1),
        points: Math.max(1, Number(question.points) || 1),
        explanation: question.explanation.trim(),
      })),
    };

    try {
      if (editingId) {
        await adminApi.updateQuiz(editingId, payload);
        toast.success('Quiz updated.');
      } else {
        await adminApi.createQuiz(payload);
        toast.success('Quiz created.');
      }

      await loadLessonsAndQuizzes(courseId);
      resetForm();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save quiz');
    }
  };

  const populateFromCurrent = () => {
    if (!currentQuiz) return;

    const questions = Array.isArray(currentQuiz.questions) && currentQuiz.questions.length
      ? currentQuiz.questions.map((question) => createQuestionDraft(question))
      : [createQuestionDraft()];

    setEditingId(currentQuiz._id || currentQuiz.id);
    setForm({
      title: currentQuiz.title || '',
      description: currentQuiz.description || '',
      passingScore: currentQuiz.passingScore || 70,
      timeLimitMinutes: currentQuiz.timeLimitMinutes || 15,
      isPublished: currentQuiz.isPublished !== false,
      questions,
    });
  };

  const handleDelete = async () => {
    if (!currentQuiz) return;

    try {
      await adminApi.deleteQuiz(currentQuiz._id || currentQuiz.id);
      toast.success('Quiz deleted.');
      await loadLessonsAndQuizzes(courseId);
      resetForm();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete quiz');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold text-gray-900">Quiz Management</h1>
        <p className="mt-2 text-sm text-gray-600">Create or update lesson quizzes with multiple questions and correct answers.</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm grid gap-3 sm:grid-cols-2">
        <div>
          <label className="input-label">Course</label>
          <select className="input-field" value={courseId} onChange={(e) => handleCourseChange(e.target.value)}>
            {courses.map((course) => (
              <option key={getEntityId(course)} value={getEntityId(course)}>
                {course.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="input-label">Lesson</label>
          <select className="input-field" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
            {courseLessons.map((lesson) => (
              <option key={getEntityId(lesson)} value={getEntityId(lesson)}>
                {lesson.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr),minmax(320px,0.8fr)]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold text-gray-900">{editingId ? 'Edit quiz' : 'New quiz'}</h2>
            {loading ? <p className="text-sm text-gray-500">Loading...</p> : null}
          </div>

          <div>
            <label className="input-label">Quiz title</label>
            <input
              className="input-field"
              value={form.title}
              onChange={(e) => updateFormField('title', e.target.value)}
            />
          </div>

          <div>
            <label className="input-label">Description</label>
            <textarea
              rows={2}
              className="input-field"
              value={form.description}
              onChange={(e) => updateFormField('description', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="input-label">Passing score</label>
              <input
                type="number"
                min={1}
                max={100}
                className="input-field"
                value={form.passingScore}
                onChange={(e) => updateFormField('passingScore', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="input-label">Time limit (min)</label>
              <input
                type="number"
                min={1}
                className="input-field"
                value={form.timeLimitMinutes}
                onChange={(e) => updateFormField('timeLimitMinutes', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="input-label">Status</label>
              <select
                className="input-field"
                value={form.isPublished ? 'published' : 'draft'}
                onChange={(e) => updateFormField('isPublished', e.target.value === 'published')}
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-gray-900">Questions</h3>
              
            </div>
            <button
              type="button"
              onClick={addQuestion}
              className="inline-flex items-center gap-2 rounded-lg border border-primary-200 px-3 py-2 text-sm text-primary-700 hover:bg-primary-50"
            >
              <FaPlus /> Add question
            </button>
          </div>

          <div className="space-y-4">
            {form.questions.map((question, index) => (
              <div key={question.clientId} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-extrabold text-gray-900">Question {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeQuestion(question.clientId)}
                    disabled={form.questions.length === 1}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FaTrash /> Remove
                  </button>
                </div>

                <div>
                  <label className="input-label">Question prompt</label>
                  <textarea
                    rows={3}
                    className="input-field"
                    value={question.questionText}
                    onChange={(e) => updateQuestion(question.clientId, 'questionText', e.target.value)}
                  />
                </div>

                <div>
                  <label className="input-label">Options (one per line)</label>
                  <textarea
                    rows={5}
                    className="input-field"
                    value={question.options}
                    onChange={(e) => updateQuestion(question.clientId, 'options', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="input-label">Correct option index (0-based)</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field"
                      value={question.correctAnswer}
                      onChange={(e) => updateQuestion(question.clientId, 'correctAnswer', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="input-label">Points</label>
                    <input
                      type="number"
                      min={1}
                      className="input-field"
                      value={question.points}
                      onChange={(e) => updateQuestion(question.clientId, 'points', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-primary inline-flex items-center justify-center gap-2">
              <FaPlus />
              {editingId ? 'Update quiz' : 'Create quiz'}
            </button>
            {editingId ? (
              <button type="button" onClick={resetForm} className="btn-outline">
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold text-gray-900">Current selection</h2>
          {currentQuiz ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="font-semibold text-gray-900">{currentQuiz.title}</p>
                <p className="text-sm text-gray-600">
                  Pass mark: {currentQuiz.passingScore}% | Questions: {Array.isArray(currentQuiz.questions) ? currentQuiz.questions.length : 0}
                </p>
              </div>

              <div className="space-y-3">
                {(Array.isArray(currentQuiz.questions) ? currentQuiz.questions : []).map((question, index) => {
                  const prompt = getQuestionPrompt(question);
                  const options = getQuestionOptions(question);
                  const correctAnswer = getQuestionCorrectAnswer(question);

                  return (
                    <div
                      key={question?._id ?? question?.id ?? index}
                      className="rounded-xl border border-gray-200 p-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Question {index + 1}</p>
                      <p className="mt-2 font-medium text-gray-900">{prompt}</p>
                      <ul className="mt-3 space-y-1 text-sm text-gray-700">
                        {options.map((option, optionIndex) => (
                          <li
                            key={`${question?._id ?? question?.id ?? index}-${optionIndex}`}
                            className={optionIndex === correctAnswer ? 'text-primary-700 font-semibold' : ''}
                          >
                            {optionIndex}. {String(option)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={populateFromCurrent}
                  className="inline-flex items-center gap-2 rounded-lg border border-primary-200 px-3 py-2 text-sm text-primary-700 hover:bg-primary-50"
                >
                  <FaEdit /> Edit quiz
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                >
                  <FaTrash /> Delete quiz
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-600">No quiz assigned to this lesson yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminQuizzes;
