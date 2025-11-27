import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';

interface PageComponentProps {
  currentUser: User | null;
  company: Company | null;
}

const TestResults: React.FC<PageComponentProps> = ({ currentUser, company }) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all test sessions for the company
  const testSessions = useQuery(
    api.testSessions.getCompanyTestSessions,
    company ? { companyId: company._id as Id<"companies"> } : 'skip'
  );

  // Fetch all employees to map user IDs to names
  const employees = useQuery(
    api.userManagement.getCompanyEmployees,
    company ? { companyId: company._id as Id<"companies"> } : 'skip'
  );

  const isLoading = testSessions === undefined || employees === undefined;

  // Filter and search logic
  const filteredSessions = (testSessions || []).filter(session => {
    const user = employees?.find(emp => emp._id === session.userId);
    const matchesStatus = filterStatus === 'all' || session.status === filterStatus;
    const matchesLevel = filterLevel === 'all' || session.recommendedLevel === filterLevel;
    const matchesSearch = !searchQuery || 
      user?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user?.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesStatus && matchesLevel && matchesSearch;
  });

  // Calculate statistics
  const stats = {
    total: testSessions?.length || 0,
    completed: testSessions?.filter(s => s.status === 'completed').length || 0,
    inProgress: testSessions?.filter(s => s.status === 'in_progress').length || 0,
    averageScore: testSessions?.filter(s => s.totalScore).length 
      ? Math.round(testSessions.filter(s => s.totalScore).reduce((sum, s) => sum + (s.totalScore || 0), 0) / testSessions.filter(s => s.totalScore).length)
      : 0,
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-simmonds-lime/20 text-simmonds-lime-dark',
      in_progress: 'bg-simmonds-terracotta/20 text-simmonds-terracotta',
      not_started: 'bg-simmonds-cream text-simmonds-stone',
    };
    return styles[status as keyof typeof styles] || styles.not_started;
  };

  const getLevelBadge = (level: string) => {
    const styles = {
      A1: 'bg-simmonds-cream text-simmonds-charcoal',
      A2: 'bg-simmonds-olive/20 text-simmonds-olive',
      B1: 'bg-simmonds-lime/20 text-simmonds-lime-dark',
      B2: 'bg-simmonds-primary/20 text-simmonds-primary',
      C1: 'bg-simmonds-terracotta/20 text-simmonds-terracotta',
      C2: 'bg-simmonds-primary text-white',
    };
    return styles[level as keyof typeof styles] || 'bg-simmonds-cream text-simmonds-stone';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-simmonds-primary mx-auto"></div>
          <p className="mt-4 text-simmonds-stone">Loading test results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-simmonds-charcoal">Test Results Dashboard</h2>
        <p className="text-simmonds-stone">View and analyze student assessment results</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
          <div className="flex items-center">
            <div className="p-3 bg-simmonds-primary/10 rounded-xl">
              <svg className="w-6 h-6 text-simmonds-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-simmonds-stone">Total Tests</p>
              <p className="text-2xl font-bold text-simmonds-charcoal">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
          <div className="flex items-center">
            <div className="p-3 bg-simmonds-lime/20 rounded-xl">
              <svg className="w-6 h-6 text-simmonds-lime-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-simmonds-stone">Completed</p>
              <p className="text-2xl font-bold text-simmonds-charcoal">{stats.completed}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
          <div className="flex items-center">
            <div className="p-3 bg-simmonds-terracotta/20 rounded-xl">
              <svg className="w-6 h-6 text-simmonds-terracotta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-simmonds-stone">In Progress</p>
              <p className="text-2xl font-bold text-simmonds-charcoal">{stats.inProgress}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
          <div className="flex items-center">
            <div className="p-3 bg-simmonds-olive/20 rounded-xl">
              <svg className="w-6 h-6 text-simmonds-olive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-simmonds-stone">Average Score</p>
              <p className="text-2xl font-bold text-simmonds-charcoal">{stats.averageScore}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Level</label>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
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
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('all');
                setFilterLevel('all');
              }}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl text-simmonds-stone hover:bg-simmonds-cream-light transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-simmonds-cream overflow-hidden">
        <div className="px-6 py-4 border-b border-simmonds-cream">
          <h3 className="text-lg font-medium text-simmonds-charcoal">
            Test Results ({filteredSessions.length})
          </h3>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-simmonds-stone" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-simmonds-charcoal">No test results found</h3>
            <p className="mt-1 text-sm text-simmonds-stone">Students haven't taken any tests yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-simmonds-cream">
              <thead className="bg-simmonds-cream-light">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-simmonds-stone uppercase tracking-wider">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-simmonds-stone uppercase tracking-wider">Test Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-simmonds-stone uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-simmonds-stone uppercase tracking-wider">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-simmonds-stone uppercase tracking-wider">Level</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-simmonds-stone uppercase tracking-wider">Questions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-simmonds-cream">
                {filteredSessions.map((session) => {
                  const user = employees?.find(emp => emp._id === session.userId);
                  return (
                    <tr key={session._id} className="hover:bg-simmonds-cream-light transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-simmonds-charcoal">{user?.name || 'Unknown'}</div>
                          <div className="text-sm text-simmonds-stone">{user?.email || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-simmonds-stone">
                        {new Date(session.startedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(session.status)}`}>
                          {session.status === 'in_progress' ? 'In Progress' : 'Completed'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-simmonds-charcoal">
                          {session.totalScore !== undefined ? `${session.totalScore}%` : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {session.recommendedLevel ? (
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getLevelBadge(session.recommendedLevel)}`}>
                            {session.recommendedLevel}
                          </span>
                        ) : (
                          <span className="text-sm text-simmonds-stone">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-simmonds-stone">
                        {session.questionsAnswered} / {session.totalQuestions}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestResults;

