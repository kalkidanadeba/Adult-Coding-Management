import React, { useEffect, useState } from 'react';
import { FaBook, FaCheckCircle, FaClipboardList, FaListUl, FaUsers } from 'react-icons/fa';
import { adminApi, extractAdminList } from '../../services/adminApi';

const statCards = (stats) => [
  { label: 'Courses', value: stats.courses, icon: FaBook },
  { label: 'Lessons', value: stats.lessons, icon: FaListUl },
  { label: 'Quizzes', value: stats.quizzes, icon: FaClipboardList },
  { label: 'Users', value: stats.users, icon: FaUsers },
];

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    courses: 0,
    lessons: 0,
    quizzes: 0,
    users: 0,
    activeUsers: 0,
  });

  useEffect(() => {
    const load = async () => {
      const defaults = { courses: 0, lessons: 0, quizzes: 0, users: 0, activeUsers: 0 };
      let dash = {};
      try {
        dash = await adminApi.getDashboard();
      } catch (error) {
        // Dashboard route may be missing or return a different shape; use list counts below.
      }

      let fromLists = {};
      try {
        const [coursesRaw, lessons, quizzes, users] = await Promise.all([
          adminApi.getCourses(),
          adminApi.getLessons(),
          adminApi.getQuizzes(),
          adminApi.getUsers().catch(() => []),
        ]);
        const courseList = Array.isArray(coursesRaw) ? coursesRaw : extractAdminList(coursesRaw, ['courses']);
        fromLists = {
          courses: courseList.length,
          lessons: Array.isArray(lessons) ? lessons.length : 0,
          quizzes: Array.isArray(quizzes) ? quizzes.length : 0,
          users: Array.isArray(users) ? users.length : 0,
        };
      } catch (error) {
        // If list endpoints fail, keep dashboard-only or default values.
      }

      setStats({
        courses: dash.courses !== undefined ? dash.courses : fromLists.courses ?? defaults.courses,
        lessons: dash.lessons !== undefined ? dash.lessons : fromLists.lessons ?? defaults.lessons,
        quizzes: dash.quizzes !== undefined ? dash.quizzes : fromLists.quizzes ?? defaults.quizzes,
        users: dash.users !== undefined ? dash.users : fromLists.users ?? defaults.users,
        activeUsers: dash.activeUsers !== undefined ? dash.activeUsers : defaults.activeUsers,
      });
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage courses, lessons, quizzes, and learners according to the ACLMS SRS.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards(stats).map(({ label, value, icon }) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600">{label}</p>
                <p className="mt-2 text-2xl font-extrabold text-gray-900">{value}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center">
                {React.createElement(icon, { className: 'text-primary-700', 'aria-hidden': true })}
              </div>
            </div>
          </div>
        ))}
      </div>

     
    </div>
  );
};

export default AdminDashboard;
