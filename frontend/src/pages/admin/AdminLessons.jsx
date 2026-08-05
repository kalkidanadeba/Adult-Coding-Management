import React, { useCallback, useEffect, useState } from 'react';
import { FaEdit, FaPlus, FaTrash } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { adminApi } from '../../services/adminApi';
import {
  buildLessonContentFromEditor,
  getLessonEditorFields,
  getLessonVideoUrl,
  normalizeLessonResources,
  serializeLessonUploadedResource,
} from '../../utils/lessonContent';
import CodeEditor from '../../components/ui/CodeEditor';

const formatLessonSaveError = (err) => {
  const data = err?.response?.data;
  const fieldErrorsObject = data?.errors && typeof data.errors === 'object' && !Array.isArray(data.errors) ? data.errors : null;
  const fieldErrorsMessage = fieldErrorsObject
    ? Object.values(fieldErrorsObject)
        .map((e) => e?.message || e?.msg || String(e))
        .filter(Boolean)
        .join(', ')
    : null;
  return (
    data?.message ||
    data?.error ||
    (Array.isArray(data?.errors) ? data.errors.map((e) => e?.message || e?.msg).filter(Boolean).join(', ') : null) ||
    fieldErrorsMessage ||
    (err?.response?.status ? `Request failed (${err.response.status})` : null) ||
    err?.message ||
    'Failed to save lesson'
  );
};

const EMPTY_FORM = {
  course: '',
  title: '',
  description: '',
  durationHours: 1,
  order: 1,
  isPublished: true,
  videoUrl: '',
  resources: '',
  uploadedResources: [],
  textBlock: '',
  listBlock: '',
  codeLanguage: 'js',
  codeBlock: '',
};

const MAX_RESOURCE_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_RESOURCE_FILES = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.m4a,.mp4,.webm';

const formatFileSize = (size) => {
  const value = Number(size);
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error(`Failed to read ${file?.name || 'the selected file'}.`));
    reader.readAsDataURL(file);
  });

const AdminLessons = () => {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [lessons, setLessons] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadingResources, setUploadingResources] = useState(false);

  const loadCourses = useCallback(async () => {
    try {
      const data = await adminApi.getCourses();
      const list = Array.isArray(data) ? data : [];
      setCourses(list);
      if (list[0]?._id) setCourseId((prev) => prev || list[0]._id);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load courses');
    }
  }, []);

  const loadLessons = useCallback(async (selectedCourseId) => {
    if (!selectedCourseId) return;
    setLoading(true);
    try {
      const data = await adminApi.getLessonsByCourse(selectedCourseId);
      setLessons(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load lessons');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    loadLessons(courseId);
  }, [courseId, loadLessons]);

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, course: courseId || '' });
    setEditingId(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!courseId) {
      toast.error('Select a course first.');
      return;
    }
    if (uploadingResources) {
      toast.error('Please wait for the selected files to finish uploading.');
      return;
    }
    if (!form.title.trim()) {
      toast.error('Lesson title is required.');
      return;
    }

    const content = buildLessonContentFromEditor({
      textBlock: form.textBlock,
      listBlock: form.listBlock,
      codeLanguage: form.codeLanguage,
      codeBlock: form.codeBlock,
    });

    if (content.length === 0) {
      const fallback = (form.description.trim() || form.title.trim()).trim();
      content.push({ type: 'text', text: fallback, value: fallback });
    }

    const description = form.description.trim() || form.title.trim();

    const payload = {
      course: courseId,
      courseId,
      title: form.title.trim(),
      description,
      content,
      durationMinutes: Math.round((Number(form.durationHours) || 1) * 60),
      duration: Math.round((Number(form.durationHours) || 1) * 60),
      order: Number(form.order) || 1,
      isPublished: Boolean(form.isPublished),
    };

    const trimmedVideo = form.videoUrl.trim();
    if (trimmedVideo) payload.videoUrl = trimmedVideo;

    const resourceLines = form.resources
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    const uploadedResourceLines = Array.isArray(form.uploadedResources)
      ? form.uploadedResources
          .map((resource) => serializeLessonUploadedResource(resource))
          .filter(Boolean)
      : [];
    const allResources = [...resourceLines, ...uploadedResourceLines];
    if (editingId || allResources.length) payload.resources = allResources;

    const run = async () => {
      try {
        if (editingId) {
          await adminApi.updateLesson(editingId, payload);
          toast.success('Lesson updated.');
        } else {
          await adminApi.createLesson(payload);
          toast.success('Lesson created.');
        }
        await loadLessons(courseId);
        resetForm();
      } catch (err) {
        const errorMessage = formatLessonSaveError(err);
        toast.error(errorMessage);
      }
    };
    run();
  };

  const handleResourceFilesChange = async (event) => {
    const input = event.target;
    const files = Array.from(input.files ?? []);
    input.value = '';

    if (!files.length) return;

    const oversizedFiles = files.filter((file) => Number(file.size) > MAX_RESOURCE_FILE_SIZE);
    if (oversizedFiles.length) {
      toast.error(`Please keep lesson files under ${formatFileSize(MAX_RESOURCE_FILE_SIZE)} each.`);
      return;
    }

    setUploadingResources(true);

    try {
      const nextResources = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          mimeType: file.type || '',
          size: file.size,
          url: await readFileAsDataUrl(file),
        })),
      );

      setForm((prev) => {
        const existing = Array.isArray(prev.uploadedResources) ? prev.uploadedResources : [];
        const merged = [...existing];

        for (const resource of nextResources) {
          const duplicate = merged.some(
            (item) =>
              item?.name === resource.name &&
              item?.size === resource.size &&
              item?.mimeType === resource.mimeType &&
              item?.url === resource.url,
          );

          if (!duplicate) {
            merged.push(resource);
          }
        }

        return { ...prev, uploadedResources: merged };
      });

      toast.success(`${nextResources.length} lesson file${nextResources.length === 1 ? '' : 's'} added.`);
    } catch (err) {
      toast.error(err?.message || 'Failed to read the selected lesson files.');
    } finally {
      setUploadingResources(false);
    }
  };

  const handleEdit = useCallback((lesson) => {
    const editorFields = getLessonEditorFields(lesson);
    const lessonResources = normalizeLessonResources(lesson);
    const externalResourceLinks = lessonResources
      .filter((resource) => resource?.sourceType === 'string')
      .map((resource) => resource.url)
      .join('\n');
    const uploadedResources = lessonResources
      .filter((resource) => resource?.sourceType !== 'string' && resource?.kind === 'file')
      .map((resource) => ({
        name: resource.name,
        mimeType: resource.mimeType,
        size: resource.size,
        url: resource.url,
      }));

    const durationRaw = Number(lesson.durationMinutes ?? lesson.duration ?? lesson.durationHours ?? 60);
    const durationHours = durationRaw > 0 ? durationRaw / 60 : 1;

    const newForm = {
      course: lesson.course || courseId,
      title: lesson.title || lesson.name || '',
      description: lesson.description || lesson.summary || '',
      durationHours,
      order: Number(lesson.order) || 1,
      isPublished: lesson.isPublished !== false,
      videoUrl: getLessonVideoUrl(lesson),
      resources: externalResourceLinks,
      uploadedResources,
      textBlock: editorFields.textBlock,
      listBlock: editorFields.listBlock,
      codeLanguage: editorFields.codeLanguage,
      codeBlock: editorFields.codeBlock,
    };

    setEditingId(lesson._id || lesson.id);
    setForm(newForm);
  }, [courseId]);

  const handleDelete = async (lessonId) => {
    try {
      await adminApi.deleteLesson(lessonId);
      if (editingId === lessonId) resetForm();
      await loadLessons(courseId);
      toast.success('Lesson deleted.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete lesson');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold text-gray-900">Lesson Management</h1>
        <p className="mt-2 text-sm text-gray-600">Add, edit, or remove lessons for each course.</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="input-label">Select course</label>
        <select className="input-field max-w-md" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {courses.map((course) => (
            <option key={course._id || course.id} value={course._id || course.id}>
              {course.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px,1fr]">
        <form key={editingId || 'new'} onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-lg font-extrabold text-gray-900">{editingId ? 'Edit lesson' : 'New lesson'}</h2>

          <div>
            <label className="input-label">Title</label>
            <input
              className="input-field"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <div>
            <label className="input-label">Description</label>
            <textarea
              rows={4}
              className="input-field"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="input-label">Duration (hours)</label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              className="input-field"
              value={form.durationHours}
              onChange={(e) => setForm((prev) => ({ ...prev, durationHours: Number(e.target.value) }))}
              placeholder="e.g. 1, 1.5, 2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Order</label>
              <input
                type="number"
                min={1}
                className="input-field"
                value={form.order}
                onChange={(e) => setForm((prev) => ({ ...prev, order: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="input-label">Publish status</label>
              <select className="input-field" value={form.isPublished ? 'published' : 'draft'} onChange={(e) => setForm((prev) => ({ ...prev, isPublished: e.target.value === 'published' }))}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div>
            <label className="input-label">Video URL (optional)</label>
            <input
              className="input-field"
              value={form.videoUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, videoUrl: e.target.value }))}
            />
          </div>

          

          <div>
            <label className="input-label">Lesson text content</label>
            <textarea
              rows={8}
              className="input-field"
              value={form.textBlock}
              onChange={(e) => setForm((prev) => ({ ...prev, textBlock: e.target.value }))}
              placeholder={'Write paragraphs and bullet lists here.\n\nUse a blank line between paragraphs.\nStart bullets with -, *, or • (one item per line).\nExample:\n- First point\n- Second point'}
            />
            <p className="mt-1 text-sm text-gray-500">
              Lines starting with -, *, •, or 1. are saved and shown as a bullet list for students.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="input-label">Code language</label>
              <input
                className="input-field"
                value={form.codeLanguage}
                onChange={(e) => setForm((prev) => ({ ...prev, codeLanguage: e.target.value }))}
                placeholder="js"
              />
            </div>
            <div className="col-span-2">
              <label className="input-label">Code block (optional)</label>
              <CodeEditor
                value={form.codeBlock}
                onChange={(next) => setForm((prev) => ({ ...prev, codeBlock: next }))}
                language={form.codeLanguage}
                height={220}
              />
            </div>
            <div>
            <label className="input-label" htmlFor="lesson-resource-files">
              Upload lesson files (optional)
            </label>
            <input
              id="lesson-resource-files"
              type="file"
              multiple
              accept={ACCEPTED_RESOURCE_FILES}
              onChange={handleResourceFilesChange}
              className="mt-2 block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
            <p className="mt-2 text-sm text-gray-500">
              Upload PDFs, documents, slides, images, audio, or short videos up to {formatFileSize(MAX_RESOURCE_FILE_SIZE)} each.
            </p>
            {uploadingResources ? <p className="mt-2 text-sm text-primary-700">Preparing selected files...</p> : null}
            {Array.isArray(form.uploadedResources) && form.uploadedResources.length ? (
              <div className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                {form.uploadedResources.map((resource, index) => (
                  <div key={`${resource.name}-${resource.size}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 border border-gray-200">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{resource.name}</p>
                      <p className="text-xs text-gray-500">
                        {[resource.mimeType || 'File', formatFileSize(resource.size)].filter(Boolean).join(' | ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          uploadedResources: (prev.uploadedResources || []).filter((_, resourceIndex) => resourceIndex !== index),
                        }))
                      }
                      className="shrink-0 text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={uploadingResources} className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              <FaPlus />
              {editingId ? 'Update lesson' : 'Add lesson'}
            </button>
            {editingId ? (
              <button type="button" onClick={resetForm} className="btn-outline">
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold text-gray-900">Lessons in selected course</h2>
          {loading ? <p className="mt-3 text-sm text-gray-500">Loading...</p> : null}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2">Title</th>
                  <th className="py-2">Order</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lessons.map((lesson) => (
                  <tr key={lesson._id || lesson.id} className="border-b border-gray-100">
                    <td className="py-3">
                      <p className="font-semibold text-gray-900">{lesson.title}</p>
                      <p className="text-xs text-gray-500">{lesson._id || lesson.id}</p>
                    </td>
                    <td className="py-3 text-gray-700">{lesson.order ?? '-'}</td>
                    <td className="py-3 text-gray-700">{lesson.isPublished === false ? 'Draft' : 'Published'}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(lesson)}
                          className="inline-flex items-center gap-1 text-primary-700 hover:text-primary-800"
                        >
                          <FaEdit /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(lesson._id || lesson.id)}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                        >
                          <FaTrash /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {lessons.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-500">
                      No lessons in this course yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLessons;
