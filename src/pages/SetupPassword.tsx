import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '../../convex/_generated/api';

interface SetupPasswordProps {
  token: string;
}

const SetupPassword: React.FC<SetupPasswordProps> = ({ token }) => {
  const { signIn } = useAuthActions();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Query invitation details
  const invitationData = useQuery(api.userManagement.getInvitationByToken, { token });
  const acceptInvitation = useMutation(api.userManagement.acceptInvitation);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate password
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!invitationData || 'error' in invitationData) {
      setError('Invalid invitation');
      return;
    }

    setIsLoading(true);

    try {
      // Sign up with the email from invitation
      await signIn('password', {
        email: invitationData.invitation.email,
        password,
        flow: 'signUp',
      });

      // Accept the invitation (this merges the user records)
      await acceptInvitation({ token });

      setIsComplete(true);
    } catch (err: any) {
      console.error('Error setting up password:', err);
      setError(err.message || 'Failed to set up password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while fetching invitation
  if (invitationData === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-simmonds-primary mx-auto"></div>
          <p className="mt-4 text-simmonds-stone">Loading invitation...</p>
        </div>
      </div>
    );
  }

  // Show error if invitation is invalid
  if ('error' in invitationData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-simmonds-cream p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-simmonds-charcoal mb-2">Invalid Invitation</h2>
          <p className="text-simmonds-stone mb-6">{invitationData.error}</p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-simmonds-primary text-white rounded-lg hover:bg-simmonds-primary/90"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  // Show success message
  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-simmonds-cream p-8 text-center">
          <div className="w-16 h-16 bg-simmonds-lime/20 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-simmonds-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-simmonds-charcoal mb-2">Account Activated!</h2>
          <p className="text-simmonds-stone mb-6">
            Your password has been set and your account is now active.
            You can now sign in to access the platform.
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-simmonds-primary text-white rounded-lg hover:bg-simmonds-primary/90"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-simmonds-cream p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-simmonds-primary rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-simmonds-charcoal mb-2">
            Set Up Your Password
          </h1>
          <p className="text-simmonds-stone">
            Welcome to {invitationData.companyName}! Please create a password for your account.
          </p>
        </div>

        {/* User Info */}
        <div className="bg-simmonds-cream/30 rounded-lg p-4 mb-6">
          <div className="text-sm text-simmonds-stone mb-1">Setting up account for:</div>
          <div className="font-medium text-simmonds-charcoal">{invitationData.user.name}</div>
          <div className="text-sm text-simmonds-stone">{invitationData.user.email}</div>
          <div className="text-xs text-simmonds-primary mt-1 capitalize">{invitationData.user.role}</div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-simmonds-cream rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              placeholder="Enter your password"
              minLength={8}
              required
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-simmonds-stone">Minimum 8 characters</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-simmonds-cream rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              placeholder="Confirm your password"
              minLength={8}
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-simmonds-primary ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-simmonds-primary hover:bg-simmonds-primary/90'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Setting up...
              </div>
            ) : (
              'Create Account'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupPassword;
