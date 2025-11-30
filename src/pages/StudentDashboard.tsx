import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { User, Company } from '../types';
import { Id } from '../../convex/_generated/dataModel';
import RecentMaterialsWidget from '../components/RecentMaterialsWidget';
import LessonsDashboardWidget from '../components/LessonsDashboardWidget';

interface StudentDashboardProps {
  currentUser: User;
  company: Company;
}

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

const getLevelColor = (level: string) => {
  const colors: Record<string, string> = {
    A1: 'bg-green-100 text-green-800',
    A2: 'bg-green-200 text-green-900',
    B1: 'bg-blue-100 text-blue-800',
    B2: 'bg-blue-200 text-blue-900',
    C1: 'bg-purple-100 text-purple-800',
    C2: 'bg-purple-200 text-purple-900',
  };
  return colors[level] || 'bg-gray-100 text-gray-800';
};

const StudentDashboard: React.FC<StudentDashboardProps> = ({ currentUser, company }) => {
  // Fetch lesson progress for this student
  const lessonProgress = useQuery(
    api.lessons.getStudentLessonProgress,
    {
      userId: currentUser._id as string,
      companyId: company._id as Id<"companies">,
    }
  );

  // Fetch upcoming scheduled lessons for stats
  const scheduledLessons = useQuery(
    api.lessons.getStudentScheduledLessons,
    {
      studentId: currentUser._id as string,
      companyId: company._id as Id<"companies">,
      status: 'scheduled',
    }
  );

  // Get stats
  const now = Date.now();
  const oneWeekFromNow = now + 7 * 24 * 60 * 60 * 1000;
  const upcomingCount = scheduledLessons?.filter(
    (l) => l.scheduledDate >= now && l.scheduledDate <= oneWeekFromNow
  ).length || 0;
  const completedLessonsCount = lessonProgress?.filter(p => p.status === 'completed').length || 0;
  const inProgressCount = lessonProgress?.filter(p => p.status === 'in_progress').length || 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-br from-simmonds-primary via-simmonds-primary to-simmonds-primary/80 p-5 sm:p-8 rounded-2xl text-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <span className="text-2xl sm:text-3xl font-bold">{currentUser.name?.charAt(0) || 'S'}</span>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Welcome back, {currentUser.name}!</h1>
              <p className="text-sm sm:text-base opacity-90">
                {currentUser.currentLevel ? (
                  <>Current level: <span className="font-semibold bg-white/20 px-2 py-0.5 rounded-md">{currentUser.currentLevel}</span></>
                ) : (
                  'Continue your language learning journey'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-simmonds-cream hover:shadow-md transition-shadow">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-simmonds-lime/30 to-simmonds-lime/10 rounded-xl">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-simmonds-lime-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-simmonds-charcoal">{completedLessonsCount}</p>
              <p className="text-xs sm:text-sm text-simmonds-stone">Completed</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-simmonds-cream hover:shadow-md transition-shadow">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-simmonds-primary/20 to-simmonds-primary/5 rounded-xl">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-simmonds-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-simmonds-charcoal">{inProgressCount}</p>
              <p className="text-xs sm:text-sm text-simmonds-stone">In Progress</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-simmonds-cream hover:shadow-md transition-shadow">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-simmonds-terracotta/20 to-simmonds-terracotta/5 rounded-xl">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-simmonds-terracotta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-simmonds-charcoal">{upcomingCount}</p>
              <p className="text-xs sm:text-sm text-simmonds-stone">Upcoming</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Lessons Widget */}
      <LessonsDashboardWidget
        currentUser={currentUser}
        company={company}
        isTeacher={false}
      />

      {/* Recent Materials Widget */}
      <RecentMaterialsWidget currentUser={currentUser} company={company} isTeacher={false} />
    </div>
  );
};

export default StudentDashboard;
