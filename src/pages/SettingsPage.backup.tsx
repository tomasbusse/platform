import React, { useState, useEffect } from 'react';
import { User, Company } from '../types';
import { db } from '../services/database';

interface SettingsPageProps {
  currentUser: User | null;
  company: Company | null;
}

interface SettingsState {
  profile: {
    name: string;
    email: string;
    phone: string;
    timezone: string;
    language: string;
    profileImage: string;
  };
  company: {
    name: string;
    contactEmail: string;
    address: string;
    website: string;
    logo: string;
    subscriptionPlan: 'trial' | 'basic' | 'professional' | 'enterprise';
    testFrequency: number;
    autoGrouping: boolean;
    emailNotifications: boolean;
  };
  apis: {
    openrouter: {
      enabled: boolean;
      apiKey: string;
      model: string;
    };
    elevenlabs: {
      enabled: boolean;
      apiKey: string;
      defaultVoice: string;
    };
    resend: {
      enabled: boolean;
      apiKey: string;
      domain: string;
    };
    cambridge: {
      enabled: boolean;
      apiKey: string;
      testType: string;
    };
  };
  notifications: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    testReminders: boolean;
    progressUpdates: boolean;
    weeklyReports: boolean;
    newContentAlerts: boolean;
  };
  learning: {
    preferredLevel: string;
    studyReminders: boolean;
    reminderTime: string;
    difficultyAdjustment: boolean;
    progressGoals: boolean;
    adaptiveLearning: boolean;
  };
  security: {
    twoFactorAuth: boolean;
    sessionTimeout: number;
    passwordChange: number;
    loginNotifications: boolean;
  };
}

const SettingsPage: React.FC<SettingsPageProps> = ({ currentUser, company }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<SettingsState>({
    // User Profile
    profile: {
      name: currentUser?.name || '',
      email: currentUser?.email || '',
      phone: '',
      timezone: 'Europe/Paris',
      language: 'en',
      profileImage: '',
    },
    // Company Settings
    company: {
      name: company?.name || '',
      contactEmail: company?.contactEmail || '',
      address: '',
      website: '',
      logo: '',
      subscriptionPlan: (company?.subscriptionPlan as 'trial' | 'basic' | 'professional' | 'enterprise') || 'trial',
      testFrequency: 30, // days
      autoGrouping: true,
      emailNotifications: true,
    },
    // API Integrations
    apis: {
      openrouter: {
        enabled: false,
        apiKey: '',
        model: 'gpt-4',
      },
      elevenlabs: {
        enabled: false,
        apiKey: '',
        defaultVoice: 'sarah',
      },
      resend: {
        enabled: false,
        apiKey: '',
        domain: '',
      },
      cambridge: {
        enabled: false,
        apiKey: '',
        testType: 'placement',
      },
    },
    // Notifications
    notifications: {
      emailNotifications: true,
      pushNotifications: false,
      testReminders: true,
      progressUpdates: true,
      weeklyReports: true,
      newContentAlerts: true,
    },
    // Learning Preferences
    learning: {
      preferredLevel: 'B1',
      studyReminders: true,
      reminderTime: '09:00',
      difficultyAdjustment: true,
      progressGoals: true,
      adaptiveLearning: true,
    },
    // Security
    security: {
      twoFactorAuth: false,
      sessionTimeout: 30, // minutes
      passwordChange: 90, // days
      loginNotifications: true,
    },
  });

  useEffect(() => {
    loadSettings();
  }, [currentUser, company]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      if (currentUser) {
        const userSettings = await db.getUserSettings(currentUser._id);
        if (userSettings) {
          setSettings(prev => ({
            ...prev,
            ...userSettings,
            profile: {
              ...prev.profile,
              ...userSettings.profile
            }
          }));
        }
      }

      if (company) {
        const companySettings = await db.getCompanySettings(company._id);
        if (companySettings) {
          setSettings(prev => ({
            ...prev,
            ...companySettings,
            company: {
              ...prev.company,
              ...companySettings.company
            }
          }));
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      // Save user settings
      await db.saveUserSettings(currentUser._id, {
        profile: settings.profile,
        notifications: settings.notifications,
        learning: settings.learning,
        security: settings.security,
      });

      // Save company settings including API configuration
      if (company) {
        await db.saveCompanySettings(company._id, {
          company: settings.company,
          apis: settings.apis,
        });

        // Update company record with API settings matching Convex schema
        const companySettings = {
          openRouterApiKey: settings.apis.openrouter.apiKey,
          elevenLabsApiKey: settings.apis.elevenlabs.apiKey,
          resendApiKey: settings.apis.resend.apiKey,
          cambridgeApiKey: settings.apis.cambridge.apiKey,
          testFrequency: settings.company.testFrequency,
          autoGrouping: settings.company.autoGrouping,
          emailNotifications: settings.company.emailNotifications,
        };

        // In a real implementation, this would patch the company record in Convex
        // await convex.mutation("updateCompanySettings", {
        //   companyId: company._id,
        //   settings: companySettings
        // });
      }

      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderProfileSettings = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input
              type="text"
              className="input w-full"
              value={settings.profile.name}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                profile: { ...prev.profile, name: e.target.value }
              }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              className="input w-full"
              value={settings.profile.email}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                profile: { ...prev.profile, email: e.target.value }
              }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
            <input
              type="tel"
              className="input w-full"
              value={settings.profile.phone}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                profile: { ...prev.profile, phone: e.target.value }
              }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
            <select
              className="input w-full"
              value={settings.profile.timezone}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                profile: { ...prev.profile, timezone: e.target.value }
              }))}
            >
              <option value="Europe/Paris">Europe/Paris</option>
              <option value="Europe/London">Europe/London</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
            <select
              className="input w-full"
              value={settings.profile.language}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                profile: { ...prev.profile, language: e.target.value }
              }))}
            >
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
              <option value="de">German</option>
              <option value="zh">Chinese</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCompanySettings = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Company Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
            <input
              type="text"
              className="input w-full"
              value={settings.company.name}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                company: { ...prev.company, name: e.target.value }
              }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
            <input
              type="email"
              className="input w-full"
              value={settings.company.contactEmail}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                company: { ...prev.company, contactEmail: e.target.value }
              }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
            <input
              type="url"
              className="input w-full"
              value={settings.company.website}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                company: { ...prev.company, website: e.target.value }
              }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subscription Plan</label>
            <select
              className="input w-full"
              value={settings.company.subscriptionPlan}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                company: { ...prev.company, subscriptionPlan: e.target.value as 'trial' | 'basic' | 'professional' | 'enterprise' }
              }))}
            >
              <option value="trial">Trial</option>
              <option value="basic">Basic</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAPISettings = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">API Integrations</h3>
        <div className="space-y-6">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">OpenRouter (AI Content)</h4>
              <input
                type="checkbox"
                checked={settings.apis.openrouter.enabled}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  apis: {
                    ...prev.apis,
                    openrouter: { ...prev.apis.openrouter, enabled: e.target.checked }
                  }
                }))}
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                <input
                  type="password"
                  className="input w-full"
                  value={settings.apis.openrouter.apiKey}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    apis: {
                      ...prev.apis,
                      openrouter: { ...prev.apis.openrouter, apiKey: e.target.value }
                    }
                  }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                <select
                  className="input w-full"
                  value={settings.apis.openrouter.model}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    apis: {
                      ...prev.apis,
                      openrouter: { ...prev.apis.openrouter, model: e.target.value }
                    }
                  }))}
                >
                  <option value="gpt-4">GPT-4</option>
                  <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">ElevenLabs (Text-to-Speech)</h4>
              <input
                type="checkbox"
                checked={settings.apis.elevenlabs.enabled}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  apis: {
                    ...prev.apis,
                    elevenlabs: { ...prev.apis.elevenlabs, enabled: e.target.checked }
                  }
                }))}
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                <input
                  type="password"
                  className="input w-full"
                  value={settings.apis.elevenlabs.apiKey}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    apis: {
                      ...prev.apis,
                      elevenlabs: { ...prev.apis.elevenlabs, apiKey: e.target.value }
                    }
                  }))}
                />
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">Resend (Email)</h4>
              <input
                type="checkbox"
                checked={settings.apis.resend.enabled}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  apis: {
                    ...prev.apis,
                    resend: { ...prev.apis.resend, enabled: e.target.checked }
                  }
                }))}
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                <input
                  type="password"
                  className="input w-full"
                  value={settings.apis.resend.apiKey}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    apis: {
                      ...prev.apis,
                      resend: { ...prev.apis.resend, apiKey: e.target.value }
                    }
                  }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Domain</label>
                <input
                  type="text"
                  className="input w-full"
                  value={settings.apis.resend.domain}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    apis: {
                      ...prev.apis,
                      resend: { ...prev.apis.resend, domain: e.target.value }
                    }
                  }))}
                />
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">Cambridge English (Assessment)</h4>
              <input
                type="checkbox"
                checked={settings.apis.cambridge.enabled}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  apis: {
                    ...prev.apis,
                    cambridge: { ...prev.apis.cambridge, enabled: e.target.checked }
                  }
                }))}
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                <input
                  type="password"
                  className="input w-full"
                  value={settings.apis.cambridge.apiKey}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    apis: {
                      ...prev.apis,
                      cambridge: { ...prev.apis.cambridge, apiKey: e.target.value }
                    }
                  }))}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">Email Notifications</label>
            <p className="text-sm text-gray-500">Receive notifications via email</p>
          </div>
          <input
            type="checkbox"
            checked={settings.notifications.emailNotifications}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              notifications: { ...prev.notifications, emailNotifications: e.target.checked }
            }))}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">Test Reminders</label>
            <p className="text-sm text-gray-500">Reminders about upcoming assessments</p>
          </div>
          <input
            type="checkbox"
            checked={settings.notifications.testReminders}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              notifications: { ...prev.notifications, testReminders: e.target.checked }
            }))}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">Progress Updates</label>
            <p className="text-sm text-gray-500">Weekly progress reports</p>
          </div>
          <input
            type="checkbox"
            checked={settings.notifications.progressUpdates}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              notifications: { ...prev.notifications, progressUpdates: e.target.checked }
            }))}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">New Content Alerts</label>
            <p className="text-sm text-gray-500">Notifications about new lessons and content</p>
          </div>
          <input
            type="checkbox"
            checked={settings.notifications.newContentAlerts}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              notifications: { ...prev.notifications, newContentAlerts: e.target.checked }
            }))}
          />
        </div>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Security Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Two-Factor Authentication</label>
              <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
            </div>
            <input
              type="checkbox"
              checked={settings.security.twoFactorAuth}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                security: { ...prev.security, twoFactorAuth: e.target.checked }
              }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Login Notifications</label>
              <p className="text-sm text-gray-500">Get notified of new login attempts</p>
            </div>
            <input
              type="checkbox"
              checked={settings.security.loginNotifications}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                security: { ...prev.security, loginNotifications: e.target.checked }
              }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Session Timeout</label>
              <p className="text-sm text-gray-500">Automatically log out after inactivity</p>
            </div>
            <select
              className="input w-24"
              value={settings.security.sessionTimeout}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                security: { ...prev.security, sessionTimeout: parseInt(e.target.value) }
              }))}
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Password & Account</h3>
        <div className="space-y-4">
          <button className="btn btn-secondary">Change Password</button>
          <button className="btn btn-secondary">Download Account Data</button>
          <button className="btn bg-red-100 text-red-700 hover:bg-red-200">Delete Account</button>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'profile', name: 'Profile', icon: '👤' },
    { id: 'company', name: 'Company', icon: '🏢' },
    { id: 'apis', name: 'API Integrations', icon: '🔌' },
    { id: 'notifications', name: 'Notifications', icon: '🔔' },
    { id: 'security', name: 'Security', icon: '🔒' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account and platform configuration</p>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mb-6">
        {activeTab === 'profile' && renderProfileSettings()}
        {activeTab === 'company' && renderCompanySettings()}
        {activeTab === 'apis' && renderAPISettings()}
        {activeTab === 'notifications' && renderNotificationSettings()}
        {activeTab === 'security' && renderSecuritySettings()}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button 
          onClick={handleSave} 
          disabled={isLoading}
          className="btn btn-primary"
        >
          {isLoading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;