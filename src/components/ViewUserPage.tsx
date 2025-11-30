import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { User, Company } from '../types';
import { Id } from '../../convex/_generated/dataModel';
import StudentDashboard from '../pages/StudentDashboard';
import RecentMaterialsWidget from './RecentMaterialsWidget';
import LessonsDashboardWidget from './LessonsDashboardWidget';

interface ViewUserPageProps {
  viewingUser: User;
  company: Company;
  onClose: () => void;
}

const ViewUserPage: React.FC<ViewUserPageProps> = ({ viewingUser, company, onClose }) => {
  const isStudent = viewingUser.role === 'student';
  const isTeacher = viewingUser.role === 'teacher' || viewingUser.role === 'admin' || viewingUser.role === 'corporate_admin';

  // Fetch teacher stats if viewing a teacher
  const teacherStats = useQuery(
    api.dashboard.getTeacherStats,
    isTeacher && viewingUser._id ? { teacherId: viewingUser._id as Id<"users">, companyId: company._id as Id<"companies"> } : 'skip'
  );

  // Fetch student stats if viewing a student
  const studentStats = useQuery(
    api.dashboard.getStudentStats,
    isStudent && viewingUser._id ? { studentId: viewingUser._id as Id<"users">, companyId: company._id as Id<"companies"> } : 'skip'
  );

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'corporate_admin': return 'Corporate Admin';
      case 'admin': return 'Administrator';
      case 'teacher': return 'Teacher';
      case 'student': return 'Student';
      default: return role;
    }
  };

  const renderTeacherView = () => {
    const stats = teacherStats;
    const isLoading = stats === undefined;

    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-simmonds-primary"></div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Teacher Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-simmonds-cream">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-simmonds-primary/10 rounded-lg">
                <svg className="w-6 h-6 text-simmonds-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-simmonds-stone">Assigned Students</p>
                <p className="text-2xl font-bold text-simmonds-charcoal">{stats?.assignedStudents || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-simmonds-cream">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-simmonds-lime/20 rounded-lg">
                <svg className="w-6 h-6 text-simmonds-lime-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-simmonds-stone">Lessons Created</p>
                <p className="text-2xl font-bold text-simmonds-charcoal">{stats?.lessonsCreated || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-simmonds-cream">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-simmonds-olive/20 rounded-lg">
                <svg className="w-6 h-6 text-simmonds-olive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-simmonds-stone">Tests Created</p>
                <p className="text-2xl font-bold text-simmonds-charcoal">{stats?.testsCreated || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-simmonds-cream">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-simmonds-terracotta/20 rounded-lg">
                <svg className="w-6 h-6 text-simmonds-terracotta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-simmonds-stone">Groups Managed</p>
                <p className="text-2xl font-bold text-simmonds-charcoal">{stats?.groupsManaged || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lessons Widget for Teachers */}
        <LessonsDashboardWidget
          currentUser={viewingUser}
          company={company}
          isTeacher={true}
        />

        {/* Recent Materials */}
        <RecentMaterialsWidget currentUser={viewingUser} company={company} isTeacher={true} />
      </div>
    );
  };

  const renderStudentView = () => {
    // Use the StudentDashboard component directly for students
    return <StudentDashboard currentUser={viewingUser} company={company} />;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-simmonds-cream-lighter rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-simmonds-cream flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-simmonds-primary rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {viewingUser.name?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-simmonds-charcoal">
                {viewingUser.name}
              </h2>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  isStudent
                    ? 'bg-simmonds-lime/20 text-simmonds-primary'
                    : 'bg-simmonds-olive/20 text-simmonds-olive'
                }`}>
                  {getRoleDisplayName(viewingUser.role)}
                </span>
                {isStudent && viewingUser.currentLevel && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-simmonds-primary/10 text-simmonds-primary">
                    Level: {viewingUser.currentLevel}
                  </span>
                )}
                <span className="text-sm text-simmonds-stone">{viewingUser.email}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-simmonds-cream rounded-lg transition-colors text-simmonds-charcoal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* View Mode Banner */}
        <div className="bg-simmonds-primary/10 px-6 py-2 border-b border-simmonds-primary/20 flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-simmonds-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Viewing as {getRoleDisplayName(viewingUser.role)}: <strong>{viewingUser.name}</strong></span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isStudent ? renderStudentView() : renderTeacherView()}
        </div>
      </div>
    </div>
  );
};

export default ViewUserPage;
