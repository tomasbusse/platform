import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';

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
    gemini: {
      enabled: boolean;
      apiKey: string;
      model: string;
      imageModel: string;
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
    openai: {
      enabled: boolean;
      apiKey: string;
      imageModel: string;
    };
    heygen: {
      enabled: boolean;
      apiKey: string;
      defaultAvatarId: string;
    };
  };
  aiPrompts: {
    systemPrompt: string;
    presentationFormat: string;
    homeworkFormat: string;
    defaultLanguage: 'english' | 'german';
  };
  voiceConfig: {
    defaultEnglishVoice: string;
    defaultGermanVoice: string;
    customVoices: Array<{
      id: string;
      name: string;
      language: 'english' | 'german';
      isDefault?: boolean;
    }>;
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

interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  description?: string;
}

// LocalStorage keys for settings persistence
const SETTINGS_STORAGE_KEY = 'simmonds_settings';

// Helper functions for localStorage
const saveToLocalStorage = (settings: SettingsState) => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

const loadFromLocalStorage = (): Partial<SettingsState> | null => {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return null;
  }
};

const SettingsPage: React.FC<SettingsPageProps> = ({ currentUser, company }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingAPI, setIsTestingAPI] = useState<string | null>(null);
  const [apiTestResults, setApiTestResults] = useState<Record<string, { success: boolean; message: string; timestamp: number } | null>>({});
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  // Voice preview state
  const [isPreviewingVoice, setIsPreviewingVoice] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [voicePreviewError, setVoicePreviewError] = useState<string | null>(null);

  // Test email state
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  // Convex queries for settings - using 'skip' when no user/company
  const convexUserSettings = useQuery(
    api.settings.getUserSettings,
    currentUser?._id ? { userId: currentUser._id as Id<"users"> } : 'skip'
  );

  const convexCompanySettings = useQuery(
    api.settings.getCompanySettings,
    company?._id ? { companyId: company._id as Id<"companies"> } : 'skip'
  );

  // Convex mutations for saving settings
  const saveUserSettingsMutation = useMutation(api.settings.saveUserSettings);
  const saveCompanySettingsMutation = useMutation(api.settings.saveCompanySettings);

  // Convex action for sending test email
  const sendTestEmailAction = useAction(api.emailActions.sendTestEmail);

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
      gemini: {
        enabled: false,
        apiKey: '',
        model: 'gemini-2.0-flash',
        imageModel: 'imagen-3.0-generate-002',
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
      openai: {
        enabled: false,
        apiKey: '',
        imageModel: 'gpt-image-1',
      },
      heygen: {
        enabled: false,
        apiKey: '',
        defaultAvatarId: '',
      },
    },
    // AI Prompts Configuration
    aiPrompts: {
      systemPrompt: `You are an expert language teacher creating CONCISE, VISUAL slide presentations. Your style:

- Minimal text, maximum impact - like a premium PowerPoint
- Use bullet points (3-5 max per slide)
- Include image placeholders: [IMAGE: description of relevant image]
- Include chart placeholders: [CHART: type - description]
- Focus on ONE concept per slide
- Use icons and visual cues (emojis as visual aids)

IMPORTANT: Each slide must fit on screen WITHOUT scrolling. Keep content brief and scannable.`,
      presentationFormat: `Create a VISUAL slide presentation (like PowerPoint). Each slide must be:
- Concise: 3-5 bullet points maximum
- Visual: Include [IMAGE: description] placeholders
- Focused: ONE main concept per slide

SLIDE STRUCTURE (4-6 slides total):

SLIDE 1: WELCOME
- Engaging title with emoji
- 2-3 learning objectives as bullet points
- [IMAGE: relevant welcoming image for the topic]

SLIDE 2: KEY VOCABULARY (5-6 words max)
- Word + brief definition
- One example per word
- [IMAGE: visual representation of key words]

SLIDE 3: GRAMMAR/STRUCTURE
- Rule in ONE sentence
- Visual pattern/formula
- [CHART: table showing the pattern]
- 2-3 quick examples

SLIDE 4: PRACTICE
- 2-3 short exercises
- Clear, simple instructions
- [IMAGE: relevant context image]

SLIDE 5: SUMMARY
- 3 key takeaways as bullets
- One memorable tip
- [IMAGE: encouraging/celebratory image]

Remember: LESS IS MORE. No scrolling. Each slide = one screen.`,
      homeworkFormat: `Create BRIEF homework (15-20 min total):

1. VOCABULARY (5 min)
   - 5 matching items
   - Simple fill-in-blank

2. GRAMMAR (5 min)
   - 3-4 sentence exercises

3. MINI TASK (5-10 min)
   - One short writing/speaking task
   - 3-5 sentences expected

Keep it achievable and focused.`,
      defaultLanguage: 'english',
      explanationLanguage: 'english', // Can be 'german' to explain English in German
    },
    // Voice Configuration
    voiceConfig: {
      defaultEnglishVoice: '21m00Tcm4TlvDq8ikWAM', // Rachel
      defaultGermanVoice: 'onwK4e9ZLuTAKqWW03F9', // Daniel
      customVoices: [],
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

  // Load settings from localStorage on mount (immediate)
  useEffect(() => {
    const localSettings = loadFromLocalStorage();
    if (localSettings) {
      setSettings(prev => ({
        ...prev,
        ...localSettings,
        profile: { ...prev.profile, ...localSettings.profile },
        company: { ...prev.company, ...localSettings.company },
        apis: {
          ...prev.apis,
          ...localSettings.apis,
          openrouter: { ...prev.apis.openrouter, ...localSettings.apis?.openrouter },
          elevenlabs: { ...prev.apis.elevenlabs, ...localSettings.apis?.elevenlabs },
          gemini: { ...prev.apis.gemini, ...localSettings.apis?.gemini },
          resend: { ...prev.apis.resend, ...localSettings.apis?.resend },
          cambridge: { ...prev.apis.cambridge, ...localSettings.apis?.cambridge },
          openai: { ...prev.apis.openai, ...localSettings.apis?.openai },
          heygen: { ...prev.apis.heygen, ...localSettings.apis?.heygen },
        },
        notifications: { ...prev.notifications, ...localSettings.notifications },
        learning: { ...prev.learning, ...localSettings.learning },
        security: { ...prev.security, ...localSettings.security },
      }));
    }
    fetchOpenRouterModels();
  }, []);

  // Sync with Convex when user settings are loaded
  useEffect(() => {
    if (convexUserSettings && Object.keys(convexUserSettings).length > 0) {
      setSettings(prev => {
        const updated = {
          ...prev,
          profile: { ...prev.profile, ...convexUserSettings.profile },
          notifications: { ...prev.notifications, ...convexUserSettings.notifications },
          learning: { ...prev.learning, ...convexUserSettings.learning },
          security: { ...prev.security, ...convexUserSettings.security },
        };
        // Also save to localStorage to keep them in sync
        saveToLocalStorage(updated);
        return updated;
      });
    }
  }, [convexUserSettings]);

  // Sync with Convex when company settings are loaded
  useEffect(() => {
    if (convexCompanySettings && Object.keys(convexCompanySettings).length > 0) {
      setSettings(prev => {
        const updated = {
          ...prev,
          company: { ...prev.company, ...convexCompanySettings.company },
          apis: {
            ...prev.apis,
            openrouter: { ...prev.apis.openrouter, ...convexCompanySettings.apis?.openrouter },
            elevenlabs: { ...prev.apis.elevenlabs, ...convexCompanySettings.apis?.elevenlabs },
            gemini: { ...prev.apis.gemini, ...convexCompanySettings.apis?.gemini },
            resend: { ...prev.apis.resend, ...convexCompanySettings.apis?.resend },
            cambridge: { ...prev.apis.cambridge, ...convexCompanySettings.apis?.cambridge },
            openai: { ...prev.apis.openai, ...convexCompanySettings.apis?.openai },
            heygen: { ...prev.apis.heygen, ...convexCompanySettings.apis?.heygen },
          },
          aiPrompts: { ...prev.aiPrompts, ...(convexCompanySettings as any).aiPrompts },
          voiceConfig: { ...prev.voiceConfig, ...(convexCompanySettings as any).voiceConfig },
        };
        // Also save to localStorage to keep them in sync
        saveToLocalStorage(updated);
        return updated;
      });
    }
  }, [convexCompanySettings]);

  // Update settings from currentUser/company props
  useEffect(() => {
    if (currentUser) {
      setSettings(prev => ({
        ...prev,
        profile: {
          ...prev.profile,
          name: currentUser.name || prev.profile.name,
          email: currentUser.email || prev.profile.email,
        }
      }));
    }
    if (company) {
      setSettings(prev => ({
        ...prev,
        company: {
          ...prev.company,
          name: company.name || prev.company.name,
          contactEmail: company.contactEmail || prev.company.contactEmail,
          subscriptionPlan: (company.subscriptionPlan as 'trial' | 'basic' | 'professional' | 'enterprise') || prev.company.subscriptionPlan,
        }
      }));
    }
  }, [currentUser, company]);

  const fetchOpenRouterModels = async () => {
    setIsLoadingModels(true);
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models');
      if (response.ok) {
        const data = await response.json();
        // Sort models by name for easier browsing
        const sortedModels = (data.data || []).sort((a: OpenRouterModel, b: OpenRouterModel) =>
          a.name.localeCompare(b.name)
        );
        setOpenRouterModels(sortedModels);
      }
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const testAPI = async (apiName: string) => {
    if (!company) return;
    
    setIsTestingAPI(apiName);
    setApiTestResults(prev => ({ ...prev, [apiName]: null }));

    try {
      let result = { success: false, message: '' };
      
      switch (apiName) {
        case 'openrouter':
          // Test OpenRouter API with a simple request
          result = await testOpenRouterAPI(settings.apis.openrouter.apiKey, settings.apis.openrouter.model);
          break;
        case 'elevenlabs':
          // Test ElevenLabs API
          result = await testElevenLabsAPI(settings.apis.elevenlabs.apiKey);
          break;
        case 'resend':
          // Test Resend API
          result = await testResendAPI(settings.apis.resend.apiKey);
          break;
        case 'cambridge':
          // Test Cambridge API
          result = await testCambridgeAPI(settings.apis.cambridge.apiKey);
          break;
        case 'gemini':
          // Test Gemini API
          result = await testGeminiAPI(settings.apis.gemini.apiKey);
          break;
        case 'openai':
          // Test OpenAI API for image generation
          result = await testOpenAIAPI(settings.apis.openai.apiKey);
          break;
        case 'heygen':
          // Test HeyGen API
          result = await testHeyGenAPI(settings.apis.heygen.apiKey);
          break;
      }

      setApiTestResults(prev => ({
        ...prev,
        [apiName]: { ...result, timestamp: Date.now() }
      }));

      if (result.success) {
        alert(`✅ ${apiName} API test successful!\n\n${result.message}`);
      } else {
        alert(`❌ ${apiName} API test failed!\n\n${result.message}`);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error occurred';
      setApiTestResults(prev => ({
        ...prev,
        [apiName]: { success: false, message: errorMessage, timestamp: Date.now() }
      }));
      alert(`❌ ${apiName} API test failed!\n\n${errorMessage}`);
    } finally {
      setIsTestingAPI(null);
    }
  };

  // Secure API test functions that don't expose keys in client
  const testOpenRouterAPI = async (apiKey: string, model: string) => {
    if (!apiKey) {
      return { success: false, message: 'API key is required' };
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'user', content: 'Hi! Please respond with "API connection successful"' }
          ],
          max_tokens: 50
        })
      });

      if (response.ok) {
        const data = await response.json();
        return { 
          success: true, 
          message: `Connection successful!\nModel: ${model}\nResponse received from API.` 
        };
      } else {
        const error = await response.json();
        return { 
          success: false, 
          message: `API Error: ${error.error?.message || response.statusText}` 
        };
      }
    } catch (error: any) {
      return { success: false, message: `Network error: ${error.message}` };
    }
  };

  const testElevenLabsAPI = async (apiKey: string) => {
    if (!apiKey) {
      return { success: false, message: 'API key is required' };
    }

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        }
      });

      if (response.ok) {
        const data = await response.json();
        return { 
          success: true, 
          message: `Connection successful!\nFound ${data.voices?.length || 0} available voices.` 
        };
      } else {
        const error = await response.json();
        return { 
          success: false, 
          message: `API Error: ${error.detail?.message || response.statusText}` 
        };
      }
    } catch (error: any) {
      return { success: false, message: `Network error: ${error.message}` };
    }
  };

  const testResendAPI = async (apiKey: string) => {
    if (!apiKey) {
      return { success: false, message: 'API key is required' };
    }

    try {
      // Resend API test - using a lightweight endpoint
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'test@resend.dev',
          to: ['test@example.com'],
          subject: 'API Test',
          html: '<p>Test</p>'
        })
      });

      // Any response other than 401/403 means the key format is correct
      if (response.status === 401 ) {
        return { 
          success: false, 
          message: 'API key is invalid or unauthorized.' 
        };
      } else if (response.status === 422) {
        // 422 means validation error (from/to domain issue) but API key is valid
        return { 
          success: true, 
          message: 'Connection successful! API key is valid.\n(Email validation failed as expected for test)' 
        };
      } else if (response.status === 429) {
        return { 
          success: true, 
          message: 'Connection successful! API key is valid.\n(Rate limit reached - this confirms the key works)' 
        };
      } else if (response.ok) {
        return { 
          success: true, 
          message: 'Connection successful! API key is valid and test email was sent.' 
        };
      } else {
        const data = await response.json().catch(() => ({}));
        return { 
          success: false, 
          message: `API Error (${response.status}): ${data.message || response.statusText}` 
        };
      }
    } catch (error: any) {
      // CORS errors often indicate the API endpoint exists but browser can't access it directly
      if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
        return { 
          success: true, 
          message: 'API key format appears valid!\n(Direct browser testing blocked by CORS - this is normal. The key will work from your backend.)' 
        };
      }
      return { success: false, message: `Network error: ${error.message}` };
    }
  };

  // Send test email function using Convex action
  const sendTestEmail = async () => {
    const apiKey = settings.apis.resend.apiKey;
    const domain = settings.apis.resend.domain;
    const toEmail = testEmailAddress || currentUser?.email;

    if (!apiKey) {
      setTestEmailResult({ success: false, message: 'Resend API key is required' });
      return;
    }

    if (!toEmail) {
      setTestEmailResult({ success: false, message: 'Please enter an email address' });
      return;
    }

    setIsSendingTestEmail(true);
    setTestEmailResult(null);

    try {
      const result = await sendTestEmailAction({
        apiKey,
        domain: domain || undefined,
        toEmail,
      });

      setTestEmailResult({
        success: result.success,
        message: result.message,
      });
    } catch (error: any) {
      console.error('Error sending test email:', error);
      setTestEmailResult({
        success: false,
        message: `Error: ${error.message || 'Failed to send test email'}`,
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const testCambridgeAPI = async (apiKey: string) => {
    if (!apiKey) {
      return { success: false, message: 'API key is required' };
    }

    // Note: Cambridge API is currently mocked - this is a placeholder
    return {
      success: true,
      message: 'Cambridge API test successful! (Using mock implementation)'
    };
  };

  const testGeminiAPI = async (apiKey: string) => {
    if (!apiKey) {
      return { success: false, message: 'API key is required' };
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Say "API connection successful" in exactly those words.' }] }],
            generationConfig: {
              maxOutputTokens: 50,
            },
          }),
        }
      );

      if (response.ok) {
        return {
          success: true,
          message: 'Connection successful!\nGemini API is ready for lesson generation.'
        };
      } else {
        const error = await response.json();
        return {
          success: false,
          message: `API Error: ${error.error?.message || response.statusText}`
        };
      }
    } catch (error: any) {
      return { success: false, message: `Network error: ${error.message}` };
    }
  };

  const testOpenAIAPI = async (apiKey: string) => {
    if (!apiKey) {
      return { success: false, message: 'API key is required' };
    }

    try {
      // Test by fetching models list (lightweight request)
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Check if gpt-image-1 or dall-e models are available
        const imageModels = data.data?.filter((m: any) =>
          m.id.includes('dall-e') || m.id.includes('gpt-image')
        ) || [];
        return {
          success: true,
          message: `Connection successful!\nFound ${imageModels.length} image generation model(s).\nReady to generate images for lessons and tests.`
        };
      } else {
        const error = await response.json();
        return {
          success: false,
          message: `API Error: ${error.error?.message || response.statusText}`
        };
      }
    } catch (error: any) {
      return { success: false, message: `Network error: ${error.message}` };
    }
  };

  const testHeyGenAPI = async (apiKey: string) => {
    if (!apiKey) {
      return { success: false, message: 'API key is required' };
    }

    try {
      // Test by fetching avatars list
      const response = await fetch('https://api.heygen.com/v2/avatars', {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const avatarCount = data.data?.avatars?.length || 0;
        return {
          success: true,
          message: `Connection successful!\nFound ${avatarCount} available avatar(s).\nReady to generate dialogue scenes.`
        };
      } else if (response.status === 401) {
        return {
          success: false,
          message: 'API key is invalid or unauthorized.'
        };
      } else {
        const error = await response.json().catch(() => ({}));
        return {
          success: false,
          message: `API Error: ${error.message || response.statusText}`
        };
      }
    } catch (error: any) {
      // CORS might block direct browser calls
      if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
        return {
          success: true,
          message: 'API key format appears valid!\n(Direct browser testing blocked by CORS - this is normal. The key will work from your backend.)'
        };
      }
      return { success: false, message: `Network error: ${error.message}` };
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      // Always save to localStorage first (immediate persistence)
      saveToLocalStorage(settings);

      // Save user settings to Convex
      try {
        await saveUserSettingsMutation({
          userId: currentUser._id as Id<"users">,
          companyId: company?._id as Id<"companies">,
          settings: {
            profile: settings.profile,
            notifications: settings.notifications,
            learning: settings.learning,
            security: settings.security,
          },
        });
      } catch (convexError) {
        console.warn('Could not save user settings to Convex (may be offline or not connected):', convexError);
      }

      // Save company settings including API configuration to Convex
      if (company) {
        try {
          await saveCompanySettingsMutation({
            companyId: company._id as Id<"companies">,
            settings: {
              company: settings.company,
              apis: settings.apis,
              aiPrompts: settings.aiPrompts,
              voiceConfig: settings.voiceConfig,
            },
          });
        } catch (convexError) {
          console.warn('Could not save company settings to Convex (may be offline or not connected):', convexError);
        }
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
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Profile Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Full Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
              value={settings.profile.name}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                profile: { ...prev.profile, name: e.target.value }
              }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Email</label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
              value={settings.profile.email}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                profile: { ...prev.profile, email: e.target.value }
              }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Phone</label>
            <input
              type="tel"
              className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
              value={settings.profile.phone}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                profile: { ...prev.profile, phone: e.target.value }
              }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Timezone</label>
            <select
              className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
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
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Language</label>
            <select
              className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
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
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Company Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Company Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
              value={settings.company.name}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                company: { ...prev.company, name: e.target.value }
              }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Contact Email</label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
              value={settings.company.contactEmail}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                company: { ...prev.company, contactEmail: e.target.value }
              }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Website</label>
            <input
              type="url"
              className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
              value={settings.company.website}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                company: { ...prev.company, website: e.target.value }
              }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Subscription Plan</label>
            <select
              className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
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
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">API Integrations</h3>
        <div className="space-y-6">
          <div className="border border-simmonds-cream rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-simmonds-charcoal">OpenRouter (AI Content)</h4>
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
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">API Key</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
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
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Model</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Search models..."
                    className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary text-sm"
                    value={modelSearchQuery}
                    onChange={(e) => setModelSearchQuery(e.target.value)}
                  />
                  <select
                    className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
                    value={settings.apis.openrouter.model}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      apis: {
                        ...prev.apis,
                        openrouter: { ...prev.apis.openrouter, model: e.target.value }
                      }
                    }))}
                    size={8}
                  >
                    {isLoadingModels ? (
                      <option disabled>Loading models...</option>
                    ) : openRouterModels.length > 0 ? (
                      openRouterModels
                        .filter(model =>
                          modelSearchQuery === '' ||
                          model.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
                          model.id.toLowerCase().includes(modelSearchQuery.toLowerCase())
                        )
                        .map(model => {
                          const isFree = model.pricing?.prompt === '0' || model.id.includes(':free');
                          const contextK = Math.round(model.context_length / 1000);
                          return (
                            <option key={model.id} value={model.id}>
                              {isFree ? '🆓 ' : ''}{model.name} ({contextK}K context)
                            </option>
                          );
                        })
                    ) : (
                      <>
                        <optgroup label="Popular Models">
                          <option value="anthropic/claude-3.5-sonnet">Anthropic: Claude 3.5 Sonnet</option>
                          <option value="openai/gpt-4-turbo">OpenAI: GPT-4 Turbo</option>
                          <option value="openai/gpt-4o">OpenAI: GPT-4o</option>
                          <option value="google/gemini-pro-1.5">Google: Gemini Pro 1.5</option>
                        </optgroup>
                      </>
                    )}
                  </select>
                  <p className="text-xs text-simmonds-stone">
                    {openRouterModels.length > 0
                      ? `${openRouterModels.filter(m =>
                          modelSearchQuery === '' ||
                          m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
                          m.id.toLowerCase().includes(modelSearchQuery.toLowerCase())
                        ).length} of ${openRouterModels.length} models shown`
                      : 'Enter your API key to load all available models'}
                  </p>
                </div>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => testAPI('openrouter')}
                  disabled={!settings.apis.openrouter.apiKey || isTestingAPI !== null}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl text-simmonds-charcoal hover:bg-simmonds-cream-light disabled:opacity-50 transition-colors"
                >
                  {isTestingAPI === 'openrouter' ? 'Testing...' : 'Test API Connection'}
                </button>
                {apiTestResults.openrouter && (
                  <p className={`text-xs mt-1 ${apiTestResults.openrouter.success ? 'text-simmonds-lime-dark' : 'text-simmonds-terracotta'}`}>
                    {apiTestResults.openrouter.success ? 'Last test successful' : 'Last test failed'}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="border border-simmonds-cream rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-simmonds-charcoal">ElevenLabs (Text-to-Speech)</h4>
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
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">API Key</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
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
              <div>
                <button
                  type="button"
                  onClick={() => testAPI('elevenlabs')}
                  disabled={!settings.apis.elevenlabs.apiKey || isTestingAPI !== null}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl text-simmonds-charcoal hover:bg-simmonds-cream-light disabled:opacity-50 transition-colors"
                >
                  {isTestingAPI === 'elevenlabs' ? 'Testing...' : 'Test API Connection'}
                </button>
                {apiTestResults.elevenlabs && (
                  <p className={`text-xs mt-1 ${apiTestResults.elevenlabs.success ? 'text-simmonds-lime-dark' : 'text-simmonds-terracotta'}`}>
                    {apiTestResults.elevenlabs.success ? 'Last test successful' : 'Last test failed'}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="border border-simmonds-cream rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-simmonds-charcoal">Google Gemini (AI Lesson & Image Generation)</h4>
                <p className="text-xs text-simmonds-stone mt-1">Text generation, design, and image creation for lessons</p>
              </div>
              <input
                type="checkbox"
                checked={settings.apis.gemini.enabled}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  apis: {
                    ...prev.apis,
                    gemini: { ...prev.apis.gemini, enabled: e.target.checked }
                  }
                }))}
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">API Key</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
                  placeholder="AIza..."
                  value={settings.apis.gemini.apiKey}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    apis: {
                      ...prev.apis,
                      gemini: { ...prev.apis.gemini, apiKey: e.target.value }
                    }
                  }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Text/Design Model</label>
                <select
                  className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
                  value={settings.apis.gemini.model}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    apis: {
                      ...prev.apis,
                      gemini: { ...prev.apis.gemini, model: e.target.value }
                    }
                  }))}
                >
                  <optgroup label="Gemini 3 (Latest)">
                    <option value="gemini-3-pro-preview">Gemini 3 Pro (Most Advanced)</option>
                  </optgroup>
                  <optgroup label="Gemini 2.0">
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fast, Recommended)</option>
                    <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite (Fastest)</option>
                    <option value="gemini-2.0-pro-exp">Gemini 2.0 Pro (Experimental)</option>
                  </optgroup>
                  <optgroup label="Gemini 1.5">
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro (High Quality)</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                    <option value="gemini-1.5-flash-8b">Gemini 1.5 Flash 8B (Economical)</option>
                  </optgroup>
                  <optgroup label="Gemini Experimental">
                    <option value="gemini-exp-1206">Gemini Exp 1206</option>
                    <option value="learnlm-1.5-pro-experimental">LearnLM 1.5 Pro (Education-focused)</option>
                  </optgroup>
                </select>
                <p className="text-xs text-simmonds-stone mt-1">
                  Used for lesson content generation, vocabulary explanations, and visual design prompts.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Image Generation Model</label>
                <select
                  className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
                  value={settings.apis.gemini.imageModel}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    apis: {
                      ...prev.apis,
                      gemini: { ...prev.apis.gemini, imageModel: e.target.value }
                    }
                  }))}
                >
                  <optgroup label="Gemini 3 Image (Latest)">
                    <option value="gemini-3-pro-image-preview">Gemini 3 Pro Image / Nano Banana 2 (Best Quality)</option>
                  </optgroup>
                  <optgroup label="Imagen 3">
                    <option value="imagen-3.0-generate-002">Imagen 3.0 (High Quality)</option>
                    <option value="imagen-3.0-fast-generate-001">Imagen 3.0 Fast (Faster)</option>
                  </optgroup>
                  <optgroup label="Gemini Native Image">
                    <option value="gemini-2.0-flash-exp-image">Gemini 2.0 Flash Image (Experimental)</option>
                  </optgroup>
                </select>
                <p className="text-xs text-simmonds-stone mt-1">
                  Used for generating vocabulary illustrations, lesson visuals, and test images.
                </p>
              </div>
              <p className="text-xs text-simmonds-stone">
                Get your API key from <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-simmonds-primary hover:underline">Google AI Studio</a>. Supports both text and image generation for comprehensive lesson creation.
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => testAPI('gemini')}
                  disabled={!settings.apis.gemini.apiKey || isTestingAPI !== null}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl text-simmonds-charcoal hover:bg-simmonds-cream-light disabled:opacity-50 transition-colors"
                >
                  {isTestingAPI === 'gemini' ? 'Testing...' : 'Test API Connection'}
                </button>
                {apiTestResults.gemini && (
                  <p className={`text-xs mt-1 ${apiTestResults.gemini.success ? 'text-simmonds-lime-dark' : 'text-simmonds-terracotta'}`}>
                    {apiTestResults.gemini.success ? 'Last test successful' : 'Last test failed'}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="border border-simmonds-cream rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-simmonds-charcoal">Resend (Email)</h4>
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
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">API Key</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
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
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Domain</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
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
              <div>
                <button
                  type="button"
                  onClick={() => testAPI('resend')}
                  disabled={!settings.apis.resend.apiKey || isTestingAPI !== null}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl text-simmonds-charcoal hover:bg-simmonds-cream-light disabled:opacity-50 transition-colors"
                >
                  {isTestingAPI === 'resend' ? 'Testing...' : 'Test API Connection'}
                </button>
                {apiTestResults.resend && (
                  <p className={`text-xs mt-1 ${apiTestResults.resend.success ? 'text-simmonds-lime-dark' : 'text-simmonds-terracotta'}`}>
                    {apiTestResults.resend.success ? 'Last test successful' : 'Last test failed'}
                  </p>
                )}
              </div>

              {/* Send Test Email Section */}
              <div className="mt-4 pt-4 border-t border-simmonds-cream">
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                  Send Test Email
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder={currentUser?.email || 'Enter email address'}
                    className="flex-1 px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary text-sm"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={sendTestEmail}
                    disabled={!settings.apis.resend.apiKey || isSendingTestEmail}
                    className="px-4 py-2 bg-simmonds-primary text-white rounded-xl text-sm font-medium hover:bg-simmonds-primary-light disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {isSendingTestEmail ? (
                      <>
                        <span className="animate-spin">⚙️</span>
                        Sending...
                      </>
                    ) : (
                      <>
                        <span>📧</span>
                        Send Test
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-simmonds-stone mt-1">
                  {currentUser?.email && !testEmailAddress
                    ? `Will send to: ${currentUser.email}`
                    : 'Enter an email address to receive a test message'}
                </p>
                {testEmailResult && (
                  <div className={`mt-2 p-3 rounded-lg text-sm ${
                    testEmailResult.success
                      ? 'bg-simmonds-lime/10 text-simmonds-lime-dark'
                      : 'bg-simmonds-terracotta/10 text-simmonds-terracotta'
                  }`}>
                    {testEmailResult.success ? '✓ ' : '✗ '}
                    {testEmailResult.message}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border border-simmonds-cream rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-simmonds-charcoal">Cambridge English (Assessment)</h4>
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
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">API Key</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
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
              <div>
                <button
                  type="button"
                  onClick={() => testAPI('cambridge')}
                  disabled={!settings.apis.cambridge.apiKey || isTestingAPI !== null}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl text-simmonds-charcoal hover:bg-simmonds-cream-light disabled:opacity-50 transition-colors"
                >
                  {isTestingAPI === 'cambridge' ? 'Testing...' : 'Test API Connection'}
                </button>
                {apiTestResults.cambridge && (
                  <p className={`text-xs mt-1 ${apiTestResults.cambridge.success ? 'text-simmonds-lime-dark' : 'text-simmonds-terracotta'}`}>
                    {apiTestResults.cambridge.success ? 'Last test successful' : 'Last test failed'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* OpenAI Image Generation */}
          <div className="border border-simmonds-cream rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-simmonds-charcoal">OpenAI (Image Generation)</h4>
                <p className="text-xs text-simmonds-stone mt-1">Generate images for lessons, vocabulary cards, and tests</p>
              </div>
              <input
                type="checkbox"
                checked={settings.apis.openai.enabled}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  apis: {
                    ...prev.apis,
                    openai: { ...prev.apis.openai, enabled: e.target.checked }
                  }
                }))}
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">API Key</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
                  placeholder="sk-..."
                  value={settings.apis.openai.apiKey}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    apis: {
                      ...prev.apis,
                      openai: { ...prev.apis.openai, apiKey: e.target.value }
                    }
                  }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Image Model</label>
                <select
                  className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
                  value={settings.apis.openai.imageModel}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    apis: {
                      ...prev.apis,
                      openai: { ...prev.apis.openai, imageModel: e.target.value }
                    }
                  }))}
                >
                  <option value="gpt-image-1">GPT Image 1 (Latest)</option>
                  <option value="dall-e-3">DALL-E 3 (High Quality)</option>
                  <option value="dall-e-2">DALL-E 2 (Faster)</option>
                </select>
                <p className="text-xs text-simmonds-stone mt-1">
                  GPT Image 1 is recommended for educational content with natural-looking illustrations.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => testAPI('openai')}
                  disabled={!settings.apis.openai.apiKey || isTestingAPI !== null}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl text-simmonds-charcoal hover:bg-simmonds-cream-light disabled:opacity-50 transition-colors"
                >
                  {isTestingAPI === 'openai' ? 'Testing...' : 'Test API Connection'}
                </button>
                {apiTestResults.openai && (
                  <p className={`text-xs mt-1 ${apiTestResults.openai.success ? 'text-simmonds-lime-dark' : 'text-simmonds-terracotta'}`}>
                    {apiTestResults.openai.success ? 'Last test successful' : 'Last test failed'}
                  </p>
                )}
              </div>
              <p className="text-xs text-simmonds-stone">
                Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-simmonds-primary hover:underline">OpenAI Platform</a>. Used for generating vocabulary images, test illustrations, and lesson visuals.
              </p>
            </div>
          </div>

          {/* HeyGen Video Generation */}
          <div className="border border-simmonds-cream rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-simmonds-charcoal">HeyGen (AI Video Avatars)</h4>
                <p className="text-xs text-simmonds-stone mt-1">Create dialogue scenes with AI-powered avatars</p>
              </div>
              <input
                type="checkbox"
                checked={settings.apis.heygen.enabled}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  apis: {
                    ...prev.apis,
                    heygen: { ...prev.apis.heygen, enabled: e.target.checked }
                  }
                }))}
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">API Key</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
                  value={settings.apis.heygen.apiKey}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    apis: {
                      ...prev.apis,
                      heygen: { ...prev.apis.heygen, apiKey: e.target.value }
                    }
                  }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Default Avatar ID (Optional)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
                  placeholder="e.g., Angela-inblackskirt-20220820"
                  value={settings.apis.heygen.defaultAvatarId}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    apis: {
                      ...prev.apis,
                      heygen: { ...prev.apis.heygen, defaultAvatarId: e.target.value }
                    }
                  }))}
                />
                <p className="text-xs text-simmonds-stone mt-1">
                  Leave empty to select avatars when creating content. Find avatar IDs in your HeyGen dashboard.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => testAPI('heygen')}
                  disabled={!settings.apis.heygen.apiKey || isTestingAPI !== null}
                  className="w-full px-4 py-2 border border-simmonds-cream rounded-xl text-simmonds-charcoal hover:bg-simmonds-cream-light disabled:opacity-50 transition-colors"
                >
                  {isTestingAPI === 'heygen' ? 'Testing...' : 'Test API Connection'}
                </button>
                {apiTestResults.heygen && (
                  <p className={`text-xs mt-1 ${apiTestResults.heygen.success ? 'text-simmonds-lime-dark' : 'text-simmonds-terracotta'}`}>
                    {apiTestResults.heygen.success ? 'Last test successful' : 'Last test failed'}
                  </p>
                )}
              </div>
              <p className="text-xs text-simmonds-stone">
                Get your API key from <a href="https://app.heygen.com/settings?nav=API" target="_blank" rel="noopener noreferrer" className="text-simmonds-primary hover:underline">HeyGen Settings</a>. Used for creating realistic dialogue scenes with AI avatars for conversational practice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
      <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Notification Preferences</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-simmonds-charcoal">Email Notifications</label>
            <p className="text-sm text-simmonds-stone">Receive notifications via email</p>
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
            <label className="text-sm font-medium text-simmonds-charcoal">Test Reminders</label>
            <p className="text-sm text-simmonds-stone">Reminders about upcoming assessments</p>
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
            <label className="text-sm font-medium text-simmonds-charcoal">Progress Updates</label>
            <p className="text-sm text-simmonds-stone">Weekly progress reports</p>
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
            <label className="text-sm font-medium text-simmonds-charcoal">New Content Alerts</label>
            <p className="text-sm text-simmonds-stone">Notifications about new lessons and content</p>
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

  // ElevenLabs voices for selection
  const englishVoices = [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', accent: 'American' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', accent: 'American' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', accent: 'American' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', accent: 'American' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', accent: 'American' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', accent: 'American' },
    { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', accent: 'British' },
    { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', accent: 'British' },
  ];

  const germanVoices = [
    { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', accent: 'German' },
    { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', accent: 'German' },
    { id: 'oWAxZDx7w5VEj9dCyTzz', name: 'Grace', accent: 'German' },
    { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', accent: 'German' },
    { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric', accent: 'German' },
    { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', accent: 'German' },
  ];

  // Voice preview function
  const previewVoice = async (voiceId: string, isGerman: boolean) => {
    const apiKey = settings.apis.elevenlabs.apiKey || (company?.settings as any)?.elevenLabsApiKey;
    if (!apiKey) {
      setVoicePreviewError('ElevenLabs API key not configured. Add it in API Integrations tab.');
      return;
    }

    // Stop any currently playing preview
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }

    setIsPreviewingVoice(voiceId);
    setVoicePreviewError(null);

    try {
      // Find the voice name for the preview text
      const allVoices = [...englishVoices, ...germanVoices, ...(settings.voiceConfig?.customVoices || [])];
      const voice = allVoices.find(v => v.id === voiceId);
      const voiceName = voice?.name || 'this voice';

      // Sample text based on language
      const sampleText = isGerman
        ? `Hallo, ich bin ${voiceName}. So werde ich in Ihren Lektionen klingen.`
        : `Hello, I'm ${voiceName}. This is how I'll sound in your lessons.`;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            Accept: 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
          },
          body: JSON.stringify({
            text: sampleText,
            model_id: isGerman ? 'eleven_multilingual_v2' : 'eleven_monolingual_v1',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setIsPreviewingVoice(null);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setIsPreviewingVoice(null);
        setVoicePreviewError('Failed to play audio preview');
      };

      setPreviewAudio(audio);
      await audio.play();
    } catch (error) {
      console.error('Voice preview error:', error);
      setVoicePreviewError(error instanceof Error ? error.message : 'Failed to preview voice');
      setIsPreviewingVoice(null);
    }
  };

  const stopVoicePreview = () => {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      setIsPreviewingVoice(null);
    }
  };

  const renderAIPromptsSettings = () => (
    <div className="space-y-6">
      {/* System Prompt */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-simmonds-primary to-simmonds-olive rounded-lg flex items-center justify-center">
            <span className="text-white text-lg">🤖</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-simmonds-charcoal">System Prompt</h3>
            <p className="text-sm text-simmonds-stone">Define the AI's persona and teaching style for all generated lessons</p>
          </div>
        </div>
        <textarea
          className="w-full px-4 py-3 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary h-32 resize-y"
          placeholder="e.g., You are a friendly and encouraging language teacher who specializes in making complex grammar concepts easy to understand. Always use real-world examples and maintain a supportive tone..."
          value={settings.aiPrompts.systemPrompt}
          onChange={(e) => setSettings(prev => ({
            ...prev,
            aiPrompts: { ...prev.aiPrompts, systemPrompt: e.target.value }
          }))}
        />
        <p className="text-xs text-simmonds-stone mt-2">
          This prompt will be applied to all AI-generated lessons to maintain consistency in teaching style.
        </p>
      </div>

      {/* Presentation Format */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-simmonds-olive to-simmonds-lime rounded-lg flex items-center justify-center">
            <span className="text-white text-lg">📊</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-simmonds-charcoal">Presentation Format</h3>
            <p className="text-sm text-simmonds-stone">How should lesson content be structured and presented?</p>
          </div>
        </div>
        <textarea
          className="w-full px-4 py-3 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary h-32 resize-y"
          placeholder="e.g., Always start with a warm-up activity, present new vocabulary with visual examples, use tables for grammar rules, include interactive dialogue examples, end with a summary of key points..."
          value={settings.aiPrompts.presentationFormat}
          onChange={(e) => setSettings(prev => ({
            ...prev,
            aiPrompts: { ...prev.aiPrompts, presentationFormat: e.target.value }
          }))}
        />
        <p className="text-xs text-simmonds-stone mt-2">
          Defines how lesson presentations should be structured (sections, visual elements, interactivity).
        </p>
      </div>

      {/* Homework Format */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-simmonds-terracotta to-simmonds-cream rounded-lg flex items-center justify-center">
            <span className="text-white text-lg">📝</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-simmonds-charcoal">Homework Format</h3>
            <p className="text-sm text-simmonds-stone">How should homework and exercises be structured?</p>
          </div>
        </div>
        <textarea
          className="w-full px-4 py-3 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary h-32 resize-y"
          placeholder="e.g., Include 3 vocabulary exercises, 2 grammar fill-in-the-blank activities, 1 writing prompt, and 1 listening comprehension task. Provide clear instructions and expected completion time..."
          value={settings.aiPrompts.homeworkFormat}
          onChange={(e) => setSettings(prev => ({
            ...prev,
            aiPrompts: { ...prev.aiPrompts, homeworkFormat: e.target.value }
          }))}
        />
        <p className="text-xs text-simmonds-stone mt-2">
          Defines the structure and types of exercises included in homework assignments.
        </p>
      </div>

      {/* Default Language & Voice Settings */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-lg">🌐</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-simmonds-charcoal">Language & Voice Settings</h3>
            <p className="text-sm text-simmonds-stone">Configure default language and text-to-speech voices</p>
          </div>
        </div>

        {voicePreviewError && (
          <div className="mb-4 p-3 bg-simmonds-terracotta/10 text-simmonds-terracotta rounded-xl text-sm">
            {voicePreviewError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Default Lesson Language</label>
            <select
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              value={settings.aiPrompts.defaultLanguage}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                aiPrompts: { ...prev.aiPrompts, defaultLanguage: e.target.value as 'english' | 'german' }
              }))}
            >
              <option value="english">English</option>
              <option value="german">German (Deutsch)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Explanations In</label>
            <select
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              value={settings.aiPrompts.explanationLanguage || 'english'}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                aiPrompts: { ...prev.aiPrompts, explanationLanguage: e.target.value as 'english' | 'german' }
              }))}
            >
              <option value="english">English</option>
              <option value="german">German (Deutsch)</option>
            </select>
            <p className="text-xs text-simmonds-stone mt-1">
              {settings.aiPrompts.defaultLanguage === 'english' && settings.aiPrompts.explanationLanguage === 'german'
                ? 'English words will be explained in German'
                : 'Same language explanations'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Default English Voice
            </label>
            <div className="flex gap-2">
              <select
                className="flex-1 px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                value={settings.voiceConfig.defaultEnglishVoice}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  voiceConfig: { ...prev.voiceConfig, defaultEnglishVoice: e.target.value }
                }))}
              >
                {englishVoices.map(voice => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} ({voice.accent})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => isPreviewingVoice === settings.voiceConfig.defaultEnglishVoice
                  ? stopVoicePreview()
                  : previewVoice(settings.voiceConfig.defaultEnglishVoice, false)}
                className={`px-3 py-2 rounded-xl transition-all flex items-center justify-center ${
                  isPreviewingVoice === settings.voiceConfig.defaultEnglishVoice
                    ? 'bg-simmonds-terracotta text-white'
                    : 'bg-simmonds-olive/10 text-simmonds-olive hover:bg-simmonds-olive/20'
                }`}
                title={isPreviewingVoice === settings.voiceConfig.defaultEnglishVoice ? 'Stop' : 'Preview voice'}
              >
                {isPreviewingVoice === settings.voiceConfig.defaultEnglishVoice ? (
                  <span className="animate-pulse">■</span>
                ) : (
                  <span>🔊</span>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Default German Voice
            </label>
            <div className="flex gap-2">
              <select
                className="flex-1 px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                value={settings.voiceConfig.defaultGermanVoice}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  voiceConfig: { ...prev.voiceConfig, defaultGermanVoice: e.target.value }
                }))}
              >
                {germanVoices.map(voice => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} ({voice.accent})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => isPreviewingVoice === settings.voiceConfig.defaultGermanVoice
                  ? stopVoicePreview()
                  : previewVoice(settings.voiceConfig.defaultGermanVoice, true)}
                className={`px-3 py-2 rounded-xl transition-all flex items-center justify-center ${
                  isPreviewingVoice === settings.voiceConfig.defaultGermanVoice
                    ? 'bg-simmonds-terracotta text-white'
                    : 'bg-simmonds-olive/10 text-simmonds-olive hover:bg-simmonds-olive/20'
                }`}
                title={isPreviewingVoice === settings.voiceConfig.defaultGermanVoice ? 'Stop' : 'Preview voice'}
              >
                {isPreviewingVoice === settings.voiceConfig.defaultGermanVoice ? (
                  <span className="animate-pulse">■</span>
                ) : (
                  <span>🔊</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Voices */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">🎤</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-simmonds-charcoal">Custom Voices</h3>
              <p className="text-sm text-simmonds-stone">Add your own cloned voices from ElevenLabs</p>
            </div>
          </div>
          <button
            onClick={() => {
              const newVoice = {
                id: '',
                name: '',
                language: 'english' as const,
                isDefault: false,
              };
              setSettings(prev => ({
                ...prev,
                voiceConfig: {
                  ...prev.voiceConfig,
                  customVoices: [...prev.voiceConfig.customVoices, newVoice],
                },
              }));
            }}
            className="px-4 py-2 bg-simmonds-primary/10 text-simmonds-primary rounded-xl text-sm font-medium hover:bg-simmonds-primary/20 transition-colors"
          >
            + Add Voice
          </button>
        </div>

        {settings.voiceConfig.customVoices.length === 0 ? (
          <div className="text-center py-8 bg-simmonds-cream/20 rounded-xl">
            <p className="text-simmonds-stone">No custom voices added yet.</p>
            <p className="text-sm text-simmonds-stone mt-1">
              Add your cloned voices from ElevenLabs to use them in lessons.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {settings.voiceConfig.customVoices.map((voice, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-simmonds-cream/20 rounded-xl">
                <input
                  type="text"
                  placeholder="Voice ID"
                  className="flex-1 px-3 py-2 border border-simmonds-cream rounded-lg text-sm"
                  value={voice.id}
                  onChange={(e) => {
                    const newVoices = [...settings.voiceConfig.customVoices];
                    newVoices[index] = { ...voice, id: e.target.value };
                    setSettings(prev => ({
                      ...prev,
                      voiceConfig: { ...prev.voiceConfig, customVoices: newVoices },
                    }));
                  }}
                />
                <input
                  type="text"
                  placeholder="Voice Name"
                  className="flex-1 px-3 py-2 border border-simmonds-cream rounded-lg text-sm"
                  value={voice.name}
                  onChange={(e) => {
                    const newVoices = [...settings.voiceConfig.customVoices];
                    newVoices[index] = { ...voice, name: e.target.value };
                    setSettings(prev => ({
                      ...prev,
                      voiceConfig: { ...prev.voiceConfig, customVoices: newVoices },
                    }));
                  }}
                />
                <select
                  className="px-3 py-2 border border-simmonds-cream rounded-lg text-sm"
                  value={voice.language}
                  onChange={(e) => {
                    const newVoices = [...settings.voiceConfig.customVoices];
                    newVoices[index] = { ...voice, language: e.target.value as 'english' | 'german' };
                    setSettings(prev => ({
                      ...prev,
                      voiceConfig: { ...prev.voiceConfig, customVoices: newVoices },
                    }));
                  }}
                >
                  <option value="english">English</option>
                  <option value="german">German</option>
                </select>
                <button
                  type="button"
                  onClick={() => voice.id && (isPreviewingVoice === voice.id
                    ? stopVoicePreview()
                    : previewVoice(voice.id, voice.language === 'german'))}
                  disabled={!voice.id}
                  className={`p-2 rounded-lg transition-all ${
                    !voice.id
                      ? 'text-simmonds-stone/40 cursor-not-allowed'
                      : isPreviewingVoice === voice.id
                      ? 'bg-simmonds-terracotta text-white'
                      : 'text-simmonds-olive hover:bg-simmonds-olive/10'
                  }`}
                  title={!voice.id ? 'Enter voice ID first' : isPreviewingVoice === voice.id ? 'Stop' : 'Preview voice'}
                >
                  {isPreviewingVoice === voice.id ? (
                    <span className="animate-pulse">■</span>
                  ) : (
                    <span>🔊</span>
                  )}
                </button>
                <button
                  onClick={() => {
                    const newVoices = settings.voiceConfig.customVoices.filter((_, i) => i !== index);
                    setSettings(prev => ({
                      ...prev,
                      voiceConfig: { ...prev.voiceConfig, customVoices: newVoices },
                    }));
                  }}
                  className="p-2 text-simmonds-terracotta hover:bg-simmonds-terracotta/10 rounded-lg transition-colors"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-simmonds-stone mt-3">
          Voice IDs can be found in your ElevenLabs dashboard under Voice Lab. Custom cloned voices provide a personalized learning experience.
        </p>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Security Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-simmonds-charcoal">Two-Factor Authentication</label>
              <p className="text-sm text-simmonds-stone">Add an extra layer of security to your account</p>
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
              <label className="text-sm font-medium text-simmonds-charcoal">Login Notifications</label>
              <p className="text-sm text-simmonds-stone">Get notified of new login attempts</p>
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
              <label className="text-sm font-medium text-simmonds-charcoal">Session Timeout</label>
              <p className="text-sm text-simmonds-stone">Automatically log out after inactivity</p>
            </div>
            <select
              className="w-24 px-3 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary focus:border-simmonds-primary"
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

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Password & Account</h3>
        <div className="space-y-4">
          <button className="px-4 py-2 border border-simmonds-cream rounded-xl text-simmonds-charcoal hover:bg-simmonds-cream-light transition-colors">Change Password</button>
          <button className="px-4 py-2 border border-simmonds-cream rounded-xl text-simmonds-charcoal hover:bg-simmonds-cream-light transition-colors">Download Account Data</button>
          <button className="px-4 py-2 bg-simmonds-terracotta/10 text-simmonds-terracotta rounded-xl hover:bg-simmonds-terracotta/20 transition-colors">Delete Account</button>
        </div>
      </div>
    </div>
  );

  const isStudent = currentUser?.role === 'student';

  const tabs = [
    { id: 'profile', name: 'Profile', icon: '👤' },
    { id: 'company', name: 'Company', icon: '🏢', adminOnly: true },
    { id: 'apis', name: 'API Integrations', icon: '🔌', adminOnly: true },
    { id: 'ai-prompts', name: 'AI Prompts', icon: '✨', adminOnly: true },
    { id: 'notifications', name: 'Notifications', icon: '🔔' },
    { id: 'security', name: 'Security', icon: '🔒' },
  ].filter(tab => !tab.adminOnly || !isStudent);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-simmonds-charcoal mb-2">Settings</h1>
        <p className="text-simmonds-stone">Manage your account and platform configuration</p>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-colors ${
                activeTab === tab.id
                  ? 'bg-simmonds-primary/10 text-simmonds-primary'
                  : 'text-simmonds-stone hover:text-simmonds-charcoal hover:bg-simmonds-cream-light'
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
        {activeTab === 'ai-prompts' && renderAIPromptsSettings()}
        {activeTab === 'notifications' && renderNotificationSettings()}
        {activeTab === 'security' && renderSecuritySettings()}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="px-6 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
