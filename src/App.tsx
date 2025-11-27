import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useAuth, useClerk, SignIn, SignUp } from '@clerk/clerk-react';
import { api } from '../convex/_generated/api';
import Dashboard from './pages/Dashboard';
import SeedAdmin from './pages/SeedAdmin';
import PublicAssessment from './pages/PublicAssessment';

const App: React.FC = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [showSeedPage, setShowSeedPage] = useState(false);
  const [assessmentToken, setAssessmentToken] = useState<string | null>(null);
  const [showSignUp, setShowSignUp] = useState(false);
  const [isEnsuring, setIsEnsuring] = useState(false);

  // Mutation to auto-create user in Convex when they sign in with Clerk
  const ensureUser = useMutation(api.auth.ensureUser);

  // Get the current authenticated user (only when authenticated)
  const currentUser = useQuery(
    api.auth.currentUser,
    isSignedIn ? {} : "skip"
  );
  const company = useQuery(
    api.auth.currentUserCompany,
    isSignedIn ? {} : "skip"
  );

  // Auto-ensure user exists in Convex when signed in with Clerk
  useEffect(() => {
    if (isSignedIn && currentUser === null && !isEnsuring) {
      setIsEnsuring(true);
      ensureUser({})
        .then((result) => {
          console.log("User ensured in Convex:", result);
          setIsEnsuring(false);
        })
        .catch((error) => {
          console.error("Failed to ensure user:", error);
          setIsEnsuring(false);
        });
    }
  }, [isSignedIn, currentUser, ensureUser, isEnsuring]);

  useEffect(() => {
    if (isSignedIn) {
      console.log("Current User:", currentUser);
      console.log("Company:", company);
    }
  }, [isSignedIn, currentUser, company]);

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
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-simmonds-primary mx-auto"></div>
          <p className="mt-4 text-simmonds-stone">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show Clerk sign in/up
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="mb-8 text-center">
            <div className="w-16 h-16 bg-simmonds-primary rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-simmonds-charcoal mb-2">
              Simmonds Language Services
            </h1>
          </div>
          {showSignUp ? (
            <div>
              <SignUp
                routing="hash"
                signInUrl="#"
                afterSignUpUrl="/"
              />
              <p className="text-center mt-4 text-simmonds-stone">
                Already have an account?{' '}
                <button
                  onClick={() => setShowSignUp(false)}
                  className="text-simmonds-primary hover:text-simmonds-primary/80 font-medium"
                >
                  Sign in
                </button>
              </p>
            </div>
          ) : (
            <div>
              <SignIn
                routing="hash"
                signUpUrl="#"
                afterSignInUrl="/"
              />
              <p className="text-center mt-4 text-simmonds-stone">
                Don't have an account?{' '}
                <button
                  onClick={() => setShowSignUp(true)}
                  className="text-simmonds-primary hover:text-simmonds-primary/80 font-medium"
                >
                  Sign up
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Authenticated but loading user data or ensuring user exists
  if (currentUser === undefined || company === undefined || isEnsuring) {
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
