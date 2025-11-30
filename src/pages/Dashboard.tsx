/**
 * Dashboard.tsx - Main Dashboard Component
 *
 * Navigation consolidation: "Teaching" and "Take Test" links have been merged into "Tests"
 * See docs/TESTS_MODULE_CHANGELOG.md for rollback instructions
 *
 * Updated: November 28, 2025
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { User, Company, DashboardStats } from '../types';
import UserManagement from '../components/UserManagement';
import CompanyRegistrationForm from '../components/CompanyRegistrationForm';
import RecentMaterialsWidget from '../components/RecentMaterialsWidget';
import MobileMenu from '../components/MobileMenu';
import TestResults from './TestResults';
import LearningManagement from './LearningManagement';
import EmailSystem from './EmailSystem';
import SettingsPage from './SettingsPage';
import CompanyManagement from './CompanyManagement';
import LessonsPage from './LessonsPage';
import StudentDashboard from './StudentDashboard';
import MaterialsPage from './MaterialsPage';
import TestsPage from './TestsPage'; // New unified Tests page

interface DashboardProps {
  currentUser: User | null;
  company: Company | null;
  onLogout: () => void;
}

// Icon components for sidebar
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const TestIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const LearnIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const EmailIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const LogoutIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const BuildingIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const LessonsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const MaterialsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const Dashboard: React.FC<DashboardProps> = ({ currentUser, company, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const registerCompany = useMutation(api.userManagement.registerCompany);

  const stats = useQuery(
    api.dashboard.getDashboardStats,
    company ? { companyId: company._id as any } : 'skip'
  );

  const isLoading = stats === undefined;

  const handleCompanyRegistration = async (formData: any) => {
    try {
      await registerCompany({
        name: formData.name,
        contactEmail: formData.contactEmail,
      });

      alert('Company registration successful! Please check your email for login details.');
    } catch (error) {
      console.error('Error registering company:', error);
      alert('Registration failed. Please try again.');
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'corporate_admin': return 'Corporate Admin';
      case 'admin': return 'Administrator';
      case 'teacher': return 'Teacher';
      case 'student': return 'Student';
      default: return role;
    }
  };

  const isStudent = currentUser?.role === 'student';

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        // Show student-specific dashboard for students
        if (isStudent && currentUser && company) {
          return <StudentDashboard currentUser={currentUser} company={company} />;
        }
        // Admin/Teacher overview
        return (
          <div className="space-y-6">
            {/* Welcome Message */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
              <h2 className="text-2xl font-bold text-simmonds-charcoal mb-2">
                Welcome back, {currentUser?.name}!
              </h2>
              <p className="text-simmonds-stone">
                {company && `${company.name} - ${getRoleDisplayName(currentUser?.role || '')}`}
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream hover:shadow-md transition-shadow">
                <div className="flex items-center">
                  <div className="p-3 bg-simmonds-primary/10 rounded-xl">
                    <svg className="w-6 h-6 text-simmonds-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-simmonds-stone">Total Learners</p>
                    <p className="text-2xl font-bold text-simmonds-charcoal">{stats?.totalEmployees || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream hover:shadow-md transition-shadow">
                <div className="flex items-center">
                  <div className="p-3 bg-simmonds-lime/20 rounded-xl">
                    <svg className="w-6 h-6 text-simmonds-lime-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-simmonds-stone">Active Learners</p>
                    <p className="text-2xl font-bold text-simmonds-charcoal">{stats?.activeEmployees || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream hover:shadow-md transition-shadow">
                <div className="flex items-center">
                  <div className="p-3 bg-simmonds-olive/20 rounded-xl">
                    <svg className="w-6 h-6 text-simmonds-olive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-simmonds-stone">Learning Groups</p>
                    <p className="text-2xl font-bold text-simmonds-charcoal">{stats?.totalGroups || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream hover:shadow-md transition-shadow">
                <div className="flex items-center">
                  <div className="p-3 bg-simmonds-terracotta/20 rounded-xl">
                    <svg className="w-6 h-6 text-simmonds-terracotta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-simmonds-stone">Average Score</p>
                    <p className="text-2xl font-bold text-simmonds-charcoal">{stats?.averageScore || 0}%</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream hover:shadow-md transition-shadow">
                <div className="flex items-center">
                  <div className="p-3 bg-simmonds-primary/10 rounded-xl">
                    <svg className="w-6 h-6 text-simmonds-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-simmonds-stone">Completed Tests</p>
                    <p className="text-2xl font-bold text-simmonds-charcoal">{stats?.completedTests || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream hover:shadow-md transition-shadow">
                <div className="flex items-center">
                  <div className="p-3 bg-simmonds-lime/20 rounded-xl">
                    <svg className="w-6 h-6 text-simmonds-lime-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-simmonds-stone">Pending Invitations</p>
                    <p className="text-2xl font-bold text-simmonds-charcoal">{stats?.pendingInvitations || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Materials Widget */}
            <div className="mt-6">
              <RecentMaterialsWidget currentUser={currentUser} company={company} isTeacher={isTeacher} />
            </div>
          </div>
        );

      case 'employees':
        return company ? <UserManagement companyId={company._id} currentUserId={currentUser?._id} company={company} /> : <div>No company data</div>;

      // Consolidated Tests page - replaces both 'test-taking' and 'teacher-tools'
      case 'tests':
        return <TestsPage currentUser={currentUser} company={company} />;

      case 'test-results':
        return <TestResults currentUser={currentUser} company={company} />;

      case 'learning-mgmt':
        return <LearningManagement currentUser={currentUser} company={company} />;

      case 'lessons':
        return <LessonsPage currentUser={currentUser} company={company} />;

      case 'materials':
        return <MaterialsPage currentUser={currentUser} company={company} />;

      case 'email-system':
        return <EmailSystem currentUser={currentUser} company={company} />;

      case 'settings':
        return <SettingsPage currentUser={currentUser} company={company} />;

      case 'companies':
        return <CompanyManagement currentUser={currentUser} />;

      case 'register-company':
        return <CompanyRegistrationForm onSubmit={handleCompanyRegistration} />;

      default:
        return <div>Content not found</div>;
    }
  };

  if (!currentUser) {
    // This should never happen as App.tsx handles auth state
    return null;
  }

  // Rationalized navigation - grouped into logical sections
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'corporate_admin';
  const isSuperAdmin = currentUser.role === 'admin' || currentUser.role === 'corporate_admin'; // Admin roles can manage companies
  const isTeacher = currentUser.role === 'teacher' || isAdmin;

  // Navigation items - "Teaching" and "Take Test" consolidated into "Tests"
  // See docs/TESTS_MODULE_CHANGELOG.md for rollback instructions
  const navItems = [
    { id: 'overview', name: 'Dashboard', icon: HomeIcon, show: true },
    { id: 'lessons', name: 'Lessons', icon: LessonsIcon, show: true },
    { id: 'materials', name: 'Materials', icon: MaterialsIcon, show: true },
    { id: 'tests', name: 'Tests', icon: TestIcon, show: true }, // Consolidated: replaces 'test-taking' and 'teacher-tools'
    { id: 'learning-mgmt', name: 'Learning', icon: LearnIcon, show: true },
    { id: 'test-results', name: 'Results', icon: ChartIcon, show: isTeacher },
    { id: 'email-system', name: 'Messages', icon: EmailIcon, show: isTeacher },
    { id: 'employees', name: 'Users', icon: UsersIcon, show: isAdmin },
    { id: 'companies', name: 'Companies', icon: BuildingIcon, show: isSuperAdmin },
  ].filter(item => item.show);

  return (
    <div className="min-h-screen bg-simmonds-cream-lighter flex">
      {/* Mobile Menu */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        navItems={navItems}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={onLogout}
        getRoleDisplayName={getRoleDisplayName}
      />

      {/* Sidebar - Hidden on mobile */}
      <aside className={`hidden lg:flex ${sidebarOpen ? 'w-64' : 'w-20'} bg-simmonds-cream-lighter min-h-screen transition-all duration-300 flex-col border-r border-simmonds-cream`}>
        {/* Logo/Brand */}
        <div className="p-4 border-b border-simmonds-cream">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-simmonds-primary rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="text-simmonds-primary font-bold text-lg">Simmonds</h1>
                <p className="text-simmonds-stone text-xs">Language Services</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 ${
                  activeTab === item.id
                    ? 'bg-simmonds-primary text-white font-medium'
                    : 'text-simmonds-primary hover:bg-simmonds-cream'
                }`}
              >
                <Icon />
                {sidebarOpen && <span>{item.name}</span>}
              </button>
            );
          })}
        </nav>

        {/* User Profile & Settings */}
        <div className="p-4 border-t border-simmonds-cream space-y-2">
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 ${
              activeTab === 'settings'
                ? 'bg-simmonds-primary text-white font-medium'
                : 'text-simmonds-primary hover:bg-simmonds-cream'
            }`}
          >
            <SettingsIcon />
            {sidebarOpen && <span>Settings</span>}
          </button>

          {sidebarOpen && (
            <div className="px-3 py-3">
              <p className="text-simmonds-charcoal font-medium text-sm truncate">{currentUser.name}</p>
              <p className="text-simmonds-stone text-xs">{getRoleDisplayName(currentUser.role)}</p>
            </div>
          )}

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-simmonds-terracotta hover:bg-simmonds-terracotta/10 transition-all duration-200"
          >
            <LogoutIcon />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white shadow-sm px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-simmonds-cream transition-colors text-simmonds-charcoal"
                aria-label="Open menu"
              >
                <MenuIcon />
              </button>
              {/* Desktop sidebar toggle */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden lg:block p-2 rounded-lg hover:bg-simmonds-cream transition-colors text-simmonds-charcoal"
              >
                <MenuIcon />
              </button>
              {/* Mobile logo */}
              <div className="lg:hidden flex items-center gap-2">
                <div className="w-8 h-8 bg-simmonds-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
              </div>
              <div className="hidden sm:block">
                <h2 className="text-lg sm:text-xl font-bold text-simmonds-charcoal">
                  {navItems.find(n => n.id === activeTab)?.name || 'Settings'}
                </h2>
                {company && (
                  <p className="text-xs sm:text-sm text-simmonds-stone">{company.name}</p>
                )}
              </div>
            </div>
            {/* Mobile page title - right side */}
            <div className="sm:hidden text-right">
              <h2 className="text-base font-bold text-simmonds-charcoal">
                {navItems.find(n => n.id === activeTab)?.name || 'Settings'}
              </h2>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-simmonds-primary"></div>
            </div>
          ) : (
            renderTabContent()
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;