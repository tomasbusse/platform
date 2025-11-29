import React, { useState, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';
import LessonScheduler from '../components/LessonScheduler';
import VirtualLessonBuilder from '../components/VirtualLessonBuilder';
import VirtualLessonViewer from '../components/VirtualLessonViewer';
import LessonPresentation from '../components/LessonPresentation';
import LessonTest from '../components/LessonTest';

interface UploadedMaterial {
  _id?: Id<"lessonMaterials">;
  storageId?: Id<"_storage">;
  fileName: string;
  fileType: string;
  fileSize: number;
  url?: string | null;
  isNew?: boolean;
}

interface LessonsPageProps {
  currentUser: User | null;
  company: Company | null;
}

type ViewMode = 'dashboard' | 'schedule' | 'create' | 'view-lesson' | 'take-test';

interface ScheduledLesson {
  _id: Id<"scheduledLessons">;
  title: string;
  description?: string;
  topic: string;
  level: string;
  scheduledDate: number;
  duration: number;
  timezone: string;
  locationType: 'online' | 'office' | 'company';
  locationDetails?: string;
  meetingLink?: string;
  status: string;
  virtualLessonId?: Id<"virtualLessons">;
  materials?: string[];
  objectives: string[];
  assignedStudentIds: string[];
  teacherId?: string;
}

const LessonsPage: React.FC<LessonsPageProps> = ({ currentUser, company }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'virtual' | 'my-progress'>('scheduled');
  const [editingLesson, setEditingLesson] = useState<ScheduledLesson | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isTeacher = currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'corporate_admin';
  const isStudent = currentUser?.role === 'student';

  // Mutations
  const updateLesson = useMutation(api.lessons.updateScheduledLesson);
  const deleteLesson = useMutation(api.lessons.deleteScheduledLesson);

  // Fetch users for teacher selection in edit modal
  const students = useQuery(
    api.authLegacy.getUsersByCompany,
    company?._id ? { companyId: company._id as Id<"companies"> } : 'skip'
  );
  const teacherList = students?.filter((u: any) => (u.role === 'teacher' || u.role === 'admin' || u.role === 'corporate_admin') && u.isActive) || [];

  // Fetch scheduled lessons
  const scheduledLessons = useQuery(
    api.lessons.getCompanyScheduledLessons,
    company?._id ? { companyId: company._id as Id<"companies"> } : 'skip'
  );

  // Fetch virtual lessons
  const virtualLessons = useQuery(
    api.lessons.getCompanyVirtualLessons,
    company?._id ? { companyId: company._id as Id<"companies"> } : 'skip'
  );

  // Fetch teacher stats (for teachers)
  const teacherStats = useQuery(
    api.lessons.getTeacherLessonStats,
    isTeacher && currentUser && company
      ? {
          teacherId: currentUser._id as Id<"users">,
          companyId: company._id as Id<"companies">,
        }
      : 'skip'
  );

  // Fetch student stats (for students)
  const studentStats = useQuery(
    api.lessons.getStudentLessonStats,
    isStudent && currentUser && company
      ? {
          studentId: currentUser._id as Id<"users">,
          companyId: company._id as Id<"companies">,
        }
      : 'skip'
  );

  // Fetch student's lesson progress
  const studentProgress = useQuery(
    api.lessons.getUserLessonProgress,
    isStudent && currentUser
      ? { userId: currentUser._id as Id<"users"> }
      : 'skip'
  );

  // Fetch student's scheduled lessons
  const studentScheduledLessons = useQuery(
    api.lessons.getStudentScheduledLessons,
    isStudent && currentUser && company
      ? {
          studentId: currentUser._id,
          companyId: company._id as Id<"companies">,
        }
      : 'skip'
  );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleViewLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setViewMode('view-lesson');
  };

  const handleStartTest = () => {
    setViewMode('take-test');
  };

  const handleEditLesson = (lesson: ScheduledLesson) => {
    setEditingLesson(lesson);
  };

  const handleDeleteLesson = async (lessonId: string) => {
    setIsDeleting(true);
    try {
      await deleteLesson({ lessonId: lessonId as Id<"scheduledLessons"> });
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete lesson:', error);
      alert('Failed to delete lesson');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveLesson = async (lessonData: Partial<ScheduledLesson>) => {
    if (!editingLesson) return;
    setIsSaving(true);
    try {
      await updateLesson({
        lessonId: editingLesson._id,
        title: lessonData.title,
        description: lessonData.description,
        topic: lessonData.topic,
        level: lessonData.level as any,
        scheduledDate: lessonData.scheduledDate,
        duration: lessonData.duration,
        timezone: lessonData.timezone,
        locationType: lessonData.locationType,
        locationDetails: lessonData.locationDetails,
        meetingLink: lessonData.meetingLink,
        materials: lessonData.materials,
        objectives: lessonData.objectives,
        teacherId: lessonData.teacherId,
      });
      setEditingLesson(null);
    } catch (error) {
      console.error('Failed to update lesson:', error);
      alert('Failed to update lesson');
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-7xl mx-auto text-center py-12">
        <p className="text-simmonds-stone">Please log in to access lessons.</p>
      </div>
    );
  }

  // View Lesson Mode - Using new self-contained presentation window
  if (viewMode === 'view-lesson' && selectedLessonId) {
    return (
      <LessonPresentation
        currentUser={currentUser}
        company={company}
        lessonId={selectedLessonId}
        onClose={() => {
          setViewMode('dashboard');
          setSelectedLessonId(null);
        }}
        onComplete={() => setViewMode('dashboard')}
        onStartTest={handleStartTest}
      />
    );
  }

  // Take Test Mode
  if (viewMode === 'take-test' && selectedLessonId) {
    return (
      <div className="max-w-7xl mx-auto">
        <LessonTest
          currentUser={currentUser}
          company={company}
          lessonId={selectedLessonId}
          onComplete={() => setViewMode('dashboard')}
          onBack={() => setViewMode('view-lesson')}
        />
      </div>
    );
  }

  // Schedule Lesson Mode (Teachers only)
  if (viewMode === 'schedule') {
    return (
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => setViewMode('dashboard')}
          className="mb-4 text-simmonds-primary hover:underline flex items-center gap-1"
        >
          ← Back to Lessons
        </button>
        <LessonScheduler
          currentUser={currentUser}
          company={company}
          onLessonCreated={() => setViewMode('dashboard')}
        />
      </div>
    );
  }

  // Create Lesson Reinforcement Mode (Teachers only)
  if (viewMode === 'create') {
    return (
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => {
            setViewMode('dashboard');
            setSelectedLessonId(null);
          }}
          className="mb-4 text-simmonds-primary hover:underline flex items-center gap-1"
        >
          ← Back to Lessons
        </button>
        <VirtualLessonBuilder
          currentUser={currentUser}
          company={company}
          scheduledLessonId={selectedLessonId || undefined}
          onLessonCreated={() => {
            setViewMode('dashboard');
            setSelectedLessonId(null);
          }}
        />
      </div>
    );
  }

  // Main Dashboard
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-simmonds-charcoal mb-1 sm:mb-2">Lessons</h1>
        <p className="text-sm sm:text-base text-simmonds-stone">
          {isTeacher
            ? 'Schedule lessons, create content, and track progress'
            : 'Access your lessons and track progress'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {isTeacher && teacherStats && (
          <>
            <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-simmonds-cream">
              <p className="text-xs sm:text-sm text-simmonds-stone">Upcoming</p>
              <p className="text-xl sm:text-2xl font-bold text-simmonds-primary">
                {teacherStats.upcomingLessons}
              </p>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-simmonds-cream">
              <p className="text-xs sm:text-sm text-simmonds-stone">Completed</p>
              <p className="text-xl sm:text-2xl font-bold text-simmonds-lime-dark">
                {teacherStats.completedLessons}
              </p>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-simmonds-cream">
              <p className="text-xs sm:text-sm text-simmonds-stone">Practice</p>
              <p className="text-xl sm:text-2xl font-bold text-simmonds-olive">
                {teacherStats.totalVirtualLessons}
              </p>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-simmonds-cream">
              <p className="text-xs sm:text-sm text-simmonds-stone">Published</p>
              <p className="text-xl sm:text-2xl font-bold text-simmonds-charcoal">
                {teacherStats.publishedVirtualLessons}
              </p>
            </div>
          </>
        )}

        {isStudent && studentStats && (
          <>
            <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-simmonds-cream">
              <p className="text-xs sm:text-sm text-simmonds-stone">Completed</p>
              <p className="text-xl sm:text-2xl font-bold text-simmonds-lime-dark">
                {studentStats.completedLessons}
              </p>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-simmonds-cream">
              <p className="text-xs sm:text-sm text-simmonds-stone">In Progress</p>
              <p className="text-xl sm:text-2xl font-bold text-simmonds-olive">
                {studentStats.inProgressLessons}
              </p>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-simmonds-cream">
              <p className="text-xs sm:text-sm text-simmonds-stone">Tests Passed</p>
              <p className="text-xl sm:text-2xl font-bold text-simmonds-primary">
                {studentStats.testsPassed}/{studentStats.totalTestsTaken}
              </p>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-simmonds-cream">
              <p className="text-xs sm:text-sm text-simmonds-stone">Avg Score</p>
              <p className="text-xl sm:text-2xl font-bold text-simmonds-charcoal">
                {studentStats.averageTestScore}%
              </p>
            </div>
          </>
        )}
      </div>

      {/* Action Buttons (Teachers only) */}
      {isTeacher && (
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => setViewMode('schedule')}
            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-simmonds-primary text-white rounded-xl text-sm sm:text-base font-medium hover:bg-simmonds-primary-light flex items-center justify-center gap-2"
          >
            <span>📅</span>
            <span>Schedule Lesson</span>
          </button>
          <button
            onClick={() => setViewMode('create')}
            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-simmonds-olive to-simmonds-lime text-white rounded-xl text-sm sm:text-base font-medium hover:opacity-90 flex items-center justify-center gap-2"
          >
            <span>✨</span>
            <span>Create Practice Session</span>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 sm:gap-2 mb-4 sm:mb-6 border-b border-simmonds-cream overflow-x-auto scrollbar-hide">
        {isTeacher ? (
          <>
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
                activeTab === 'scheduled'
                  ? 'text-simmonds-primary border-b-2 border-simmonds-primary'
                  : 'text-simmonds-stone hover:text-simmonds-charcoal'
              }`}
            >
              Scheduled
            </button>
            <button
              onClick={() => setActiveTab('virtual')}
              className={`px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
                activeTab === 'virtual'
                  ? 'text-simmonds-primary border-b-2 border-simmonds-primary'
                  : 'text-simmonds-stone hover:text-simmonds-charcoal'
              }`}
            >
              Practice
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setActiveTab('my-progress')}
              className={`px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
                activeTab === 'my-progress'
                  ? 'text-simmonds-primary border-b-2 border-simmonds-primary'
                  : 'text-simmonds-stone hover:text-simmonds-charcoal'
              }`}
            >
              My Lessons
            </button>
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
                activeTab === 'scheduled'
                  ? 'text-simmonds-primary border-b-2 border-simmonds-primary'
                  : 'text-simmonds-stone hover:text-simmonds-charcoal'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setActiveTab('virtual')}
              className={`px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
                activeTab === 'virtual'
                  ? 'text-simmonds-primary border-b-2 border-simmonds-primary'
                  : 'text-simmonds-stone hover:text-simmonds-charcoal'
              }`}
            >
              Available
            </button>
          </>
        )}
      </div>

      {/* Scheduled Lessons Tab */}
      {activeTab === 'scheduled' && (
        <div className="space-y-3 sm:space-y-4">
          {(isStudent ? studentScheduledLessons : scheduledLessons)?.length === 0 ? (
            <div className="text-center py-8 sm:py-12 bg-simmonds-cream/30 rounded-2xl">
              <p className="text-sm sm:text-base text-simmonds-stone">No scheduled lessons yet</p>
              {isTeacher && (
                <button
                  onClick={() => setViewMode('schedule')}
                  className="mt-4 px-4 py-2 bg-simmonds-primary/10 text-simmonds-primary rounded-xl text-sm sm:text-base"
                >
                  Schedule Your First Lesson
                </button>
              )}
            </div>
          ) : (
            (isStudent ? studentScheduledLessons : scheduledLessons)?.map((lesson) => (
              <div
                key={lesson._id}
                className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-simmonds-cream hover:border-simmonds-primary/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="font-semibold text-simmonds-charcoal text-sm sm:text-base">{lesson.title}</h3>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          lesson.status === 'scheduled'
                            ? 'bg-simmonds-primary/10 text-simmonds-primary'
                            : lesson.status === 'completed'
                            ? 'bg-simmonds-lime/20 text-simmonds-lime-dark'
                            : lesson.status === 'in_progress'
                            ? 'bg-simmonds-olive/20 text-simmonds-olive'
                            : 'bg-simmonds-cream text-simmonds-stone'
                        }`}
                      >
                        {lesson.status}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-simmonds-stone mb-2">{lesson.topic}</p>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-simmonds-stone">
                      <span>📅 {formatDate(lesson.scheduledDate)}</span>
                      <span>⏱️ {lesson.duration} min</span>
                      <span
                        className={`px-2 py-0.5 rounded ${
                          lesson.locationType === 'online'
                            ? 'bg-simmonds-primary/10 text-simmonds-primary'
                            : 'bg-simmonds-olive/10 text-simmonds-olive'
                        }`}
                      >
                        {lesson.locationType === 'online' ? '🌐 Online' : '🏢 In Person'}
                      </span>
                      <span className="px-2 py-0.5 bg-simmonds-cream rounded">{lesson.level}</span>
                    </div>
                    {/* Show materials if present */}
                    {lesson.materials && lesson.materials.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-simmonds-cream/50">
                        <p className="text-xs font-medium text-simmonds-charcoal mb-1">Materials:</p>
                        <ul className="text-xs text-simmonds-stone space-y-1">
                          {lesson.materials.slice(0, 3).map((material, idx) => (
                            <li key={idx} className="flex items-start gap-1">
                              <span className="text-simmonds-primary">•</span>
                              {material.startsWith('http') ? (
                                <a href={material} target="_blank" rel="noopener noreferrer" className="text-simmonds-primary hover:underline truncate">
                                  {material}
                                </a>
                              ) : (
                                <span className="truncate">{material}</span>
                              )}
                            </li>
                          ))}
                          {lesson.materials.length > 3 && (
                            <li className="text-simmonds-olive">+{lesson.materials.length - 3} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-0">
                    {lesson.meetingLink && lesson.status === 'scheduled' && (
                      <a
                        href={lesson.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 sm:px-4 py-1.5 sm:py-2 bg-simmonds-primary text-white rounded-xl text-xs sm:text-sm font-medium"
                      >
                        Join
                      </a>
                    )}
                    {/* Create Lesson Reinforcement button - shown for any lesson without virtual lesson */}
                    {isTeacher && !lesson.virtualLessonId && (
                      <button
                        onClick={() => {
                          setSelectedLessonId(lesson._id);
                          setViewMode('create');
                        }}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-simmonds-olive to-simmonds-lime text-white rounded-xl text-xs sm:text-sm font-medium hover:opacity-90 transition-all flex items-center gap-1.5 sm:gap-2 shadow-sm"
                      >
                        <span>✨</span>
                        <span className="hidden sm:inline">Add Practice</span>
                        <span className="sm:hidden">Practice</span>
                      </button>
                    )}
                    {/* View linked practice session if exists */}
                    {lesson.virtualLessonId && (
                      <button
                        onClick={() => handleViewLesson(lesson.virtualLessonId!)}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 bg-simmonds-lime/20 text-simmonds-lime-dark rounded-xl text-xs sm:text-sm font-medium hover:bg-simmonds-lime/30 transition-all flex items-center gap-1.5 sm:gap-2"
                      >
                        <span>📚</span>
                        <span className="hidden sm:inline">View Practice</span>
                        <span className="sm:hidden">View</span>
                      </button>
                    )}
                    {isTeacher && (
                      <>
                        <button
                          onClick={() => handleEditLesson(lesson as ScheduledLesson)}
                          className="p-1.5 sm:p-2 text-simmonds-primary hover:bg-simmonds-primary/10 rounded-lg transition-colors"
                          title="Edit lesson"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(lesson._id)}
                          className="p-1.5 sm:p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete lesson"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Practice Sessions Tab */}
      {activeTab === 'virtual' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {virtualLessons?.filter((l) => l.isPublished || isTeacher).length === 0 ? (
            <div className="col-span-full text-center py-16 bg-gradient-to-br from-simmonds-cream/30 to-simmonds-cream/10 rounded-2xl border-2 border-dashed border-simmonds-cream">
              <div className="w-16 h-16 mx-auto mb-4 bg-simmonds-cream/50 rounded-full flex items-center justify-center">
                <span className="text-3xl">📚</span>
              </div>
              <p className="text-simmonds-stone mb-2">No practice sessions available yet</p>
              <p className="text-sm text-simmonds-stone/70">
                {isStudent ? 'Your teacher will assign practice sessions soon!' : 'Create your first practice session to reinforce lessons.'}
              </p>
              {isTeacher && (
                <button
                  onClick={() => setViewMode('create')}
                  className="mt-4 px-6 py-2 bg-gradient-to-r from-simmonds-olive to-simmonds-lime text-white rounded-xl font-medium hover:opacity-90 transition-all"
                >
                  ✨ Create Your First Practice Session
                </button>
              )}
            </div>
          ) : (
            virtualLessons
              ?.filter((l) => l.isPublished || isTeacher)
              .map((lesson) => {
                const progress = studentProgress?.find(
                  (p) => p.virtualLessonId === lesson._id
                );
                const progressPercent = progress
                  ? Math.round((progress.completedSections.length / lesson.sections.length) * 100)
                  : 0;

                return (
                  <div
                    key={lesson._id}
                    className="group bg-white rounded-2xl shadow-sm border border-simmonds-cream overflow-hidden hover:shadow-lg hover:border-simmonds-primary/30 transition-all duration-300"
                  >
                    {/* Gradient header with icon */}
                    <div className="bg-gradient-to-br from-simmonds-primary via-simmonds-olive to-simmonds-lime p-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                      <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                      <div className="relative flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium backdrop-blur-sm">
                              {lesson.level}
                            </span>
                            {!lesson.isPublished && (
                              <span className="px-2 py-0.5 bg-white/10 text-white/80 rounded text-xs">
                                Draft
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-white text-lg leading-tight line-clamp-2">
                            {lesson.title}
                          </h3>
                        </div>
                        {progress?.status === 'completed' ? (
                          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md">
                            <span className="text-simmonds-lime-dark text-lg">✓</span>
                          </div>
                        ) : progress?.status === 'in_progress' ? (
                          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-bold">{progressPercent}%</span>
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                            <span className="text-white/80 text-xl">▶</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4">
                      <p className="text-sm text-simmonds-stone mb-3 line-clamp-2 min-h-[2.5rem]">
                        {lesson.description || lesson.topic}
                      </p>

                      {/* Lesson stats */}
                      <div className="flex items-center gap-4 text-xs text-simmonds-stone mb-4 pb-4 border-b border-simmonds-cream/50">
                        <div className="flex items-center gap-1">
                          <span className="text-simmonds-primary">⏱️</span>
                          <span>{lesson.estimatedDuration} min</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-simmonds-olive">📚</span>
                          <span>{lesson.sections.length} sections</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-simmonds-terracotta">📖</span>
                          <span>{lesson.vocabulary.length} words</span>
                        </div>
                      </div>

                      {/* Progress bar for in-progress lessons */}
                      {progress && progress.status !== 'not_started' && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-simmonds-charcoal font-medium">Your Progress</span>
                            <span className="text-simmonds-primary font-bold">{progressPercent}%</span>
                          </div>
                          <div className="h-2 bg-simmonds-cream rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-simmonds-primary to-simmonds-olive transition-all duration-500"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          {progress.testScore !== undefined && (
                            <div className="flex items-center gap-2 mt-2 text-xs">
                              <span className="text-simmonds-stone">Test Score:</span>
                              <span className={`font-bold ${progress.testPassed ? 'text-simmonds-lime-dark' : 'text-simmonds-terracotta'}`}>
                                {Math.round(progress.testScore)}%
                              </span>
                              {progress.testPassed && <span>🎉</span>}
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        onClick={() => handleViewLesson(lesson._id)}
                        className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                          progress?.status === 'completed'
                            ? 'bg-simmonds-lime/10 text-simmonds-lime-dark hover:bg-simmonds-lime/20'
                            : progress?.status === 'in_progress'
                            ? 'bg-gradient-to-r from-simmonds-primary to-simmonds-olive text-white hover:opacity-90 shadow-sm'
                            : 'bg-simmonds-primary text-white hover:bg-simmonds-primary-light shadow-sm'
                        }`}
                      >
                        {progress?.status === 'in_progress' ? (
                          <>
                            <span>Continue Learning</span>
                            <span>→</span>
                          </>
                        ) : progress?.status === 'completed' ? (
                          <>
                            <span>📖</span>
                            <span>Review Lesson</span>
                          </>
                        ) : (
                          <>
                            <span>▶</span>
                            <span>Start Lesson</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* My Progress Tab (Students only) */}
      {activeTab === 'my-progress' && isStudent && (
        <div className="space-y-4">
          {studentProgress?.length === 0 ? (
            <div className="text-center py-12 bg-simmonds-cream/30 rounded-2xl">
              <p className="text-simmonds-stone">You haven't started any lessons yet</p>
              <button
                onClick={() => setActiveTab('virtual')}
                className="mt-4 px-4 py-2 bg-simmonds-primary/10 text-simmonds-primary rounded-xl"
              >
                Browse Available Lessons
              </button>
            </div>
          ) : (
            studentProgress?.map((progress) => {
              const lesson = virtualLessons?.find((l) => l._id === progress.virtualLessonId);
              if (!lesson) return null;

              const progressPercentage = Math.round(
                (progress.completedSections.length / lesson.sections.length) * 100
              );

              return (
                <div
                  key={progress._id}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-simmonds-charcoal">{lesson.title}</h3>
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            progress.status === 'completed'
                              ? 'bg-simmonds-lime/20 text-simmonds-lime-dark'
                              : progress.status === 'in_progress'
                              ? 'bg-simmonds-olive/20 text-simmonds-olive'
                              : 'bg-simmonds-cream text-simmonds-stone'
                          }`}
                        >
                          {progress.status === 'completed'
                            ? 'Completed'
                            : progress.status === 'in_progress'
                            ? 'In Progress'
                            : 'Not Started'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-simmonds-stone mb-3">
                        <span>{lesson.level}</span>
                        <span>
                          📖 {progress.masteredVocabulary.length}/{lesson.vocabulary.length} words
                          mastered
                        </span>
                        <span>⏱️ {Math.round(progress.totalTimeSpent / 60)} min spent</span>
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-simmonds-stone">Lesson Progress</span>
                          <span className="text-simmonds-primary">{progressPercentage}%</span>
                        </div>
                        <div className="h-2 bg-simmonds-cream rounded-full overflow-hidden">
                          <div
                            className="h-full bg-simmonds-primary transition-all"
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>
                      </div>

                      {progress.testScore !== undefined && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-simmonds-stone">Test Score:</span>
                          <span
                            className={`font-bold ${
                              progress.testPassed
                                ? 'text-simmonds-lime-dark'
                                : 'text-simmonds-terracotta'
                            }`}
                          >
                            {Math.round(progress.testScore)}%
                          </span>
                          {progress.testPassed && <span>✓</span>}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleViewLesson(lesson._id)}
                      className="px-4 py-2 bg-simmonds-primary text-white rounded-xl text-sm font-medium"
                    >
                      {progress.status === 'completed' ? 'Review' : 'Continue'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-simmonds-charcoal mb-2">Delete Lesson</h3>
            <p className="text-simmonds-stone mb-6">
              Are you sure you want to delete this lesson? This action cannot be undone. All associated attendance records will also be deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-simmonds-stone hover:bg-simmonds-cream rounded-xl transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteLesson(showDeleteConfirm)}
                className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lesson Modal */}
      {editingLesson && currentUser && company && (
        <EditLessonModal
          lesson={editingLesson}
          onSave={handleSaveLesson}
          onCancel={() => setEditingLesson(null)}
          isSaving={isSaving}
          teacherList={teacherList}
          currentUser={currentUser}
          company={company}
        />
      )}
    </div>
  );
};

// Edit Lesson Modal Component
interface EditLessonModalProps {
  lesson: ScheduledLesson;
  onSave: (data: Partial<ScheduledLesson>) => void;
  onCancel: () => void;
  isSaving: boolean;
  teacherList: Array<{ _id: any; name?: string; email?: string }>;
  currentUser: User;
  company: Company;
}

const EditLessonModal: React.FC<EditLessonModalProps> = ({
  lesson,
  onSave,
  onCancel,
  isSaving,
  teacherList,
  currentUser,
  company,
}) => {
  const [formData, setFormData] = useState({
    title: lesson.title,
    description: lesson.description || '',
    topic: lesson.topic,
    level: lesson.level,
    scheduledDate: new Date(lesson.scheduledDate).toISOString().slice(0, 16),
    duration: lesson.duration,
    timezone: lesson.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    locationType: lesson.locationType,
    locationDetails: lesson.locationDetails || '',
    meetingLink: lesson.meetingLink || '',
    materials: lesson.materials?.join('\n') || '',
    objectives: lesson.objectives?.join('\n') || '',
    teacherId: lesson.teacherId || '',
  });

  const [uploadedFiles, setUploadedFiles] = useState<UploadedMaterial[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.lessons.generateUploadUrl);
  const saveLessonMaterial = useMutation(api.lessons.saveLessonMaterial);
  const deleteLessonMaterial = useMutation(api.lessons.deleteLessonMaterial);

  // Fetch existing materials
  const existingMaterials = useQuery(
    api.lessons.getLessonMaterials,
    { scheduledLessonId: lesson._id }
  );

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress('');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Uploading ${file.name}... (${i + 1}/${files.length})`);

        const uploadUrl = await generateUploadUrl();

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const { storageId } = await response.json();

        // Save material to database immediately
        await saveLessonMaterial({
          companyId: company._id as Id<"companies">,
          scheduledLessonId: lesson._id,
          uploadedBy: currentUser._id as Id<"users">,
          storageId: storageId as Id<"_storage">,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          category: file.type.startsWith('image/') ? 'image' :
                    file.type.startsWith('video/') ? 'video' :
                    file.type.startsWith('audio/') ? 'audio' :
                    file.type.includes('pdf') ? 'document' : 'other',
        });
      }
      setUploadProgress('Upload complete!');
      setTimeout(() => setUploadProgress(''), 2000);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadProgress('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteMaterial = async (materialId: Id<"lessonMaterials">) => {
    try {
      await deleteLessonMaterial({ materialId });
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string): string => {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.startsWith('video/')) return '🎬';
    if (fileType.startsWith('audio/')) return '🎵';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('sheet') || fileType.includes('excel')) return '📊';
    if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '📽️';
    return '📎';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title: formData.title,
      description: formData.description || undefined,
      topic: formData.topic,
      level: formData.level,
      scheduledDate: new Date(formData.scheduledDate).getTime(),
      duration: formData.duration,
      timezone: formData.timezone,
      locationType: formData.locationType as 'online' | 'office' | 'company',
      locationDetails: formData.locationDetails || undefined,
      meetingLink: formData.meetingLink || undefined,
      materials: formData.materials.split('\n').filter(Boolean),
      objectives: formData.objectives.split('\n').filter(Boolean),
      teacherId: formData.teacherId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-simmonds-charcoal">Edit Lesson</h3>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-simmonds-cream rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:ring-2 focus:ring-simmonds-primary/20 focus:border-simmonds-primary"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:ring-2 focus:ring-simmonds-primary/20 focus:border-simmonds-primary"
              rows={2}
            />
          </div>

          {/* Topic */}
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
              Topic
            </label>
            <input
              type="text"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:ring-2 focus:ring-simmonds-primary/20 focus:border-simmonds-primary"
              required
            />
          </div>

          {/* Row: Level + Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
                Level
              </label>
              <select
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:ring-2 focus:ring-simmonds-primary/20 focus:border-simmonds-primary"
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
              <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 60 })}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:ring-2 focus:ring-simmonds-primary/20 focus:border-simmonds-primary"
                min={15}
                step={15}
              />
            </div>
          </div>

          {/* Date/Time */}
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={formData.scheduledDate}
              onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:ring-2 focus:ring-simmonds-primary/20 focus:border-simmonds-primary"
              required
            />
          </div>

          {/* Teacher */}
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
              Assigned Teacher
            </label>
            <select
              value={formData.teacherId}
              onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:ring-2 focus:ring-simmonds-primary/20 focus:border-simmonds-primary"
            >
              <option value="">Select a teacher</option>
              {teacherList.map((teacher) => (
                <option key={teacher._id} value={teacher._id}>
                  {teacher.name} ({teacher.email})
                </option>
              ))}
            </select>
          </div>

          {/* Location Type */}
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
              Location Type
            </label>
            <select
              value={formData.locationType}
              onChange={(e) => setFormData({ ...formData, locationType: e.target.value as any })}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:ring-2 focus:ring-simmonds-primary/20 focus:border-simmonds-primary"
            >
              <option value="online">Online</option>
              <option value="office">At Office</option>
              <option value="company">At Client Company</option>
            </select>
          </div>

          {/* Location Details or Meeting Link */}
          {formData.locationType === 'online' ? (
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
                Meeting Link
              </label>
              <input
                type="url"
                value={formData.meetingLink}
                onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:ring-2 focus:ring-simmonds-primary/20 focus:border-simmonds-primary"
                placeholder="https://zoom.us/j/..."
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
                Location Details
              </label>
              <input
                type="text"
                value={formData.locationDetails}
                onChange={(e) => setFormData({ ...formData, locationDetails: e.target.value })}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:ring-2 focus:ring-simmonds-primary/20 focus:border-simmonds-primary"
                placeholder="Room number, building, etc."
              />
            </div>
          )}

          {/* Objectives */}
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
              Objectives (one per line)
            </label>
            <textarea
              value={formData.objectives}
              onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:ring-2 focus:ring-simmonds-primary/20 focus:border-simmonds-primary"
              rows={3}
              placeholder="Review past tense verbs&#10;Practice conversation skills&#10;Learn 10 new vocabulary words"
            />
          </div>

          {/* Materials */}
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-1">
              Materials & Resources
            </label>

            {/* File Upload Section */}
            <div className="mb-3 p-3 border-2 border-dashed border-simmonds-cream rounded-xl hover:border-simmonds-primary/50 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.mp3,.mp4,.wav,.webm"
              />
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-4 py-2 bg-simmonds-primary text-white rounded-xl text-sm font-medium hover:bg-simmonds-primary-light disabled:opacity-50 transition-colors"
                >
                  {isUploading ? 'Uploading...' : '📁 Upload Files'}
                </button>
                <p className="text-xs text-simmonds-stone mt-1">
                  PDF, Documents, Images, Audio, Video
                </p>
                {uploadProgress && (
                  <p className={`text-xs mt-1 ${uploadProgress.includes('failed') ? 'text-red-500' : 'text-simmonds-primary'}`}>
                    {uploadProgress}
                  </p>
                )}
              </div>
            </div>

            {/* Uploaded Files List */}
            {existingMaterials && existingMaterials.length > 0 && (
              <div className="mb-3 space-y-2">
                <p className="text-xs font-medium text-simmonds-stone">Uploaded Files:</p>
                {existingMaterials.map((material) => (
                  <div key={material._id} className="flex items-center gap-2 p-2 bg-simmonds-lime/10 rounded-lg">
                    <span className="text-lg">{getFileIcon(material.fileType)}</span>
                    <div className="flex-1 min-w-0">
                      {material.url ? (
                        <a
                          href={material.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-simmonds-primary hover:underline truncate block"
                        >
                          {material.fileName}
                        </a>
                      ) : (
                        <span className="text-sm font-medium text-simmonds-charcoal truncate block">
                          {material.fileName}
                        </span>
                      )}
                      <span className="text-xs text-simmonds-stone">{formatFileSize(material.fileSize)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteMaterial(material._id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                      title="Delete file"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Links Section */}
            <p className="text-xs text-simmonds-stone mb-1">Or add external links (one per line):</p>
            <textarea
              value={formData.materials}
              onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:ring-2 focus:ring-simmonds-primary/20 focus:border-simmonds-primary"
              rows={3}
              placeholder="https://docs.google.com/document/d/...&#10;https://youtube.com/watch?v=..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-simmonds-cream">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-simmonds-stone hover:bg-simmonds-cream rounded-xl transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-simmonds-primary text-white rounded-xl hover:bg-simmonds-primary-light transition-colors disabled:opacity-50"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LessonsPage;
