import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';
import GroupManagement from '../components/GroupManagement';

interface PageComponentProps {
  currentUser: User | null;
  company: Company | null;
}

const LearningManagement: React.FC<PageComponentProps> = ({ currentUser, company }) => {
  const [activeTab, setActiveTab] = useState('overview');

  // Get user's progress from Convex
  const progressData = useQuery(
    api.progress.getUserProgress,
    currentUser?._id ? { userId: currentUser._id as Id<"users"> } : 'skip'
  );

  // Get user's test history
  const testSessions = useQuery(
    api.testSessions.getUserTestSessions,
    currentUser?._id ? { userId: currentUser._id as Id<"users"> } : 'skip'
  );

  // Get groups for the user
  const userGroups = useQuery(
    api.groups.getCompanyGroups,
    company?._id ? { companyId: company._id as Id<"companies">, isActive: true } : 'skip'
  );

  // Find which group the user is in
  const myGroup = userGroups?.find(g => g.studentIds?.includes(currentUser?._id || ''));

  const isTeacherOrAdmin = currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'corporate_admin';

  // Handle case when currentUser is null
  if (!currentUser) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-simmonds-charcoal mb-2">Learning Management</h1>
          <p className="text-simmonds-stone">Track your progress and manage your learning journey</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-simmonds-stone">Please log in to view your learning progress.</p>
        </div>
      </div>
    );
  }

  const renderStudentProgress = () => (
    <div className="space-y-6">
      {/* Progress Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Current Level</p>
          <p className="text-2xl font-bold text-simmonds-primary">
            {progressData?.currentLevel || currentUser.currentLevel || 'Not set'}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Overall Score</p>
          <p className="text-2xl font-bold text-simmonds-lime-dark">
            {progressData?.overallScore || currentUser.averageScore || 0}%
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Tests Completed</p>
          <p className="text-2xl font-bold text-simmonds-olive">
            {progressData?.totalSessions || currentUser.completedTests || 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Learning Streak</p>
          <p className="text-2xl font-bold text-simmonds-terracotta">
            {progressData?.streakDays || 0} days
          </p>
        </div>
      </div>

      {/* My Group */}
      {myGroup && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
          <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">My Group</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-bold text-simmonds-charcoal">{myGroup.name}</p>
              <p className="text-simmonds-stone">{myGroup.description}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="px-3 py-1 bg-simmonds-primary/10 text-simmonds-primary rounded-full text-sm font-medium">
                  {myGroup.level}
                </span>
                <span className="text-sm text-simmonds-stone">
                  {myGroup.currentStudentCount} students
                </span>
                {myGroup.scheduleInfo && (
                  <span className="text-sm text-simmonds-stone">
                    Schedule: {myGroup.scheduleInfo}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Skill Breakdown */}
      {progressData?.skillScores && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
          <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Skill Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(progressData.skillScores).map(([skill, score]) => (
              <div key={skill} className="text-center">
                <div className="relative w-20 h-20 mx-auto">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#e6e6e6"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#2D5A27"
                      strokeWidth="3"
                      strokeDasharray={`${score}, 100`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-simmonds-charcoal">{score}%</span>
                  </div>
                </div>
                <p className="mt-2 text-sm font-medium text-simmonds-charcoal capitalize">{skill}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Test History */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Recent Test History</h3>
        {!testSessions || testSessions.length === 0 ? (
          <p className="text-simmonds-stone">No tests completed yet. Take a placement test to get started!</p>
        ) : (
          <div className="space-y-3">
            {testSessions.slice(0, 5).map((session) => (
              <div
                key={session._id}
                className="flex items-center justify-between p-4 bg-simmonds-cream-light rounded-xl"
              >
                <div>
                  <p className="font-medium text-simmonds-charcoal">{session.testId}</p>
                  <p className="text-sm text-simmonds-stone">
                    {new Date(session.startedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`font-bold ${
                      (session.percentageScore || 0) >= 70 ? 'text-simmonds-lime-dark' :
                      (session.percentageScore || 0) >= 50 ? 'text-yellow-600' : 'text-simmonds-terracotta'
                    }`}>
                      {session.percentageScore || 0}%
                    </p>
                    {session.recommendedLevel && (
                      <p className="text-sm text-simmonds-stone">Level: {session.recommendedLevel}</p>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    session.status === 'completed' ? 'bg-simmonds-lime/20 text-simmonds-lime-dark' :
                    session.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-simmonds-cream text-simmonds-stone'
                  }`}>
                    {session.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Learning Recommendations */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Recommendations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-simmonds-primary/10 rounded-xl">
            <h4 className="font-semibold text-simmonds-primary mb-2">Next Steps</h4>
            <ul className="text-sm text-simmonds-charcoal space-y-1">
              <li>Complete the {progressData?.currentLevel || 'A1'} grammar exercises</li>
              <li>Practice listening skills with audio exercises</li>
              <li>Take a progress test to track improvement</li>
            </ul>
          </div>
          <div className="p-4 bg-simmonds-olive/10 rounded-xl">
            <h4 className="font-semibold text-simmonds-olive mb-2">Focus Areas</h4>
            <ul className="text-sm text-simmonds-charcoal space-y-1">
              {progressData?.skillScores ? (
                Object.entries(progressData.skillScores)
                  .sort(([, a], [, b]) => (a as number) - (b as number))
                  .slice(0, 2)
                  .map(([skill]) => (
                    <li key={skill} className="capitalize">Improve {skill} skills</li>
                  ))
              ) : (
                <>
                  <li>Take a placement test to identify focus areas</li>
                  <li>Complete lessons to build your skills</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = isTeacherOrAdmin
    ? [
        { id: 'overview', name: 'My Progress' },
        { id: 'groups', name: 'Group Management' },
      ]
    : [
        { id: 'overview', name: 'My Progress' },
      ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-simmonds-charcoal mb-2">Learning Management</h1>
        <p className="text-simmonds-stone">
          {isTeacherOrAdmin
            ? 'Track student progress and manage learning groups'
            : 'Track your progress and manage your learning journey'}
        </p>
      </div>

      {isTeacherOrAdmin && (
        <div className="mb-6">
          <nav className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                  activeTab === tab.id
                    ? 'bg-simmonds-primary text-white'
                    : 'bg-simmonds-cream text-simmonds-charcoal hover:bg-simmonds-cream-light'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      )}

      {activeTab === 'overview' && renderStudentProgress()}
      {activeTab === 'groups' && isTeacherOrAdmin && (
        <GroupManagement currentUser={currentUser} company={company} />
      )}
    </div>
  );
};

export default LearningManagement;
