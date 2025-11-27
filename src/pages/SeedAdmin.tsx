import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

const SeedAdmin: React.FC = () => {
  const seedAdminUser = useMutation(api.seedAdmin.seedAdminUser);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSeedAdmin = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await seedAdminUser({});
      setResult(response);
    } catch (err: any) {
      setError(err.message || 'Failed to seed admin user');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Setup Admin User
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Click the button below to create the default admin account
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <button
            onClick={handleSeedAdmin}
            disabled={isLoading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
          >
            {isLoading ? 'Creating Admin...' : 'Create Admin User'}
          </button>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className={`rounded-md p-4 ${result.success ? 'bg-green-50' : 'bg-yellow-50'}`}>
              <div className="flex">
                <div className="ml-3">
                  <h3 className={`text-sm font-medium ${result.success ? 'text-green-800' : 'text-yellow-800'}`}>
                    {result.success ? 'Success!' : 'Info'}
                  </h3>
                  <div className={`mt-2 text-sm ${result.success ? 'text-green-700' : 'text-yellow-700'}`}>
                    <p>{result.message}</p>
                    {result.credentials && (
                      <div className="mt-4 p-3 bg-white rounded border border-green-200">
                        <p className="font-semibold mb-2">Login Credentials:</p>
                        <p><strong>Email:</strong> {result.credentials.email}</p>
                        <p><strong>Password:</strong> {result.credentials.password}</p>
                        <p className="mt-2 text-xs text-gray-600">
                          Please save these credentials and change the password after first login.
                        </p>
                      </div>
                    )}
                    {result.success && (
                      <div className="mt-4">
                        <a
                          href="/"
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                        >
                          Go to Login
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SeedAdmin;

