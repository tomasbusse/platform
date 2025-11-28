import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import GroupManagement from '../components/GroupManagement';
import UserManagement from '../components/UserManagement';

interface CompanyManagementProps {
  currentUser: any;
}

type ViewMode = 'list' | 'detail' | 'create';

const CompanyManagement: React.FC<CompanyManagementProps> = ({ currentUser }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedCompanyId, setSelectedCompanyId] = useState<Id<"companies"> | null>(null);
  const [showGroupManagement, setShowGroupManagement] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showAddTeacher, setShowAddTeacher] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contactEmail: '',
    contactPhone: '',
    domain: '',
    description: '',
  });

  const [teacherForm, setTeacherForm] = useState({
    name: '',
    email: '',
  });

  // Queries
  const companies = useQuery(api.companies.getAllCompanies);
  const companyDetails = useQuery(
    api.companies.getCompanyDetails,
    selectedCompanyId ? { companyId: selectedCompanyId } : 'skip'
  );
  const companyTeachers = useQuery(
    api.companies.getCompanyTeachers,
    selectedCompanyId ? { companyId: selectedCompanyId } : 'skip'
  );

  // Mutations
  const createCompany = useMutation(api.companies.createCompany);
  const updateCompany = useMutation(api.companies.updateCompany);
  const deleteCompany = useMutation(api.companies.deleteCompany);
  const reactivateCompany = useMutation(api.companies.reactivateCompany);
  const permanentlyDeleteCompany = useMutation(api.companies.permanentlyDeleteCompany);
  const addTeacher = useMutation(api.companies.addTeacher);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCompany(formData);
      setViewMode('list');
      setFormData({
        name: '',
        contactEmail: '',
        contactPhone: '',
        domain: '',
        description: '',
      });
    } catch (error: any) {
      alert(error.message || 'Failed to create company');
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;

    try {
      await updateCompany({
        companyId: selectedCompanyId,
        ...formData,
      });
      setViewMode('detail');
    } catch (error: any) {
      alert(error.message || 'Failed to update company');
    }
  };

  const handleDeleteCompany = async (companyId: Id<"companies">) => {
    if (!confirm('Are you sure you want to deactivate this company? All users and groups will be deactivated.')) {
      return;
    }

    try {
      await deleteCompany({ companyId });
    } catch (error: any) {
      alert(error.message || 'Failed to delete company');
    }
  };

  const handleReactivateCompany = async (companyId: Id<"companies">) => {
    try {
      await reactivateCompany({ companyId });
    } catch (error: any) {
      alert(error.message || 'Failed to reactivate company');
    }
  };

  const handlePermanentlyDeleteCompany = async (companyId: Id<"companies">, companyName: string) => {
    const confirmText = prompt(
      `This will PERMANENTLY DELETE "${companyName}" and ALL its data (users, groups, quizzes).\n\nType the company name to confirm:`
    );

    if (confirmText !== companyName) {
      if (confirmText !== null) {
        alert('Company name did not match. Deletion cancelled.');
      }
      return;
    }

    try {
      const result = await permanentlyDeleteCompany({ companyId });
      alert(`Company deleted. Removed ${result.deletedUsers} users and ${result.deletedGroups} groups.`);
      setSelectedCompanyId(null);
      setViewMode('list');
    } catch (error: any) {
      alert(error.message || 'Failed to permanently delete company');
    }
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;

    try {
      await addTeacher({
        companyId: selectedCompanyId,
        name: teacherForm.name,
        email: teacherForm.email,
      });
      setTeacherForm({ name: '', email: '' });
      setShowAddTeacher(false);
    } catch (error: any) {
      alert(error.message || 'Failed to add teacher');
    }
  };

  const selectCompany = (companyId: Id<"companies">) => {
    setSelectedCompanyId(companyId);
    setViewMode('detail');
  };

  const openEditForm = () => {
    if (companyDetails) {
      setFormData({
        name: companyDetails.name,
        contactEmail: companyDetails.contactEmail,
        contactPhone: companyDetails.contactPhone || '',
        domain: companyDetails.domain || '',
        description: companyDetails.description || '',
      });
      setViewMode('create'); // Reuse create form for editing
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    );
  };

  // Check if user is super-admin
  if (currentUser?.role !== 'admin' && currentUser?.role !== 'corporate_admin') {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h2 className="text-lg font-semibold text-yellow-800">Access Denied</h2>
        <p className="text-yellow-700 mt-2">
          Company management is only available to super-administrators.
        </p>
      </div>
    );
  }

  // Show Group Management for selected company
  if (showGroupManagement && selectedCompanyId) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setShowGroupManagement(false)}
          className="flex items-center gap-2 text-simmonds-primary hover:text-simmonds-primary/80"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Company Details
        </button>
        <GroupManagement companyId={selectedCompanyId} />
      </div>
    );
  }

  // Show User Management for selected company
  if (showUserManagement && selectedCompanyId) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setShowUserManagement(false)}
          className="flex items-center gap-2 text-simmonds-primary hover:text-simmonds-primary/80"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Company Details
        </button>
        <UserManagement companyId={selectedCompanyId} currentUserId={currentUser?._id} />
      </div>
    );
  }

  // List View
  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-simmonds-charcoal">Company Management</h1>
            <p className="text-simmonds-stone mt-1">Manage all companies and their configurations</p>
          </div>
          <button
            onClick={() => {
              setFormData({
                name: '',
                contactEmail: '',
                contactPhone: '',
                domain: '',
                description: '',
              });
              setSelectedCompanyId(null);
              setViewMode('create');
            }}
            className="px-4 py-2 bg-simmonds-primary text-white rounded-lg hover:bg-simmonds-primary/90 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Company
          </button>
        </div>

        {/* Companies List */}
        <div className="bg-white rounded-xl shadow-sm border border-simmonds-cream overflow-hidden">
          {companies === undefined ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-simmonds-primary mx-auto"></div>
              <p className="mt-2 text-simmonds-stone">Loading companies...</p>
            </div>
          ) : companies.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 text-simmonds-stone mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <h3 className="text-lg font-medium text-simmonds-charcoal">No companies yet</h3>
              <p className="text-simmonds-stone mt-1">Create your first company to get started</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-simmonds-cream">
              <thead className="bg-simmonds-cream/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-simmonds-stone uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-simmonds-stone uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-simmonds-stone uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-simmonds-stone uppercase tracking-wider">Stats</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-simmonds-stone uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-simmonds-cream">
                {companies.map((company) => (
                  <tr
                    key={company._id}
                    className="hover:bg-simmonds-cream/30 cursor-pointer"
                    onClick={() => selectCompany(company._id)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-simmonds-charcoal">{company.name}</div>
                      {company.description && (
                        <div className="text-sm text-simmonds-stone truncate max-w-xs">{company.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-simmonds-charcoal">{company.contactEmail}</div>
                      {company.contactPhone && (
                        <div className="text-sm text-simmonds-stone">{company.contactPhone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(company.isActive)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <span className="text-simmonds-stone">Teachers:</span>{' '}
                        <span className="font-medium text-simmonds-charcoal">{company.stats?.teachers || 0}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-simmonds-stone">Students:</span>{' '}
                        <span className="font-medium text-simmonds-charcoal">{company.stats?.students || 0}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-simmonds-stone">Groups:</span>{' '}
                        <span className="font-medium text-simmonds-charcoal">{company.stats?.totalGroups || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!company.isActive) {
                            handleReactivateCompany(company._id);
                          } else {
                            handleDeleteCompany(company._id);
                          }
                        }}
                        className={`text-sm ${
                          !company.isActive
                            ? 'text-green-600 hover:text-green-800'
                            : 'text-red-600 hover:text-red-800'
                        }`}
                      >
                        {!company.isActive ? 'Reactivate' : 'Deactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // Create/Edit Form
  if (viewMode === 'create') {
    const isEditing = selectedCompanyId !== null;

    return (
      <div className="space-y-6">
        <button
          onClick={() => {
            setViewMode(isEditing ? 'detail' : 'list');
          }}
          className="flex items-center gap-2 text-simmonds-primary hover:text-simmonds-primary/80"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-simmonds-cream p-6">
          <h2 className="text-xl font-bold text-simmonds-charcoal mb-6">
            {isEditing ? 'Edit Company' : 'Create New Company'}
          </h2>

          <form onSubmit={isEditing ? handleUpdateCompany : handleCreateCompany} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-lg focus:ring-2 focus:ring-simmonds-primary focus:border-transparent"
                  placeholder="Acme Corporation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
                  Contact Email *
                </label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-lg focus:ring-2 focus:ring-simmonds-primary focus:border-transparent"
                  placeholder="contact@acme.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-lg focus:ring-2 focus:ring-simmonds-primary focus:border-transparent"
                  placeholder="+1 234 567 8900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
                  Domain
                </label>
                <input
                  type="text"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-lg focus:ring-2 focus:ring-simmonds-primary focus:border-transparent"
                  placeholder="acme.com"
                />
              </div>

            </div>

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-lg focus:ring-2 focus:ring-simmonds-primary focus:border-transparent"
                placeholder="Brief description of the company..."
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="px-6 py-2 bg-simmonds-primary text-white rounded-lg hover:bg-simmonds-primary/90"
              >
                {isEditing ? 'Update Company' : 'Create Company'}
              </button>
              <button
                type="button"
                onClick={() => setViewMode(isEditing ? 'detail' : 'list')}
                className="px-6 py-2 border border-simmonds-cream text-simmonds-charcoal rounded-lg hover:bg-simmonds-cream/50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Detail View
  if (viewMode === 'detail' && selectedCompanyId) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => {
            setSelectedCompanyId(null);
            setViewMode('list');
          }}
          className="flex items-center gap-2 text-simmonds-primary hover:text-simmonds-primary/80"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Companies
        </button>

        {companyDetails === undefined ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-simmonds-primary mx-auto"></div>
            <p className="mt-2 text-simmonds-stone">Loading company details...</p>
          </div>
        ) : companyDetails === null ? (
          <div className="p-8 text-center">
            <p className="text-red-600">Company not found</p>
          </div>
        ) : (
          <>
            {/* Company Header */}
            <div className="bg-white rounded-xl shadow-sm border border-simmonds-cream p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-simmonds-charcoal">{companyDetails.name}</h1>
                  <p className="text-simmonds-stone mt-1">{companyDetails.description}</p>
                  <div className="flex gap-2 mt-3">
                    {getStatusBadge(companyDetails.isActive)}
                  </div>
                </div>
                <button
                  onClick={openEditForm}
                  className="px-4 py-2 border border-simmonds-cream text-simmonds-charcoal rounded-lg hover:bg-simmonds-cream/50"
                >
                  Edit Company
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                <div className="p-4 bg-simmonds-cream/30 rounded-lg">
                  <p className="text-sm text-simmonds-stone">Contact Email</p>
                  <p className="font-medium text-simmonds-charcoal">{companyDetails.contactEmail}</p>
                </div>
                <div className="p-4 bg-simmonds-cream/30 rounded-lg">
                  <p className="text-sm text-simmonds-stone">Contact Phone</p>
                  <p className="font-medium text-simmonds-charcoal">{companyDetails.contactPhone || '-'}</p>
                </div>
                <div className="p-4 bg-simmonds-cream/30 rounded-lg">
                  <p className="text-sm text-simmonds-stone">Current Students</p>
                  <p className="font-medium text-simmonds-charcoal">{companyDetails.stats?.students || 0}</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setShowUserManagement(true)}
                className="p-6 bg-white rounded-xl shadow-sm border border-simmonds-cream hover:border-simmonds-primary/50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-simmonds-olive/20 rounded-xl">
                    <svg className="w-6 h-6 text-simmonds-olive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-simmonds-charcoal">Manage Users</h3>
                    <p className="text-sm text-simmonds-stone">Add, edit, or remove users from this company</p>
                    <p className="text-sm text-simmonds-olive mt-1">
                      {companyDetails.stats?.students || 0} students, {companyDetails.stats?.teachers || 0} teachers
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setShowGroupManagement(true)}
                className="p-6 bg-white rounded-xl shadow-sm border border-simmonds-cream hover:border-simmonds-primary/50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-simmonds-primary/10 rounded-xl">
                    <svg className="w-6 h-6 text-simmonds-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-simmonds-charcoal">Manage Groups</h3>
                    <p className="text-sm text-simmonds-stone">Create and manage level groups</p>
                    <p className="text-sm text-simmonds-primary mt-1">
                      {companyDetails.stats?.totalGroups || 0} groups configured
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setShowAddTeacher(true)}
                className="p-6 bg-white rounded-xl shadow-sm border border-simmonds-cream hover:border-simmonds-primary/50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-simmonds-lime/20 rounded-xl">
                    <svg className="w-6 h-6 text-simmonds-lime-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-simmonds-charcoal">Add Teacher</h3>
                    <p className="text-sm text-simmonds-stone">Quick add a new teacher</p>
                    <p className="text-sm text-simmonds-primary mt-1">
                      {companyDetails.stats?.teachers || 0} teachers
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* Add Teacher Modal */}
            {showAddTeacher && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
                  <h3 className="text-lg font-bold text-simmonds-charcoal mb-4">Add Teacher</h3>
                  <form onSubmit={handleAddTeacher} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
                        Teacher Name *
                      </label>
                      <input
                        type="text"
                        value={teacherForm.name}
                        onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-simmonds-cream rounded-lg focus:ring-2 focus:ring-simmonds-primary focus:border-transparent"
                        placeholder="John Smith"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={teacherForm.email}
                        onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-simmonds-cream rounded-lg focus:ring-2 focus:ring-simmonds-primary focus:border-transparent"
                        placeholder="teacher@company.com"
                      />
                    </div>
                    <div className="flex gap-4">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-simmonds-primary text-white rounded-lg hover:bg-simmonds-primary/90"
                      >
                        Add Teacher
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddTeacher(false)}
                        className="px-4 py-2 border border-simmonds-cream text-simmonds-charcoal rounded-lg hover:bg-simmonds-cream/50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Teachers Section */}
            <div className="bg-white rounded-xl shadow-sm border border-simmonds-cream p-6">
              <h2 className="text-lg font-bold text-simmonds-charcoal mb-4">Teachers</h2>
              {companyTeachers === undefined ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-simmonds-primary mx-auto"></div>
                </div>
              ) : companyTeachers.length === 0 ? (
                <p className="text-simmonds-stone text-center py-4">No teachers assigned yet</p>
              ) : (
                <div className="space-y-3">
                  {companyTeachers.map((teacher: any) => (
                    <div key={teacher._id} className="flex items-center justify-between p-4 bg-simmonds-cream/30 rounded-lg">
                      <div>
                        <p className="font-medium text-simmonds-charcoal">{teacher.name}</p>
                        <p className="text-sm text-simmonds-stone">{teacher.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-simmonds-stone">
                          {teacher.groups?.length || 0} group(s)
                        </p>
                        {teacher.groups?.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap justify-end">
                            {teacher.groups.map((group: any) => (
                              <span
                                key={group._id}
                                className="px-2 py-0.5 bg-simmonds-primary/10 text-simmonds-primary text-xs rounded"
                              >
                                {group.name} ({group.level})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Groups Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-simmonds-cream p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-simmonds-charcoal">Groups Summary</h2>
                <button
                  onClick={() => setShowGroupManagement(true)}
                  className="text-sm text-simmonds-primary hover:text-simmonds-primary/80"
                >
                  Manage Groups
                </button>
              </div>
              {companyDetails.groups?.length === 0 ? (
                <p className="text-simmonds-stone text-center py-4">No groups configured yet</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => {
                    const levelGroups = companyDetails.groups?.filter((g: any) => g.level === level && g.isActive) || [];
                    const totalStudents = levelGroups.reduce((sum: number, g: any) => sum + g.currentStudentCount, 0);
                    const totalCapacity = levelGroups.reduce((sum: number, g: any) => sum + g.maxStudents, 0);

                    return (
                      <div key={level} className="p-4 bg-simmonds-cream/30 rounded-lg text-center">
                        <p className="text-lg font-bold text-simmonds-primary">{level}</p>
                        <p className="text-sm text-simmonds-stone">
                          {levelGroups.length} group(s)
                        </p>
                        <p className="text-xs text-simmonds-stone">
                          {totalStudents}/{totalCapacity} students
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
              <h2 className="text-lg font-bold text-red-600 mb-4">Danger Zone</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
                  <div>
                    <p className="font-medium text-simmonds-charcoal">
                      {companyDetails.isActive ? 'Deactivate Company' : 'Reactivate Company'}
                    </p>
                    <p className="text-sm text-simmonds-stone">
                      {companyDetails.isActive
                        ? 'Deactivate this company. All users and groups will be deactivated but data will be preserved.'
                        : 'Reactivate this company. Users and groups will need to be manually reactivated.'}
                    </p>
                  </div>
                  <button
                    onClick={() => companyDetails.isActive
                      ? handleDeleteCompany(selectedCompanyId!)
                      : handleReactivateCompany(selectedCompanyId!)
                    }
                    className={`px-4 py-2 rounded-lg ${
                      companyDetails.isActive
                        ? 'bg-red-100 text-red-600 hover:bg-red-200'
                        : 'bg-green-100 text-green-600 hover:bg-green-200'
                    }`}
                  >
                    {companyDetails.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                  <div>
                    <p className="font-medium text-red-600">Permanently Delete Company</p>
                    <p className="text-sm text-red-500">
                      This will permanently delete the company and ALL associated data (users, groups, quizzes). This action cannot be undone.
                    </p>
                  </div>
                  <button
                    onClick={() => handlePermanentlyDeleteCompany(selectedCompanyId!, companyDetails.name)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Delete Forever
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
};

export default CompanyManagement;
