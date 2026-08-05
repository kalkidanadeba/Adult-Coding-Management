import React, { useEffect, useMemo, useState } from 'react';
import { FaEdit, FaPlus, FaTrash } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { COURSE_CATEGORIES, COURSE_LEVELS } from '../../data/courses';
import { adminApi } from '../../services/adminApi';

const EMPTY_FORM = {
  title: '',
  code: '',
  category: 'Frontend',
  level: 'Beginner',
  description: '',
  isActive: true,
};

const AdminCourses = () => {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const filteredCategories = useMemo(() => COURSE_CATEGORIES.filter((item) => item !== 'All'), []);
  const filteredLevels = useMemo(() => COURSE_LEVELS.filter((item) => item !== 'All'), []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const loadCourses = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getCourses();
      const list = Array.isArray(data) ? data : Array.isArray(data?.courses) ? data.courses : [];
      setCourses(list);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.code.trim()) {
      toast.error('Course title and code are required.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      name: form.title.trim(),
      code: form.code.trim(),
      courseCode: form.code.trim(),
      category: form.category,
      level: form.level,
      difficulty: form.level,
      description: form.description.trim(),
      isActive: Boolean(form.isActive),
      isPublished: Boolean(form.isActive),
    };

    try {
      if (editingId) {
        await adminApi.updateCourse(editingId, payload);
        toast.success('Course updated.');
      } else {
        await adminApi.createCourse(payload);
        toast.success('Course created.');
      }
      await loadCourses();
      // Some backends queue writes; quick follow-up refresh helps newly-created items appear.
      setTimeout(() => {
        loadCourses();
      }, 600);
      resetForm();
    } catch (err) {
      const data = err?.response?.data;
      const fieldErrorsObject = data?.errors && typeof data.errors === 'object' && !Array.isArray(data.errors) ? data.errors : null;
      const fieldErrorsMessage = fieldErrorsObject
        ? Object.values(fieldErrorsObject)
            .map((e) => e?.message || e?.msg || String(e))
            .filter(Boolean)
            .join(', ')
        : null;
      const message =
        data?.message ||
        data?.error ||
        (Array.isArray(data?.errors) ? data.errors.map((e) => e?.message || e?.msg).filter(Boolean).join(', ') : null) ||
        fieldErrorsMessage ||
        err?.message ||
        'Failed to save course';
      toast.error(message);
    }
  };

  const handleEdit = (course) => {
    setEditingId(course._id || course.id);
    setForm({
      title: course.title || '',
      code: course.code || course.courseCode || '',
      category: course.category || 'Frontend',
      level: course.level || course.difficulty || 'Beginner',
      description: course.description || '',
      isActive: course.isActive !== false,
    });
  };

  const handleDelete = async (courseId) => {
    try {
      await adminApi.deleteCourse(courseId);
      if (editingId === courseId) resetForm();
      await loadCourses();
      toast.success('Course deleted.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete course');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold text-gray-900">Course Management</h1>
        <p className="mt-2 text-sm text-gray-600">Create, update, and remove course information.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px,1fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-lg font-extrabold text-gray-900">{editingId ? 'Edit course' : 'New course'}</h2>

          <div>
            <label className="input-label">Title</label>
            <input
              className="input-field"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Course title"
            />
          </div>

          <div>
            <label className="input-label">Code</label>
            <input
              className="input-field"
              value={form.code}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
              placeholder="e.g. react-fundamentals"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="input-label">Category</label>
              <select
                className="input-field"
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              >
                {filteredCategories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Level</label>
              <select
                className="input-field"
                value={form.level}
                onChange={(e) => setForm((prev) => ({ ...prev, level: e.target.value }))}
              >
                {filteredLevels.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Status</label>
              <select className="input-field" value={form.isActive ? 'active' : 'inactive'} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value === 'active' }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
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

          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-primary inline-flex items-center justify-center gap-2">
              <FaPlus />
              {editingId ? 'Update course' : 'Create course'}
            </button>
            {editingId ? (
              <button type="button" onClick={resetForm} className="btn-outline">
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold text-gray-900">Existing courses</h2>
          {loading ? <p className="mt-3 text-sm text-gray-500">Loading...</p> : null}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2">Title</th>
                  <th className="py-2">Code</th>
                  <th className="py-2">Category</th>
                  <th className="py-2">Level</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course._id || course.id} className="border-b border-gray-100">
                    <td className="py-3">
                      <p className="font-semibold text-gray-900">{course.title}</p>
                    </td>
                    <td className="py-3 text-gray-700">{course.code || course.courseCode}</td>
                    <td className="py-3 text-gray-700">{course.category}</td>
                    <td className="py-3 text-gray-700">{course.level || course.difficulty || 'Beginner'}</td>
                    <td className="py-3 text-gray-700">{course.isActive === false ? 'Inactive' : 'Active'}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(course)}
                          className="inline-flex items-center gap-1 text-primary-700 hover:text-primary-800"
                        >
                          <FaEdit /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(course._id || course.id)}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                        >
                          <FaTrash /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCourses;
