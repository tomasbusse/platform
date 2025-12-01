import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';

interface LessonsDashboardWidgetProps {
  currentUser: User;
  company: Company;
  isTeacher?: boolean;
  onViewLesson?: (lessonId: string, lessonType: 'scheduled' | 'virtual') => void;
  onCreateLesson?: (lessonType: 'scheduled' | 'virtual') => void;
  onEditLesson?: (lessonId: string, lessonType: 'scheduled' | 'virtual') => void;
  onDeleteLesson?: (lessonId: string, lessonType: 'scheduled' | 'virtual') => void;
}

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString();

  if (isToday) {
    return `Today, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (isTomorrow) {
    return `Tomorrow, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

const getLevelColor = (level: string) => {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    A1: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    A2: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
    B1: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
    B2: { bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-300' },
    C1: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
    C2: { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300' },
  };
  return colors[level] || { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' };
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'document':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'video':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    case 'audio':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      );
    case 'image':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'link':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
  }
};

// Type icons
const ScheduledLessonIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const VirtualLessonIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const AIBadge = () => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-medium rounded-full">
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
    AI
  </span>
);

interface MaterialBadgeProps {
  count: number;
}

const MaterialBadge: React.FC<MaterialBadgeProps> = ({ count }) => {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-simmonds-cream text-simmonds-charcoal text-xs font-medium rounded-full">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
      {count}
    </span>
  );
};

// Lesson card component with materials
interface LessonCardProps {
  lesson: any;
  type: 'scheduled' | 'virtual';
  materials: any[];
  progress?: any;
  isTeacher: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const LessonCard: React.FC<LessonCardProps> = ({
  lesson,
  type,
  materials,
  progress,
  isTeacher,
  onClick,
  onEdit,
  onDelete,
}) => {
  const [expanded, setExpanded] = useState(false);
  const levelColors = getLevelColor(lesson.level);
  const isVirtual = type === 'virtual';
  const isScheduled = type === 'scheduled';

  const progressPercent = progress && isVirtual
    ? Math.round((progress.completedSections?.length || 0) / (lesson.sections?.length || 1) * 100)
    : 0;

  return (
    <div
      className={`bg-white rounded-xl border border-simmonds-cream overflow-hidden transition-all duration-200 hover:shadow-md hover:border-simmonds-primary/30 ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Card Header */}
      <div className="p-4" onClick={onClick}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Icon */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${isVirtual ? 'bg-gradient-to-br from-purple-100 to-indigo-100 text-purple-600' : 'bg-simmonds-primary/10 text-simmonds-primary'}`}>
              {isVirtual ? <VirtualLessonIcon /> : <ScheduledLessonIcon />}
            </div>

            {/* Title and meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-semibold text-simmonds-charcoal truncate">{lesson.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${levelColors.bg} ${levelColors.text} ${levelColors.border}`}>
                  {lesson.level}
                </span>
                {isVirtual && lesson.generatedWithModel && <AIBadge />}
              </div>
              <p className="text-sm text-simmonds-stone line-clamp-1">{lesson.topic || lesson.description}</p>
            </div>
          </div>

          {/* Right side badges and actions */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <MaterialBadge count={materials.length} />
            {isTeacher && onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-1.5 rounded-lg text-simmonds-stone hover:text-simmonds-primary hover:bg-simmonds-cream transition-colors"
                title="Edit lesson"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {isTeacher && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1.5 rounded-lg text-simmonds-stone hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Delete lesson"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Meta info row */}
        <div className="flex items-center gap-4 text-xs text-simmonds-stone">
          {isScheduled && lesson.scheduledDate && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDate(lesson.scheduledDate)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatDuration(lesson.duration || lesson.estimatedDuration)}
          </span>
          {isVirtual && lesson.sections && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {lesson.sections.length} sections
            </span>
          )}
          {isScheduled && lesson.locationType === 'online' && lesson.meetingLink && (
            <a
              href={lesson.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-simmonds-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Join Meeting
            </a>
          )}
        </div>

        {/* Progress bar for virtual lessons */}
        {isVirtual && !isTeacher && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-simmonds-stone mb-1">
              <span>{progress?.status === 'completed' ? 'Completed' : progress?.status === 'in_progress' ? 'In Progress' : 'Not Started'}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-simmonds-cream rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${progressPercent === 100 ? 'bg-simmonds-lime' : 'bg-simmonds-primary'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Materials section (expandable) */}
      {materials.length > 0 && (
        <div className="border-t border-simmonds-cream/50">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="w-full px-4 py-2 flex items-center justify-between text-xs font-medium text-simmonds-stone hover:bg-simmonds-cream/30 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {materials.length} Material{materials.length !== 1 ? 's' : ''}
            </span>
            <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded && (
            <div className="px-4 pb-3 space-y-2">
              {materials.map((material) => (
                <a
                  key={material._id}
                  href={material.url || material.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded-lg bg-simmonds-cream/30 hover:bg-simmonds-cream/60 transition-colors group"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                    material.category === 'video' ? 'bg-red-100 text-red-600' :
                    material.category === 'audio' ? 'bg-purple-100 text-purple-600' :
                    material.category === 'image' ? 'bg-blue-100 text-blue-600' :
                    material.category === 'link' ? 'bg-green-100 text-green-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {getCategoryIcon(material.category)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-simmonds-charcoal truncate group-hover:text-simmonds-primary">
                      {material.title || material.fileName}
                    </p>
                    {material.description && (
                      <p className="text-xs text-simmonds-stone truncate">{material.description}</p>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-simmonds-stone group-hover:text-simmonds-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const LessonsDashboardWidget: React.FC<LessonsDashboardWidgetProps> = ({
  currentUser,
  company,
  isTeacher = false,
  onViewLesson,
  onCreateLesson,
  onEditLesson,
  onDeleteLesson,
}) => {
  const [viewMode, setViewMode] = useState<'all' | 'scheduled' | 'virtual'>('all');

  // Fetch scheduled lessons
  const scheduledLessons = useQuery(
    isTeacher
      ? api.lessons.getCompanyScheduledLessons
      : api.lessons.getStudentScheduledLessons,
    isTeacher
      ? { companyId: company._id as Id<"companies"> }
      : {
          studentId: currentUser._id as string,
          companyId: company._id as Id<"companies">,
          status: 'scheduled',
        }
  );

  // Fetch virtual lessons
  const virtualLessons = useQuery(
    isTeacher
      ? api.lessons.getCompanyVirtualLessons
      : api.lessons.getStudentVirtualLessons,
    isTeacher
      ? { companyId: company._id as Id<"companies"> }
      : {
          studentId: currentUser._id as string,
          companyId: company._id as Id<"companies">,
        }
  );

  // Fetch lesson progress for students
  const lessonProgress = useQuery(
    api.lessons.getStudentLessonProgress,
    !isTeacher
      ? {
          userId: currentUser._id as string,
          companyId: company._id as Id<"companies">,
        }
      : 'skip'
  );

  // Fetch materials for user
  const materials = useQuery(api.materials.getMaterialsForUser, {
    companyId: company._id as Id<"companies">,
    userId: currentUser._id as Id<"users">,
    groupIds: (currentUser.groupIds || []) as Id<"groups">[],
  });

  const isLoading = scheduledLessons === undefined || virtualLessons === undefined;

  // Get scheduled lessons
  const now = Date.now();
  const daysAhead = isTeacher ? 30 : 7; // Teachers see more days ahead
  const futureLimit = now + daysAhead * 24 * 60 * 60 * 1000;

  // For teachers: show all recent + upcoming lessons (for management)
  // For students: show only upcoming scheduled lessons
  const upcomingScheduled = isTeacher
    ? (scheduledLessons || [])
        .sort((a: any, b: any) => b.scheduledDate - a.scheduledDate) // Most recent first for teachers
        .slice(0, 6)
    : (scheduledLessons || [])
        .filter((l: any) => l.scheduledDate >= now && l.scheduledDate <= futureLimit && l.status === 'scheduled')
        .sort((a: any, b: any) => a.scheduledDate - b.scheduledDate)
        .slice(0, 6);

  const recentVirtual = (virtualLessons || [])
    .sort((a: any, b: any) => b.createdAt - a.createdAt)
    .slice(0, 6);

  // Get materials for a specific lesson
  const getMaterialsForLesson = (lessonId: string, lessonType: 'scheduled' | 'virtual') => {
    if (!materials) return [];
    return materials.filter((m: any) =>
      lessonType === 'scheduled'
        ? m.scheduledLessonId === lessonId
        : m.virtualLessonId === lessonId
    );
  };

  // Get progress for a virtual lesson
  const getProgressForLesson = (lessonId: string) => {
    if (!lessonProgress) return undefined;
    return lessonProgress.find((p: any) => p.virtualLessonId === lessonId);
  };

  // Combined lessons for "all" view
  const combinedLessons = [...upcomingScheduled.map((l: any) => ({ ...l, _type: 'scheduled' as const })), ...recentVirtual.map((l: any) => ({ ...l, _type: 'virtual' as const }))]
    .sort((a, b) => {
      // Sort by date: scheduled by scheduledDate, virtual by createdAt
      const aDate = a._type === 'scheduled' ? a.scheduledDate : a.createdAt;
      const bDate = b._type === 'scheduled' ? b.scheduledDate : b.createdAt;
      return bDate - aDate;
    })
    .slice(0, 6);

  const displayLessons = viewMode === 'all' ? combinedLessons : viewMode === 'scheduled' ? upcomingScheduled.map((l: any) => ({ ...l, _type: 'scheduled' as const })) : recentVirtual.map((l: any) => ({ ...l, _type: 'virtual' as const }));

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-simmonds-cream p-6">
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-simmonds-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-simmonds-cream overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-simmonds-cream">
        <div className="flex flex-col gap-3">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-simmonds-charcoal flex items-center gap-2">
              <svg className="w-5 h-5 text-simmonds-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {isTeacher ? 'Lessons' : 'My Lessons'}
            </h2>

            {/* Teacher action buttons */}
            {isTeacher && onCreateLesson && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onCreateLesson('scheduled')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-simmonds-primary bg-simmonds-primary/10 hover:bg-simmonds-primary/20 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Schedule</span>
                </button>
                <button
                  onClick={() => onCreateLesson('virtual')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="hidden sm:inline">AI Lesson</span>
                </button>
              </div>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex bg-simmonds-cream/50 rounded-lg p-1 text-sm w-fit">
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1.5 rounded-md transition-colors ${viewMode === 'all' ? 'bg-white shadow-sm text-simmonds-charcoal font-medium' : 'text-simmonds-stone hover:text-simmonds-charcoal'}`}
            >
              All
            </button>
            <button
              onClick={() => setViewMode('scheduled')}
              className={`px-3 py-1.5 rounded-md transition-colors ${viewMode === 'scheduled' ? 'bg-white shadow-sm text-simmonds-charcoal font-medium' : 'text-simmonds-stone hover:text-simmonds-charcoal'}`}
            >
              Scheduled
            </button>
            <button
              onClick={() => setViewMode('virtual')}
              className={`px-3 py-1.5 rounded-md transition-colors ${viewMode === 'virtual' ? 'bg-white shadow-sm text-simmonds-charcoal font-medium' : 'text-simmonds-stone hover:text-simmonds-charcoal'}`}
            >
              Virtual
            </button>
          </div>
        </div>
      </div>

      {/* Lessons grid */}
      <div className="p-4 sm:p-5">
        {displayLessons.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-simmonds-cream flex items-center justify-center">
              <svg className="w-8 h-8 text-simmonds-stone" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-simmonds-stone mb-4">
              {viewMode === 'scheduled' ? 'No scheduled lessons yet' : viewMode === 'virtual' ? 'No virtual lessons yet' : 'No lessons to display'}
            </p>
            {isTeacher && onCreateLesson && (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => onCreateLesson('scheduled')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-simmonds-primary bg-simmonds-primary/10 hover:bg-simmonds-primary/20 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Schedule a Lesson
                </button>
                <button
                  onClick={() => onCreateLesson('virtual')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Create AI Lesson
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayLessons.map((lesson: any) => (
              <LessonCard
                key={lesson._id}
                lesson={lesson}
                type={lesson._type}
                materials={getMaterialsForLesson(lesson._id, lesson._type)}
                progress={lesson._type === 'virtual' ? getProgressForLesson(lesson._id) : undefined}
                isTeacher={isTeacher}
                onClick={onViewLesson ? () => onViewLesson(lesson._id, lesson._type) : undefined}
                onEdit={onEditLesson ? () => onEditLesson(lesson._id, lesson._type) : undefined}
                onDelete={onDeleteLesson ? () => onDeleteLesson(lesson._id, lesson._type) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with view all link */}
      {(upcomingScheduled.length > 0 || recentVirtual.length > 0) && (
        <div className="px-4 sm:px-5 py-3 border-t border-simmonds-cream bg-simmonds-cream/20">
          <button
            onClick={() => onViewLesson?.('', 'scheduled')}
            className="text-sm text-simmonds-primary hover:underline font-medium"
          >
            View all lessons &rarr;
          </button>
        </div>
      )}
    </div>
  );
};

export default LessonsDashboardWidget;
