import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { User, Company } from '../types';
import { Id } from '../../convex/_generated/dataModel';

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
  // Fetch upcoming scheduled lessons
  const scheduledLessons = useQuery(
    api.lessons.getStudentScheduledLessons,
    {
      studentId: currentUser._id as string,
      companyId: company._id as Id<"companies">,
      status: 'scheduled',
    }
  );

  // Fetch virtual lessons available to student
  const virtualLessons = useQuery(
    api.lessons.getStudentVirtualLessons,
    {
      studentId: currentUser._id as string,
      companyId: company._id as Id<"companies">,
    }
  );

  // Fetch lesson progress for this student
  const lessonProgress = useQuery(
    api.lessons.getStudentLessonProgress,
    {
      userId: currentUser._id as string,
      companyId: company._id as Id<"companies">,
    }
  );

  const isLoading = scheduledLessons === undefined || virtualLessons === undefined;

  // Get upcoming lessons (next 7 days)
  const now = Date.now();
  const oneWeekFromNow = now + 7 * 24 * 60 * 60 * 1000;
  const upcomingLessons = scheduledLessons?.filter(
    (l) => l.scheduledDate >= now && l.scheduledDate <= oneWeekFromNow
  ) || [];

  // Get progress stats
  const completedLessonsCount = lessonProgress?.filter(p => p.status === 'completed').length || 0;
  const inProgressCount = lessonProgress?.filter(p => p.status === 'in_progress').length || 0;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-simmonds-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-simmonds-primary to-simmonds-primary/80 p-6 rounded-2xl text-white">
        <h1 className="text-2xl font-bold mb-2">Welcome back, {currentUser.name}!</h1>
        <p className="opacity-90">
          {currentUser.currentLevel ? (
            <>Your current level: <span className="font-semibold">{currentUser.currentLevel}</span></>
          ) : (
            'Continue your language learning journey'
          )}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-simmonds-cream">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-simmonds-lime/20 rounded-lg">
              <svg className="w-6 h-6 text-simmonds-lime-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-simmonds-stone">Lessons Completed</p>
              <p className="text-2xl font-bold text-simmonds-charcoal">{completedLessonsCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-simmonds-cream">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-simmonds-primary/10 rounded-lg">
              <svg className="w-6 h-6 text-simmonds-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-simmonds-stone">In Progress</p>
              <p className="text-2xl font-bold text-simmonds-charcoal">{inProgressCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-simmonds-cream">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-simmonds-terracotta/20 rounded-lg">
              <svg className="w-6 h-6 text-simmonds-terracotta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-simmonds-stone">Upcoming Classes</p>
              <p className="text-2xl font-bold text-simmonds-charcoal">{upcomingLessons.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Scheduled Lessons */}
        <div className="bg-white rounded-2xl shadow-sm border border-simmonds-cream overflow-hidden">
          <div className="p-5 border-b border-simmonds-cream">
            <h2 className="text-lg font-semibold text-simmonds-charcoal flex items-center gap-2">
              <svg className="w-5 h-5 text-simmonds-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Upcoming Lessons
            </h2>
          </div>
          <div className="divide-y divide-simmonds-cream">
            {upcomingLessons.length === 0 ? (
              <div className="p-8 text-center text-simmonds-stone">
                <svg className="w-12 h-12 mx-auto mb-3 text-simmonds-cream" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p>No upcoming lessons scheduled</p>
              </div>
            ) : (
              upcomingLessons.slice(0, 5).map((lesson) => (
                <div key={lesson._id} className="p-4 hover:bg-simmonds-cream/30 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-simmonds-charcoal">{lesson.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${getLevelColor(lesson.level)}`}>
                      {lesson.level}
                    </span>
                  </div>
                  <p className="text-sm text-simmonds-stone mb-2">{lesson.topic}</p>
                  <div className="flex items-center gap-4 text-xs text-simmonds-stone">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatDate(lesson.scheduledDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatDuration(lesson.duration)}
                    </span>
                    {lesson.locationType === 'online' && lesson.meetingLink && (
                      <a
                        href={lesson.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-simmonds-primary hover:underline flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Join
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Virtual Lessons */}
        <div className="bg-white rounded-2xl shadow-sm border border-simmonds-cream overflow-hidden">
          <div className="p-5 border-b border-simmonds-cream">
            <h2 className="text-lg font-semibold text-simmonds-charcoal flex items-center gap-2">
              <svg className="w-5 h-5 text-simmonds-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Virtual Lessons
            </h2>
          </div>
          <div className="divide-y divide-simmonds-cream">
            {!virtualLessons || virtualLessons.length === 0 ? (
              <div className="p-8 text-center text-simmonds-stone">
                <svg className="w-12 h-12 mx-auto mb-3 text-simmonds-cream" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p>No virtual lessons available yet</p>
              </div>
            ) : (
              virtualLessons.slice(0, 5).map((lesson) => {
                const progress = lessonProgress?.find(p => p.virtualLessonId === lesson._id);
                const progressPercent = progress
                  ? Math.round((progress.completedSections.length / lesson.sections.length) * 100)
                  : 0;

                return (
                  <div key={lesson._id} className="p-4 hover:bg-simmonds-cream/30 transition-colors cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-simmonds-charcoal">{lesson.title}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${getLevelColor(lesson.level)}`}>
                        {lesson.level}
                      </span>
                    </div>
                    <p className="text-sm text-simmonds-stone mb-3">{lesson.topic}</p>

                    {/* Progress bar */}
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-simmonds-stone mb-1">
                        <span>{progress?.status === 'completed' ? 'Completed' : progress?.status === 'in_progress' ? 'In Progress' : 'Not Started'}</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="w-full bg-simmonds-cream rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            progressPercent === 100 ? 'bg-simmonds-lime' : 'bg-simmonds-primary'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-simmonds-stone">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatDuration(lesson.estimatedDuration)}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        {lesson.sections.length} sections
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {virtualLessons && virtualLessons.length > 5 && (
            <div className="p-4 border-t border-simmonds-cream text-center">
              <button className="text-simmonds-primary hover:underline text-sm">
                View all {virtualLessons.length} lessons
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
