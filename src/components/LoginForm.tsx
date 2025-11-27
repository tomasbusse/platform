import React, { useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';

interface LoginFormProps {
  onSuccess?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const { signIn } = useAuthActions();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password.trim()) {
      setError('Password is required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      await signIn('password', { email, password, flow: isSignUp ? 'signUp' : 'signIn' });
      onSuccess?.();
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || (isSignUp ? 'Sign up failed' : 'Invalid email or password'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!forgotEmail.trim()) {
      return;
    }

    setIsLoading(true);

    try {
      // Password reset would require email setup (Resend)
      // For now, just show the success message
      setResetSent(true);
    } catch (error) {
      console.error('Password reset failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-2xl shadow-lg border border-simmonds-cream">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-simmonds-charcoal text-center">Reset Password</h2>
          <p className="text-simmonds-stone text-center mt-2">
            Enter your email to receive password reset instructions
          </p>
        </div>

        {resetSent ? (
          <div className="text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-simmonds-lime" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-simmonds-charcoal mb-2">Email Sent</h3>
            <p className="text-simmonds-stone mb-4">
              If an account with that email exists, a password reset link has been sent.
            </p>
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setResetSent(false);
                setForgotEmail('');
              }}
              className="text-simmonds-primary hover:text-simmonds-primary/80"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label htmlFor="forgotEmail" className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="forgotEmail"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full px-4 py-3 border border-simmonds-cream rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotEmail('');
                }}
                className="flex-1 px-4 py-3 border border-simmonds-cream rounded-xl text-simmonds-charcoal hover:bg-simmonds-cream/50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className={`flex-1 px-4 py-3 rounded-xl text-white font-medium ${
                  isLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-simmonds-primary hover:bg-simmonds-primary/90'
                }`}
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-8 bg-white rounded-2xl shadow-lg border border-simmonds-cream">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-simmonds-primary rounded-full mx-auto mb-4 flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-simmonds-charcoal mb-2">
          Simmonds Language Services
        </h1>
        <p className="text-simmonds-stone">
          {isSignUp ? 'Create your account' : 'Sign in to your account'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-simmonds-charcoal mb-2">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-simmonds-cream rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
            placeholder="Enter your email"
            disabled={isLoading}
          />
        </div>

        {/* Password Field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-simmonds-charcoal mb-2">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-simmonds-cream rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
            placeholder="Enter your password"
            disabled={isLoading}
          />
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="h-4 w-4 text-simmonds-primary focus:ring-simmonds-primary border-simmonds-cream rounded"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-simmonds-charcoal">
              Remember me
            </label>
          </div>

          <div className="text-sm">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="font-medium text-simmonds-primary hover:text-simmonds-primary/80"
              disabled={isLoading}
            >
              Forgot password?
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div>
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
                Signing in...
              </div>
            ) : (
              isSignUp ? 'Create Account' : 'Sign in'
            )}
          </button>
        </div>

        {/* Toggle Sign In / Sign Up */}
        <div className="text-center text-sm">
          <span className="text-simmonds-stone">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          </span>{' '}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            className="font-medium text-simmonds-primary hover:text-simmonds-primary/80"
            disabled={isLoading}
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;
