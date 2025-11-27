import React, { useState, useEffect } from 'react';
import { useQuery, useConvexAuth } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '../convex/_generated/api';
import Dashboard from './pages/Dashboard';
import LoginForm from './components/LoginForm';
import SeedAdmin from './pages/SeedAdmin';
import PublicAssessment from './pages/PublicAssessment';

const App: React.FC = () => {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const [showSeedPage, setShowSeedPage] = useState(false);
  const [assessmentToken, setAssessmentToken] = useState<string | null>(null);

  // Get the current authenticated user (only when authenticated)
  const currentUser = useQuery(
    api.auth.currentUser,
    isAuthenticated ? {} : "skip"
  );
  const company = useQuery(
    api.auth.currentUserCompany,
    isAuthenticated ? {} : "skip"
  );

  // Debug: log identity
  const identity = useQuery(
    api.debug.getIdentity,
    isAuthenticated ? {} : "skip"
  );

  useEffect(() => {
    if (isAuthenticated) {
      console.log("Identity:", identity);
      console.log("Current User:", currentUser);
      console.log("Company:", company);
    }
  }, [isAuthenticated, identity, currentUser, company]);

  useEffect(() => {
    // Check if URL is for public assessment (/assessment/:token)
    const path = window.location.pathname;
    const assessmentMatch = path.match(/^\/assessment\/([a-zA-Z0-9]+)$/);
    if (assessmentMatch) {
      setAssessmentToken(assessmentMatch[1]);
      return;
    }

    // Check if URL has ?seed=admin parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('seed') === 'admin') {
      setShowSeedPage(true);
      return;
    }
  }, []);

  const handleLogout = async () => {
    await signOut();
  };

  // Show seed admin page if requested
  if (showSeedPage) {
    return <SeedAdmin />;
  }

  // Show public assessment page (no login required)
  if (assessmentToken) {
    return <PublicAssessment token={assessmentToken} />;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-simmonds-primary mx-auto"></div>
          <p className="mt-4 text-simmonds-stone">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <LoginForm />
      </div>
    );
  }

  // Authenticated but loading user data
  if (currentUser === undefined || company === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-simmonds-primary mx-auto"></div>
          <p className="mt-4 text-simmonds-stone">Loading user data...</p>
        </div>
      </div>
    );
  }

  // Authenticated with user and company data
  if (currentUser && company) {
    return (
      <Dashboard
        currentUser={currentUser as any}
        company={company as any}
        onLogout={handleLogout}
      />
    );
  }

  // Authenticated but missing user/company setup
  return (
    <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center">
      <div className="text-center max-w-md p-8">
        <h2 className="text-xl font-bold text-simmonds-charcoal mb-4">Account Setup Required</h2>
        <p className="text-simmonds-stone mb-6">
          Your account has been created but hasn't been assigned to a company yet.
          Please contact your administrator to complete your account setup.
        </p>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-simmonds-primary text-white rounded-lg hover:bg-simmonds-primary/90"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default App;
