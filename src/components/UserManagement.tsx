import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  currentLevel?: string;
  createdAt: number;
  lastLogin?: number;
}

type UserRole = 'student' | 'teacher' | 'admin' | 'corporate_admin';

interface UserFormData {
  name: string;
  email: string;
  role: UserRole;
  currentLevel: string;
  password: string;
}

interface UserManagementProps {
  companyId: string;
}

const UserManagement: React.FC<UserManagementProps> = ({ companyId }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Convex queries and mutations
  const employees = useQuery(api.userManagement.getCompanyEmployees, {
    companyId: companyId as Id<"companies">
  });
  const addEmployee = useMutation(api.userManagement.addEmployee);
  const deleteUserMutation = useMutation(api.userManagement.deleteUser);
  const updateUserStatus = useMutation(api.userManagement.updateUserStatus);
  const updateUser = useMutation(api.userManagement.updateUser);

  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    role: 'student',
    currentLevel: 'A1',
    password: '',
  });

  const [errors, setErrors] = useState<Partial<UserFormData>>({});
  const [filter, setFilter] = useState({
    role: 'all',
    status: 'all',
    search: '',
  });



  const validateForm = (isEdit: boolean = false): boolean => {
    const newErrors: Partial<UserFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password is required only when adding new users (not editing)
    if (!isEdit && formData.password) {
      if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm(false)) {
      return;
    }

    setIsProcessing(true);

    try {
      await addEmployee({
        companyId: companyId as Id<"companies">,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        // Only include currentLevel for students
        ...(formData.role === 'student' && { currentLevel: formData.currentLevel }),
        // Include password if provided
        ...(formData.password && { password: formData.password }),
      });

      setFormData({
        name: '',
        email: '',
        role: 'student',
        currentLevel: 'A1',
        password: '',
      });
      setShowAddForm(false);
      setErrors({});
      alert(formData.password
        ? 'User added successfully! They can now log in.'
        : 'User added. They will need to set their password via invitation link.');
    } catch (error) {
      console.error('Error adding user:', error);
      alert(`Failed to add user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      currentLevel: user.currentLevel || 'A1',
      password: '', // Don't show password in edit mode
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingUser || !validateForm(true)) {
      return;
    }

    setIsProcessing(true);

    try {
      await updateUser({
        userId: editingUser._id as Id<"users">,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        ...(formData.role === 'student' && { currentLevel: formData.currentLevel }),
      });

      setShowEditModal(false);
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        role: 'student',
        currentLevel: 'A1',
        password: '',
      });
      setErrors({});
    } catch (error) {
      console.error('Error updating user:', error);
      alert(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
    try {
      await updateUserStatus({
        userId: userId as Id<"users">,
        isActive: !currentStatus,
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      alert(`Failed to update user status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteUserMutation({
        userId: userId as Id<"users">,
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const filteredUsers = (employees || []).filter(user => {
    const matchesRole = filter.role === 'all' || user.role === filter.role;
    const matchesStatus = filter.status === 'all' ||
      (filter.status === 'active' && user.isActive) ||
      (filter.status === 'inactive' && !user.isActive);
    const matchesSearch = filter.search === '' ||
      user.name.toLowerCase().includes(filter.search.toLowerCase()) ||
      user.email.toLowerCase().includes(filter.search.toLowerCase());

    return matchesRole && matchesStatus && matchesSearch;
  });

  const isLoading = employees === undefined;

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
      case 'corporate_admin':
        return 'bg-simmonds-terracotta/20 text-simmonds-terracotta';
      case 'teacher': return 'bg-simmonds-olive/20 text-simmonds-olive';
      case 'student': return 'bg-simmonds-lime/20 text-simmonds-primary';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeColor = (isActive: boolean) => {
    return isActive
      ? 'bg-simmonds-lime/20 text-simmonds-primary'
      : 'bg-simmonds-terracotta/20 text-simmonds-terracotta';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-simmonds-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-600">Manage your team's language training accounts</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-simmonds-primary hover:bg-simmonds-primary/90 text-white px-4 py-2 rounded-md font-medium"
        >
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={filter.search}
              onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Search users..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={filter.role}
              onChange={(e) => setFilter(prev => ({ ...prev, role: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
            >
              <option value="all">All Roles</option>
              <option value="student">Students</option>
              <option value="teacher">Teachers</option>
              <option value="admin">Admins</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filter.status}
              onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Add New User</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-simmonds-primary ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Full name"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-simmonds-primary ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="email@company.com"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Only show level field for students */}
              {formData.role === 'student' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Level</label>
                  <select
                    value={formData.currentLevel}
                    onChange={(e) => setFormData(prev => ({ ...prev, currentLevel: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                  >
                    <option value="A1">A1 - Beginner</option>
                    <option value="A2">A2 - Elementary</option>
                    <option value="B1">B1 - Intermediate</option>
                    <option value="B2">B2 - Upper Intermediate</option>
                    <option value="C1">C1 - Advanced</option>
                    <option value="C2">C2 - Proficient</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                  <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-simmonds-primary ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Min. 6 characters"
                />
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                <p className="mt-1 text-xs text-gray-500">
                  If left empty, user will receive an invitation to set their password
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setErrors({});
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  isProcessing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-simmonds-primary hover:bg-simmonds-primary/90'
                }`}
              >
                {isProcessing ? 'Adding...' : 'Add User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Users ({filteredUsers.length})
          </h3>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No users found matching your criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.role === 'student' ? (user.currentLevel || '-') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(user.isActive)}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="text-simmonds-olive hover:text-simmonds-olive/70"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleStatusToggle(user._id, user.isActive)}
                        className={`${
                          user.isActive
                            ? 'text-simmonds-terracotta hover:text-simmonds-terracotta/70'
                            : 'text-simmonds-primary hover:text-simmonds-primary/70'
                        }`}
                      >
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user._id, user.name)}
                        className="text-simmonds-terracotta hover:text-simmonds-terracotta/70"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Edit User</h3>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-simmonds-primary ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-simmonds-primary ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                  <option value="corporate_admin">Corporate Admin</option>
                </select>
              </div>

              {formData.role === 'student' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Level</label>
                  <select
                    value={formData.currentLevel}
                    onChange={(e) => setFormData(prev => ({ ...prev, currentLevel: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                  >
                    <option value="A1">A1 - Beginner</option>
                    <option value="A2">A2 - Elementary</option>
                    <option value="B1">B1 - Intermediate</option>
                    <option value="B2">B2 - Upper Intermediate</option>
                    <option value="C1">C1 - Advanced</option>
                    <option value="C2">C2 - Proficient</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                    setErrors({});
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`px-4 py-2 rounded-md text-white font-medium ${
                    isProcessing
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-simmonds-primary hover:bg-simmonds-primary/90'
                  }`}
                >
                  {isProcessing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;