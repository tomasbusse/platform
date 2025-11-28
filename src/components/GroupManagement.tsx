import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';

interface GroupManagementProps {
  currentUser?: User | null;
  company?: Company | null;
  companyId?: Id<"companies">; // Allow passing companyId directly (for CompanyManagement)
}

type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

interface GroupFormData {
  name: string;
  description: string;
  level: Level;
  teacherId: string;
  maxStudents: number;
  scheduleInfo: string;
  autoAssign: boolean;
}

const GroupManagement: React.FC<GroupManagementProps> = ({ currentUser, company, companyId: directCompanyId }) => {
  // Use direct companyId if provided, otherwise use company._id
  const companyId = directCompanyId || (company?._id as Id<"companies"> | undefined);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showAssignUnallocatedModal, setShowAssignUnallocatedModal] = useState(false);
  const [selectedUnallocatedStudent, setSelectedUnallocatedStudent] = useState<any>(null);
  const [selectedGroupIdForAssignment, setSelectedGroupIdForAssignment] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [filterLevel, setFilterLevel] = useState<Level | 'all'>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const [formData, setFormData] = useState<GroupFormData>({
    name: '',
    description: '',
    level: 'A1',
    teacherId: '',
    maxStudents: 20,
    scheduleInfo: '',
    autoAssign: true,
  });

  // Queries
  const groups = useQuery(
    api.groups.getCompanyGroups,
    companyId ? {
      companyId: companyId,
      isActive: true,
      ...(filterLevel !== 'all' && { level: filterLevel }),
    } : 'skip'
  );

  const groupStats = useQuery(
    api.groups.getGroupStats,
    companyId ? { companyId: companyId } : 'skip'
  );

  const groupStudents = useQuery(
    api.groups.getGroupStudents,
    selectedGroup?._id ? { groupId: selectedGroup._id as Id<"groups"> } : 'skip'
  );

  // Get teachers for assignment
  const teachers = useQuery(
    api.userManagement.getCompanyUsers,
    companyId ? { companyId: companyId } : 'skip'
  );

  const teachersList = teachers?.filter(u => u.role === 'teacher' || u.role === 'admin') || [];

  // Get all students for manual assignment
  const allStudents = useQuery(
    api.userManagement.getCompanyUsers,
    companyId ? { companyId: companyId } : 'skip'
  );
  const studentsList = allStudents?.filter(u => u.role === 'student') || [];

  // Get unallocated students (students not in any group)
  const unallocatedStudents = useQuery(
    api.userManagement.getUnallocatedStudents,
    companyId ? { companyId: companyId } : 'skip'
  );

  // Mutations
  const createGroup = useMutation(api.groups.createGroup);
  const updateGroup = useMutation(api.groups.updateGroup);
  const deleteGroup = useMutation(api.groups.deleteGroup);
  const removeStudentFromGroup = useMutation(api.groups.removeStudentFromGroup);
  const addStudentToGroup = useMutation(api.groups.addStudentToGroup);

  const handleCreateGroup = async () => {
    if (!companyId) return;

    setIsProcessing(true);
    try {
      await createGroup({
        companyId: companyId,
        name: formData.name,
        description: formData.description || undefined,
        level: formData.level,
        teacherId: formData.teacherId || undefined,
        maxStudents: formData.maxStudents,
        scheduleInfo: formData.scheduleInfo || undefined,
        autoAssign: formData.autoAssign,
      });

      setShowCreateModal(false);
      resetForm();
      alert('Group created successfully!');
    } catch (error) {
      console.error('Error creating group:', error);
      alert(`Failed to create group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!selectedGroup?._id) return;

    setIsProcessing(true);
    try {
      await updateGroup({
        groupId: selectedGroup._id as Id<"groups">,
        name: formData.name,
        description: formData.description || undefined,
        teacherId: formData.teacherId || undefined,
        maxStudents: formData.maxStudents,
        scheduleInfo: formData.scheduleInfo || undefined,
        autoAssign: formData.autoAssign,
      });

      setShowEditModal(false);
      setSelectedGroup(null);
      resetForm();
      alert('Group updated successfully!');
    } catch (error) {
      console.error('Error updating group:', error);
      alert(`Failed to update group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group?')) return;

    try {
      await deleteGroup({ groupId: groupId as Id<"groups"> });
      alert('Group deleted successfully!');
    } catch (error) {
      console.error('Error deleting group:', error);
      alert(`Failed to delete group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRemoveStudent = async (userId: string) => {
    if (!selectedGroup?._id) return;
    if (!confirm('Remove this student from the group?')) return;

    try {
      await removeStudentFromGroup({
        groupId: selectedGroup._id as Id<"groups">,
        userId,
      });
      alert('Student removed from group');
    } catch (error) {
      console.error('Error removing student:', error);
      alert(`Failed to remove student: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAddStudent = async () => {
    if (!selectedGroup?._id || !selectedStudentId) return;

    setIsProcessing(true);
    try {
      await addStudentToGroup({
        groupId: selectedGroup._id as Id<"groups">,
        userId: selectedStudentId,
      });
      setSelectedStudentId('');
      setShowAddStudentModal(false);
      alert('Student added to group successfully!');
    } catch (error) {
      console.error('Error adding student:', error);
      alert(`Failed to add student: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Get students not already in the selected group
  const getAvailableStudents = () => {
    if (!groupStudents || !studentsList) return studentsList || [];
    const groupStudentIds = new Set(groupStudents.map((s: any) => s._id));
    return studentsList.filter(s => !groupStudentIds.has(s._id));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      level: 'A1',
      teacherId: '',
      maxStudents: 20,
      scheduleInfo: '',
      autoAssign: true,
    });
  };

  const openEditModal = (group: any) => {
    setSelectedGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      level: group.level,
      teacherId: group.teacherId || '',
      maxStudents: group.maxStudents,
      scheduleInfo: group.scheduleInfo || '',
      autoAssign: group.autoAssign,
    });
    setShowEditModal(true);
  };

  const openStudentsModal = (group: any) => {
    setSelectedGroup(group);
    setShowStudentsModal(true);
  };

  // Open the assign modal for an unallocated student
  const openAssignUnallocatedModal = (student: any) => {
    setSelectedUnallocatedStudent(student);
    setSelectedGroupIdForAssignment('');
    setShowAssignUnallocatedModal(true);
  };

  // Assign an unallocated student to a selected group
  const handleAssignUnallocatedStudent = async () => {
    if (!selectedUnallocatedStudent || !selectedGroupIdForAssignment) return;

    setIsProcessing(true);
    try {
      await addStudentToGroup({
        groupId: selectedGroupIdForAssignment as Id<"groups">,
        userId: selectedUnallocatedStudent._id,
      });
      setShowAssignUnallocatedModal(false);
      setSelectedUnallocatedStudent(null);
      setSelectedGroupIdForAssignment('');
      alert('Student assigned to group successfully!');
    } catch (error) {
      console.error('Error assigning student:', error);
      alert(`Failed to assign student: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Get groups that the student could be assigned to (based on level match or any group with capacity)
  const getAvailableGroupsForStudent = (student: any) => {
    if (!groups) return [];
    return groups.filter(g =>
      g.isActive &&
      g.currentStudentCount < g.maxStudents
    );
  };

  const getLevelColor = (level: Level) => {
    const colors: Record<Level, string> = {
      A1: 'bg-green-100 text-green-700 border-green-200',
      A2: 'bg-teal-100 text-teal-700 border-teal-200',
      B1: 'bg-blue-100 text-blue-700 border-blue-200',
      B2: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      C1: 'bg-purple-100 text-purple-700 border-purple-200',
      C2: 'bg-pink-100 text-pink-700 border-pink-200',
    };
    return colors[level] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Total Groups</p>
          <p className="text-2xl font-bold text-simmonds-primary">{groupStats?.totalGroups || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Total Students</p>
          <p className="text-2xl font-bold text-simmonds-olive">{groupStats?.totalStudents || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Auto-Assign Groups</p>
          <p className="text-2xl font-bold text-simmonds-lime-dark">{groupStats?.autoAssignEnabled || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Teachers Assigned</p>
          <p className="text-2xl font-bold text-simmonds-terracotta">
            {groups?.filter(g => g.teacherId).length || 0}
          </p>
        </div>
      </div>

      {/* Level Distribution */}
      {groupStats?.byLevel && Object.keys(groupStats.byLevel).length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
          <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Level Distribution</h3>
          <div className="grid grid-cols-6 gap-4">
            {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => {
              const stats = groupStats.byLevel[level] || { groups: 0, students: 0, capacity: 0 };
              const fillPercentage = stats.capacity > 0 ? (stats.students / stats.capacity) * 100 : 0;

              return (
                <div key={level} className="text-center">
                  <div className={`px-3 py-1 rounded-lg text-sm font-semibold mb-2 ${getLevelColor(level as Level)}`}>
                    {level}
                  </div>
                  <div className="h-24 bg-simmonds-cream rounded-xl relative overflow-hidden">
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-simmonds-primary/60 transition-all"
                      style={{ height: `${fillPercentage}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-lg font-bold text-simmonds-charcoal">{stats.students}</p>
                        <p className="text-xs text-simmonds-stone">/ {stats.capacity}</p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-simmonds-stone">{stats.groups} group{stats.groups !== 1 ? 's' : ''}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value as Level | 'all')}
            className="px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
          >
            <option value="all">All Levels</option>
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
            <option value="C2">C2</option>
          </select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light"
          >
            + Create Group
          </button>
        </div>
      </div>

      {/* Groups List */}
      <div className="bg-white rounded-2xl shadow-sm border border-simmonds-cream overflow-hidden">
        <div className="p-4 border-b border-simmonds-cream">
          <h3 className="text-lg font-semibold text-simmonds-charcoal">Groups</h3>
        </div>

        {!groups || groups.length === 0 ? (
          <div className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-simmonds-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-simmonds-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-simmonds-charcoal mb-2">No groups created yet</h4>
              <p className="text-simmonds-stone mb-6">
                Create groups to organize students by CEFR level. Students can be manually assigned to groups or placed based on their placement test results.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light"
              >
                Create Your First Group
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-simmonds-cream">
            {groups.map((group) => (
              <div
                key={group._id}
                className="p-4 hover:bg-simmonds-cream-light/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-simmonds-charcoal text-lg">{group.name}</h4>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getLevelColor(group.level)}`}>
                        {group.level}
                      </span>
                      {group.autoAssign && (
                        <span className="px-2 py-0.5 bg-simmonds-lime/20 text-simmonds-lime-dark rounded text-xs">
                          Auto-Assign
                        </span>
                      )}
                    </div>

                    {group.description && (
                      <p className="text-sm text-simmonds-stone mb-2">{group.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-simmonds-stone">Students:</span>
                        <span className="font-medium text-simmonds-charcoal">
                          {group.currentStudentCount} / {group.maxStudents}
                        </span>
                        {group.currentStudentCount >= group.maxStudents && (
                          <span className="text-xs text-simmonds-terracotta">(Full)</span>
                        )}
                      </div>

                      {group.teacherId && (
                        <div className="flex items-center gap-1">
                          <span className="text-simmonds-stone">Teacher:</span>
                          <span className="font-medium text-simmonds-charcoal">
                            {teachersList.find(t => t._id === group.teacherId)?.name || 'Unknown'}
                          </span>
                        </div>
                      )}

                      {group.scheduleInfo && (
                        <div className="flex items-center gap-1">
                          <span className="text-simmonds-stone">Schedule:</span>
                          <span className="text-simmonds-charcoal">{group.scheduleInfo}</span>
                        </div>
                      )}
                    </div>

                    {/* Capacity bar */}
                    <div className="mt-3 w-full max-w-xs">
                      <div className="h-2 bg-simmonds-cream rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            group.currentStudentCount >= group.maxStudents
                              ? 'bg-simmonds-terracotta'
                              : group.currentStudentCount >= group.maxStudents * 0.8
                              ? 'bg-yellow-500'
                              : 'bg-simmonds-lime'
                          }`}
                          style={{ width: `${(group.currentStudentCount / group.maxStudents) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => openStudentsModal(group)}
                      className="px-3 py-1 text-sm text-simmonds-primary hover:bg-simmonds-primary/10 rounded-lg"
                    >
                      View Students
                    </button>
                    <button
                      onClick={() => openEditModal(group)}
                      className="px-3 py-1 text-sm text-simmonds-olive hover:bg-simmonds-olive/10 rounded-lg"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group._id)}
                      className="px-3 py-1 text-sm text-simmonds-terracotta hover:bg-simmonds-terracotta/10 rounded-lg"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unallocated Students Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-simmonds-cream overflow-hidden">
        <div className="p-4 border-b border-simmonds-cream flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-simmonds-charcoal">Unallocated Students</h3>
            <p className="text-sm text-simmonds-stone">
              Students in this company not yet assigned to any group
            </p>
          </div>
          <span className="px-3 py-1 bg-simmonds-cream text-simmonds-charcoal rounded-full text-sm font-medium">
            {unallocatedStudents?.length || 0} students
          </span>
        </div>

        {!unallocatedStudents || unallocatedStudents.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-simmonds-lime/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-simmonds-lime-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-simmonds-stone">All students are assigned to groups</p>
          </div>
        ) : (
          <div className="divide-y divide-simmonds-cream">
            {unallocatedStudents.map((student: any) => (
              <div
                key={student._id}
                className="p-4 hover:bg-simmonds-cream-light/50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-simmonds-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-simmonds-primary font-semibold">
                      {student.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-simmonds-charcoal">{student.name || 'Unknown'}</p>
                    <p className="text-sm text-simmonds-stone">{student.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getLevelColor((student.currentLevel as Level) || 'A1')}`}>
                      {student.currentLevel || 'No level'}
                    </span>
                    {student.takesIndividualLessons && (
                      <span className="ml-2 px-2 py-0.5 bg-simmonds-olive/20 text-simmonds-olive rounded text-xs">
                        Individual
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => openAssignUnallocatedModal(student)}
                    className="px-4 py-2 bg-simmonds-primary text-white rounded-xl text-sm font-medium hover:bg-simmonds-primary-light"
                  >
                    Assign to Group
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign Unallocated Student Modal */}
      {showAssignUnallocatedModal && selectedUnallocatedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-simmonds-cream">
              <h3 className="text-lg font-semibold text-simmonds-charcoal">
                Assign Student to Group
              </h3>
              <p className="text-sm text-simmonds-stone mt-1">
                Assign <span className="font-medium">{selectedUnallocatedStudent.name}</span> to a group
              </p>
            </div>

            <div className="p-6">
              {getAvailableGroupsForStudent(selectedUnallocatedStudent).length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-simmonds-stone">No groups available with capacity</p>
                  <p className="text-sm text-simmonds-stone mt-2">
                    Create a new group or increase capacity in existing groups
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                    Select Group
                  </label>
                  <select
                    value={selectedGroupIdForAssignment}
                    onChange={(e) => setSelectedGroupIdForAssignment(e.target.value)}
                    className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                  >
                    <option value="">Choose a group...</option>
                    {getAvailableGroupsForStudent(selectedUnallocatedStudent).map((group) => (
                      <option key={group._id} value={group._id}>
                        {group.name} ({group.level}) - {group.currentStudentCount}/{group.maxStudents} students
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-simmonds-stone">
                    Student's level: <span className="font-medium">{selectedUnallocatedStudent.currentLevel || 'Not set'}</span>.
                    Assigning to a group will update their level to match.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-simmonds-cream flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAssignUnallocatedModal(false);
                  setSelectedUnallocatedStudent(null);
                  setSelectedGroupIdForAssignment('');
                }}
                className="px-6 py-2 border border-simmonds-cream text-simmonds-charcoal rounded-xl font-medium hover:bg-simmonds-cream-light"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignUnallocatedStudent}
                disabled={isProcessing || !selectedGroupIdForAssignment}
                className="px-6 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light disabled:opacity-50"
              >
                {isProcessing ? 'Assigning...' : 'Assign to Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            <div className="p-6 border-b border-simmonds-cream">
              <h3 className="text-lg font-semibold text-simmonds-charcoal">
                {showEditModal ? 'Edit Group' : 'Create New Group'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Group Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                  placeholder="e.g., Morning B1 Class"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-20"
                  placeholder="Describe this group..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Level *</label>
                  <select
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value as Level })}
                    disabled={showEditModal}
                    className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary disabled:bg-gray-100"
                  >
                    <option value="A1">A1 - Beginner</option>
                    <option value="A2">A2 - Elementary</option>
                    <option value="B1">B1 - Intermediate</option>
                    <option value="B2">B2 - Upper Intermediate</option>
                    <option value="C1">C1 - Advanced</option>
                    <option value="C2">C2 - Proficient</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Max Students</label>
                  <input
                    type="number"
                    value={formData.maxStudents}
                    onChange={(e) => setFormData({ ...formData, maxStudents: parseInt(e.target.value) || 20 })}
                    className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                    min="1"
                    max="100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Assign Teacher</label>
                <select
                  value={formData.teacherId}
                  onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                >
                  <option value="">No teacher assigned</option>
                  {teachersList.map((teacher) => (
                    <option key={teacher._id} value={teacher._id}>
                      {teacher.name} ({teacher.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Schedule Info</label>
                <input
                  type="text"
                  value={formData.scheduleInfo}
                  onChange={(e) => setFormData({ ...formData, scheduleInfo: e.target.value })}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                  placeholder="e.g., Mon/Wed 9:00 AM - 10:30 AM"
                />
              </div>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.autoAssign}
                  onChange={(e) => setFormData({ ...formData, autoAssign: e.target.checked })}
                  className="w-4 h-4 text-simmonds-primary border-simmonds-cream rounded focus:ring-simmonds-primary"
                />
                <span className="ml-2 text-sm text-simmonds-charcoal">
                  Enable auto-assignment (students will be automatically assigned based on test results)
                </span>
              </label>
            </div>

            <div className="p-6 border-t border-simmonds-cream flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedGroup(null);
                  resetForm();
                }}
                className="px-6 py-2 border border-simmonds-cream text-simmonds-charcoal rounded-xl font-medium hover:bg-simmonds-cream-light"
              >
                Cancel
              </button>
              <button
                onClick={showEditModal ? handleUpdateGroup : handleCreateGroup}
                disabled={isProcessing || !formData.name}
                className="px-6 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light disabled:opacity-50"
              >
                {isProcessing ? 'Saving...' : showEditModal ? 'Save Changes' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Students Modal */}
      {showStudentsModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-simmonds-cream flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-simmonds-charcoal">
                  Students in {selectedGroup.name}
                </h3>
                <p className="text-sm text-simmonds-stone">
                  {selectedGroup.currentStudentCount} of {selectedGroup.maxStudents} students
                </p>
              </div>
              <button
                onClick={() => setShowAddStudentModal(true)}
                disabled={selectedGroup.currentStudentCount >= selectedGroup.maxStudents}
                className="px-4 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add Student
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-96">
              {!groupStudents || groupStudents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-simmonds-stone mb-4">No students in this group yet</p>
                  <button
                    onClick={() => setShowAddStudentModal(true)}
                    className="px-4 py-2 bg-simmonds-olive text-white rounded-xl font-medium hover:bg-simmonds-olive-light"
                  >
                    Add Your First Student
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {groupStudents.map((student: any) => (
                    <div
                      key={student._id}
                      className="flex items-center justify-between p-3 bg-simmonds-cream-light rounded-xl"
                    >
                      <div>
                        <p className="font-medium text-simmonds-charcoal">{student.name}</p>
                        <p className="text-sm text-simmonds-stone">{student.email}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <p className="text-simmonds-charcoal">
                            Score: {student.averageScore || 0}%
                          </p>
                          <p className="text-simmonds-stone">
                            {student.completedTests || 0} tests completed
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveStudent(student._id)}
                          className="p-2 text-simmonds-terracotta hover:bg-simmonds-terracotta/10 rounded-lg"
                          title="Remove from group"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-simmonds-cream flex justify-end">
              <button
                onClick={() => {
                  setShowStudentsModal(false);
                  setSelectedGroup(null);
                }}
                className="px-6 py-2 bg-simmonds-cream text-simmonds-charcoal rounded-xl font-medium hover:bg-simmonds-cream-light"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddStudentModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-simmonds-cream">
              <h3 className="text-lg font-semibold text-simmonds-charcoal">
                Add Student to {selectedGroup.name}
              </h3>
              <p className="text-sm text-simmonds-stone">
                Select a student to add to this group
              </p>
            </div>

            <div className="p-6">
              {getAvailableStudents().length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-simmonds-stone">No available students to add</p>
                  <p className="text-sm text-simmonds-stone mt-2">
                    All students are either already in this group or there are no students in the company
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                    Select Student
                  </label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                  >
                    <option value="">Choose a student...</option>
                    {getAvailableStudents().map((student) => (
                      <option key={student._id} value={student._id}>
                        {student.name} ({student.email}) - Level: {student.currentLevel || 'Not set'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-simmonds-cream flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddStudentModal(false);
                  setSelectedStudentId('');
                }}
                className="px-6 py-2 border border-simmonds-cream text-simmonds-charcoal rounded-xl font-medium hover:bg-simmonds-cream-light"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStudent}
                disabled={isProcessing || !selectedStudentId}
                className="px-6 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light disabled:opacity-50"
              >
                {isProcessing ? 'Adding...' : 'Add Student'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupManagement;
