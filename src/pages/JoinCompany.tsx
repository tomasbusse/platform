import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useAuth, SignUp } from '@clerk/clerk-react';
import { api } from '../../convex/_generated/api';

interface JoinCompanyProps {
  token: string;
}

const JoinCompany: React.FC<JoinCompanyProps> = ({ token }) => {
  const { isLoaded, isSignedIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  // Get invitation link details
  const invitationLink = useQuery(api.companyInvitations.getInvitationLinkByToken, { token });
  const acceptInvitationLink = useMutation(api.companyInvitations.acceptInvitationLink);

  // When user signs in, accept the invitation
  useEffect(() => {
    if (isSignedIn && invitationLink && !isAccepting) {
      setIsAccepting(true);
      acceptInvitationLink({ token })
        .then((result) => {
          // If there's a test session, redirect to test taking page
          if (result.testSessionId && result.quizId) {
            window.location.href = `/test/${result.testSessionId}`;
          } else {
            // Otherwise redirect to dashboard
            window.location.href = '/';
          }
        })
        .catch((err) => {
          console.error('Error accepting invitation:', err);
          setError(err.message || 'Failed to join company');
          setIsAccepting(false);
        });
    }
  }, [isSignedIn, invitationLink, token, acceptInvitationLink, isAccepting]);

  // Loading state
  if (!isLoaded || !invitationLink) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-simmonds-primary mx-auto"></div>
          <p className="mt-4 text-simmonds-stone">Loading...</p>
        </div>
      </div>
    );
  }

  // Invalid link
  if (!invitationLink) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <svg className="w-16 h-16 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-simmonds-charcoal mb-2">Invalid Invitation Link</h2>
          <p className="text-simmonds-stone mb-6">
            This invitation link is invalid, expired, or has reached its maximum uses.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-2 bg-simmonds-primary text-white rounded-lg hover:bg-simmonds-primary/90"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  // Already signed in - accepting invitation
  if (isSignedIn && isAccepting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-simmonds-primary mx-auto"></div>
          <p className="mt-4 text-simmonds-stone">Joining {invitationLink.companyName}...</p>
        </div>
      </div>
    );
  }

  // Not signed in - show sign up
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
            Join {invitationLink.companyName}
          </h1>
          <p className="text-simmonds-stone">
            Sign up to join as a {invitationLink.role}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <SignUp
          routing="hash"
          signInUrl="#"
          afterSignUpUrl="/"
        />
      </div>
    </div>
  );
};

export default JoinCompany;

