import React, { useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

interface User {
  _id: string;
  name?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
  currentLevel?: string;
  createdAt?: number;
  lastLogin?: number;
}

type UserRole = 'student' | 'teacher' | 'admin' | 'corporate_admin';

interface UserFormData {
  name: string;
  email: string;
  role: UserRole;
  currentLevel: string;
  password: string;
  sendInvite: boolean;
  quizId?: string;
}

interface UserManagementProps {
  companyId: string;
  currentUserId?: string;
}

const UserManagement: React.FC<UserManagementProps> = ({ companyId, currentUserId }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Convex queries and mutations
  const employees = useQuery(api.userManagement.getCompanyEmployees, {
    companyId: companyId as Id<"companies">
  });
  const company = useQuery(api.userManagement.getCompany, {
    companyId: companyId as Id<"companies">
  });
  const quizzes = useQuery(api.quizzes.getCompanyQuizzes, {
    companyId: companyId as Id<"companies">
  });
  const addEmployee = useMutation(api.userManagement.addEmployee);
  const createCompanyInvitationLink = useMutation(api.companyInvitations.createCompanyInvitationLink);
  const createUserWithInvitation = useMutation(api.userManagement.createUserWithInvitation);
  const resendInvitation = useMutation(api.userManagement.resendInvitation);
  const deleteUserMutation = useMutation(api.userManagement.deleteUser);
  const updateUserStatus = useMutation(api.userManagement.updateUserStatus);
  const updateUser = useMutation(api.userManagement.updateUser);
  const sendInvitationEmail = useAction(api.emailActions.sendInvitationEmail);

  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    role: 'student',
    currentLevel: 'A1',
    password: '',
    sendInvite: true,
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

    // Password validation only when not sending invite
    if (!isEdit && !formData.sendInvite && formData.password) {
      if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
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
    setEmailSent(false);
    setEmailError(null);

    try {
      if (formData.sendInvite) {
        // Create a company invitation link
        const linkResult = await createCompanyInvitationLink({
          companyId: companyId as Id<"companies">,
          role: formData.role,
          ...(formData.quizId && { quizId: formData.quizId as Id<"quizzes"> }),
        });

        setInviteLink(linkResult.url);

        // Try to send email automatically if Resend is configured
        console.log('Company data:', company);
        console.log('Company settings:', company?.settings);
        const resendApiKey = company?.settings?.resendApiKey;
        console.log('Resend API key found:', !!resendApiKey, resendApiKey ? `(${resendApiKey.substring(0, 8)}...)` : '');
        if (resendApiKey) {
          try {
            const emailResult = await sendInvitationEmail({
              apiKey: resendApiKey,
              domain: company?.domain,
              toEmail: formData.email,
              userName: formData.name,
              companyName: company?.name || 'Simmonds Platform',
              inviteUrl: linkResult.url,
              role: formData.role,
            });

            console.log('Email result:', emailResult);
            if (emailResult.success) {
              setEmailSent(true);
            } else {
              setEmailError(emailResult.message);
            }
          } catch (emailErr) {
            console.error('Error sending invitation email:', emailErr);
            setEmailError('Failed to send email. You can still share the link manually.');
          }
        } else {
          console.log('No Resend API key configured, skipping email');
        }

        setShowInviteModal(true);
      }

      setFormData({
        name: '',
        email: '',
        role: 'student',
        currentLevel: 'A1',
        password: '',
        sendInvite: true,
      });
      setShowAddForm(false);
      setErrors({});

      if (!formData.sendInvite) {
        alert('User added successfully! They can now log in.');
      }
    } catch (error) {
      console.error('Error adding user:', error);
      alert(`Failed to add user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResendInvite = async (userId: string, userEmail?: string, userName?: string) => {
    if (!currentUserId) return;

    setIsProcessing(true);
    setEmailSent(false);
    setEmailError(null);

    try {
      const result = await resendInvitation({
        userId: userId as Id<"users">,
        resendBy: currentUserId as Id<"users">,
      });

      // Generate sign-up link - user will sign up through Clerk
      const baseUrl = 'https://app.simmonds.online';
      const signUpLink = `${baseUrl}`;
      setInviteLink(signUpLink);

      // Try to send email automatically if Resend is configured
      const resendApiKey = company?.settings?.resendApiKey;
      if (resendApiKey && userEmail && userName) {
        try {
          // Get user role from employees list
          const user = employees?.find(e => e._id === userId);
          const emailResult = await sendInvitationEmail({
            apiKey: resendApiKey,
            domain: company?.domain,
            toEmail: userEmail,
            userName: userName,
            companyName: company?.name || 'Simmonds Platform',
            inviteUrl: signUpLink,
            role: user?.role || 'student',
          });

          if (emailResult.success) {
            setEmailSent(true);
          } else {
            setEmailError(emailResult.message);
          }
        } catch (emailErr) {
          console.error('Error sending invitation email:', emailErr);
          setEmailError('Failed to send email. You can still share the link manually.');
        }
      }

      setShowInviteModal(true);
    } catch (error) {
      console.error('Error resending invitation:', error);
      alert(`Failed to resend invitation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      alert('Invite link copied to clipboard!');
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = inviteLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Invite link copied to clipboard!');
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      role: (user.role as UserRole) || 'student',
      currentLevel: user.currentLevel || 'A1',
      password: '',
      sendInvite: false,
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
        sendInvite: true,
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
      (user.name?.toLowerCase() || '').includes(filter.search.toLowerCase()) ||
      (user.email?.toLowerCase() || '').includes(filter.search.toLowerCase());

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
          className="bg-simmonds-primary hover:bg-simmonds-primary/90 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
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
            </div>

            {/* Invitation Option */}
            <div className="border-t pt-4">
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="sendInvite"
                  checked={formData.sendInvite}
                  onChange={(e) => setFormData(prev => ({ ...prev, sendInvite: e.target.checked, password: '' }))}
                  className="h-4 w-4 text-simmonds-primary focus:ring-simmonds-primary border-gray-300 rounded"
                />
                <label htmlFor="sendInvite" className="ml-2 block text-sm text-gray-700">
                  Send invitation link (user will set their own password)
                </label>
              </div>

              {!formData.sendInvite && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-simmonds-primary ${
                      errors.password ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Min. 8 characters"
                  />
                  {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                </div>
              )}

              {formData.sendInvite && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Send Test with Invitation (Optional)
                  </label>
                  <select
                    value={formData.quizId || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, quizId: e.target.value || undefined }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                  >
                    <option value="">No test</option>
                    {quizzes?.map((quiz: any) => (
                      <option key={quiz._id} value={quiz._id}>
                        {quiz.title} ({quiz.level})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    If selected, the user will take this test after signing up. Their performance will determine their level allocation.
                  </p>
                </div>
              )}
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
                {isProcessing ? 'Adding...' : formData.sendInvite ? 'Create & Get Invite Link' : 'Add User'}
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
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role || '')}`}>
                        {user.role || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.role === 'student' ? (user.currentLevel || '-') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(user.isActive ?? false)}`}>
                        {user.isActive ? 'Active' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditUser(user as User)}
                          className="text-simmonds-olive hover:text-simmonds-olive/70"
                          title="Edit user"
                        >
                          Edit
                        </button>
                        {!user.isActive && (
                          <button
                            onClick={() => handleResendInvite(user._id, user.email, user.name)}
                            disabled={isProcessing}
                            className="text-simmonds-primary hover:text-simmonds-primary/70"
                            title="Resend invitation"
                          >
                            Invite
                          </button>
                        )}
                        <button
                          onClick={() => handleStatusToggle(user._id, user.isActive ?? false)}
                          className={`${
                            user.isActive
                              ? 'text-simmonds-terracotta hover:text-simmonds-terracotta/70'
                              : 'text-simmonds-primary hover:text-simmonds-primary/70'
                          }`}
                          title={user.isActive ? 'Deactivate user' : 'Activate user'}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user._id, user.name || 'Unknown')}
                          className="text-simmonds-terracotta hover:text-simmonds-terracotta/70"
                          title="Delete user"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Link Modal */}
      {showInviteModal && inviteLink && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {emailSent ? 'Invitation Sent!' : 'Invitation Link Created'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              {emailSent ? (
                <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-green-800">Email sent successfully!</p>
                    <p className="text-sm text-green-700">The invitation has been sent to the user's email address.</p>
                  </div>
                </div>
              ) : emailError ? (
                <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-amber-800">Couldn't send email</p>
                    <p className="text-sm text-amber-700">{emailError}</p>
                  </div>
                </div>
              ) : !company?.settings?.resendApiKey ? (
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-blue-800">Email not configured</p>
                    <p className="text-sm text-blue-700">Configure Resend in settings to send invitation emails automatically.</p>
                  </div>
                </div>
              ) : null}

              <p className="text-sm text-gray-600">
                {emailSent
                  ? 'The user has been created and can now sign up using this link. They will authenticate through Google or email.'
                  : 'Share this link with the user. They can sign up and authenticate through Google or email.'}
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-mono break-all text-gray-800">{inviteLink}</p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteLink(null);
                    setEmailSent(false);
                    setEmailError(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={copyInviteLink}
                  className="px-4 py-2 bg-simmonds-primary text-white rounded-md hover:bg-simmonds-primary/90 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
