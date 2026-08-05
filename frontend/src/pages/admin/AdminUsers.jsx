import React, { useCallback, useEffect, useState } from 'react';
import { FaChartLine, FaUserCheck, FaUserSlash } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { adminApi } from '../../services/adminApi';

const mapApiUser = (row) => ({
  id: row.id ?? row._id,
  name: row.name,
  email: row.email,
  role: row.role,
  status: row.status ?? (row.isActive ? 'active' : 'inactive'),
  progress: typeof row.progress === 'number' ? row.progress : 0,
});

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await adminApi.getUsers();
      const mapped = (Array.isArray(list) ? list : []).map(mapApiUser);
      setUsers(mapped);
      if (mapped.length === 0) {
        setLoadError('No users returned from the backend.');
      }
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load users';
      setLoadError(msg);
      toast.error(msg);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const toggleStatus = async (userId) => {
    const user = users.find((u) => u.id === userId);
    if (!user || user.role === 'admin') return;

    const nextActive = user.status !== 'active';
    try {
      await adminApi.updateUser(userId, { isActive: nextActive });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, status: nextActive ? 'active' : 'inactive' }
            : u
        )
      );
      toast.success(nextActive ? 'User activated.' : 'User deactivated.');
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Update failed';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold text-gray-900">User Management</h1>
        <p className="mt-2 text-sm text-gray-600">
          View user accounts and progress overview, and activate/deactivate students.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm overflow-x-auto">
        {loading ? (
          <p className="text-sm text-gray-600">Loading users…</p>
        ) : loadError && users.length === 0 ? (
          <p className="text-sm text-red-600">{loadError}</p>
        ) : null}

        {!loading && users.length > 0 && (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2">User</th>
                <th className="py-2">Role</th>
                <th className="py-2">Status</th>
                <th className="py-2">Progress</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const progressPercent = user.progress ?? 0;
                const active = user.status === 'active';

                return (
                  <tr key={user.id} className="border-b border-gray-100">
                    <td className="py-3">
                      <p className="font-semibold text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </td>
                    <td className="py-3 capitalize text-gray-700">{user.role}</td>
                    <td className="py-3">
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                          active
                            ? 'bg-primary-50 text-primary-700 border-primary-100'
                            : 'bg-red-50 text-red-700 border-red-100'
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="w-36">
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span className="inline-flex items-center gap-1">
                            <FaChartLine className="text-primary-600" /> Completion
                          </span>
                          <span>{user.role === 'admin' ? '—' : `${progressPercent}%`}</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full bg-primary-500"
                            style={{
                              width: `${user.role === 'admin' ? 0 : progressPercent}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      {user.role !== 'admin' ? (
                        <button
                          type="button"
                          onClick={() => toggleStatus(user.id)}
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                            active
                              ? 'border-red-200 text-red-700 hover:bg-red-50'
                              : 'border-primary-200 text-primary-700 hover:bg-primary-50'
                          }`}
                        >
                          {active ? <FaUserSlash /> : <FaUserCheck />}
                          {active ? 'Deactivate' : 'Activate'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500">Protected account</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
