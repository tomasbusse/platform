export interface DatabaseConfig {
  // Mock database configuration for development
  type: 'mock' | 'convex' | 'firebase' | 'supabase';
  connectionString?: string;
  apiKey?: string;
}

// Mock data storage for development
export class MockDatabase {
  private static instance: MockDatabase;
  private data: Map<string, any[]> = new Map();

  static getInstance(): MockDatabase {
    if (!MockDatabase.instance) {
      MockDatabase.instance = new MockDatabase();
    }
    return MockDatabase.instance;
  }

  async insert(table: string, data: any): Promise<string> {
    if (!this.data.has(table)) {
      this.data.set(table, []);
    }
    const records = this.data.get(table)!;
    const newRecord = {
      ...data,
      _id: `${table}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: data.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    records.push(newRecord);
    return newRecord._id;
  }

  async get(table: string, id: string): Promise<any | null> {
    const records = this.data.get(table) || [];
    return records.find(r => r._id === id) || null;
  }

  async query(table: string, filter?: (item: any) => boolean): Promise<any[]> {
    let records = this.data.get(table) || [];
    if (filter) {
      records = records.filter(filter);
    }
    return records;
  }

  async patch(table: string, id: string, updates: any): Promise<void> {
    const records = this.data.get(table) || [];
    const recordIndex = records.findIndex(r => r._id === id);
    if (recordIndex !== -1) {
      records[recordIndex] = {
        ...records[recordIndex],
        ...updates,
        updatedAt: Date.now(),
      };
    }
  }

  async remove(table: string, id: string): Promise<void> {
    const records = this.data.get(table) || [];
    const filteredRecords = records.filter(r => r._id !== id);
    this.data.set(table, filteredRecords);
  }
}

// Database service class
export class DatabaseService {
  private config: DatabaseConfig;
  private db: MockDatabase;

  constructor(config: DatabaseConfig = { type: 'mock' }) {
    this.config = config;
    this.db = MockDatabase.getInstance();
    this.initializeMockData().catch(console.error);
  }

  private async initializeMockData() {
    // Initialize some mock data for testing
    const now = Date.now();
    
    // Sample company
    const existingCompanies = await this.db.query('companies');
    if (existingCompanies.length === 0) {
      await this.db.insert('companies', {
        name: 'TechCorp Language Academy',
        contactEmail: 'admin@techcorp.com',
        subscriptionPlan: 'professional',
        subscriptionStatus: 'active',
        maxStudents: 100,
        currentStudentCount: 45,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Sample users
    const existingUsers = await this.db.query('users');
    if (existingUsers.length === 0) {
      const companies = await this.db.query('companies');
      const company = companies[0];
      await this.db.insert('users', {
        name: 'John Admin',
        email: 'admin@techcorp.com',
        role: 'corporate_admin',
        companyId: company._id,
        isActive: true,
        currentLevel: 'C2',
        totalScore: 95,
        completedTests: 10,
        createdAt: now,
        updatedAt: now,
      });

      await this.db.insert('users', {
        name: 'Sarah Teacher',
        email: 'sarah.teacher@techcorp.com',
        role: 'teacher',
        companyId: company._id,
        isActive: true,
        currentLevel: 'C1',
        totalScore: 88,
        completedTests: 5,
        createdAt: now,
        updatedAt: now,
      });

      await this.db.insert('users', {
        name: 'Mike Student',
        email: 'mike.student@techcorp.com',
        role: 'student',
        companyId: company._id,
        isActive: true,
        currentLevel: 'B2',
        totalScore: 78,
        completedTests: 8,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Sample progress data
    const existingProgress = await this.db.query('progress');
    if (existingProgress.length === 0) {
      const students = await this.db.query('users', (user) => user.role === 'student');
      const companies = await this.db.query('companies');
      const company = companies[0];
      
      for (const student of students) {
        await this.db.insert('progress', {
          userId: student._id,
          companyId: company._id,
          currentLevel: student.currentLevel,
          overallScore: student.totalScore,
          totalSessions: student.completedTests,
          completedLessons: Math.floor(Math.random() * 50) + 10,
          totalLessons: 50,
          streakDays: Math.floor(Math.random() * 7) + 1,
          lastActivity: now - Math.floor(Math.random() * 86400000), // Random time in last day
          testHistory: [
            {
              testId: 'cambridge_assessment',
              sessionId: 'session_1',
              score: student.totalScore,
              level: student.currentLevel,
              date: now - 86400000, // Yesterday
            }
          ],
          skillScores: {
            reading: Math.floor(Math.random() * 30) + 70,
            listening: Math.floor(Math.random() * 30) + 65,
            writing: Math.floor(Math.random() * 30) + 60,
            speaking: Math.floor(Math.random() * 30) + 55,
          },
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Sample AI content
    const existingAIContent = await this.db.query('aiContent');
    if (existingAIContent.length === 0) {
      const companies = await this.db.query('companies');
      const company = companies[0];
      const users = await this.db.query('users');
      const teacher = users.find(user => user.role === 'teacher');
      
      await this.db.insert('aiContent', {
        companyId: company._id,
        createdBy: teacher?._id,
        type: 'lesson',
        level: 'B1',
        topic: 'Business English',
        prompt: 'Create a lesson about business email etiquette',
        generatedContent: 'This is a comprehensive lesson about business email etiquette...',
        model: 'gpt-4',
        wordCount: 150,
        topics: ['Business English', 'Email Writing'],
        reviewStatus: 'approved',
        isUsed: true,
        createdAt: now - 3600000, // 1 hour ago
        updatedAt: now,
      });
    }

    // Sample audio content
    const existingAudioContent = await this.db.query('audioContent');
    if (existingAudioContent.length === 0) {
      const companies = await this.db.query('companies');
      const company = companies[0];
      const users = await this.db.query('users');
      const teacher = users.find(user => user.role === 'teacher');
      
      await this.db.insert('audioContent', {
        companyId: company._id,
        createdBy: teacher?._id,
        type: 'lesson_audio',
        textContent: 'Welcome to today\'s business English lesson.',
        audioUrl: 'https://example.com/audio/lesson1.mp3',
        voiceId: 'voice_professional',
        voiceName: 'Professional Teacher',
        duration: 180, // 3 minutes
        language: 'en',
        quality: 'standard',
        isActive: true,
        createdAt: now - 7200000, // 2 hours ago
        updatedAt: now,
      });
    }
  }

  // User Management
  async registerCompany(data: any) {
    return await this.db.insert('companies', data);
  }

  async getCompany(companyId: string) {
    return await this.db.get('companies', companyId);
  }

  async getCompanyByEmail(email: string) {
    const companies = await this.db.query('companies');
    return companies.find(c => c.contactEmail === email) || null;
  }

  async addEmployee(data: any) {
    return await this.db.insert('users', data);
  }

  async getCompanyEmployees(companyId: string) {
    return await this.db.query('users', (user) => user.companyId === companyId);
  }

  async getUserByEmail(email: string) {
    const users = await this.db.query('users');
    return users.find(u => u.email === email) || null;
  }

  async updateUserStatus(userId: string, isActive: boolean) {
    await this.db.patch('users', userId, { isActive, updatedAt: Date.now() });
  }

  async getUsersByRole(companyId: string, role: string) {
    return await this.db.query('users', (user) => 
      user.companyId === companyId && user.role === role
    );
  }

  // Test Management
  async createTestSession(data: any) {
    return await this.db.insert('testSessions', data);
  }

  async getTestSession(sessionId: string) {
    return await this.db.get('testSessions', sessionId);
  }

  async updateTestSession(sessionId: string, updates: any) {
    await this.db.patch('testSessions', sessionId, updates);
  }

  async getUserTestSessions(userId: string) {
    return await this.db.query('testSessions', (session) => session.userId === userId);
  }

  // AI Content Management
  async createAIContent(data: any) {
    return await this.db.insert('aiContent', data);
  }

  async getAIContent(companyId: string) {
    return await this.db.query('aiContent', (content) => content.companyId === companyId);
  }

  async updateAIContent(contentId: string, updates: any) {
    await this.db.patch('aiContent', contentId, updates);
  }

  // Audio Content Management
  async createAudioContent(data: any) {
    return await this.db.insert('audioContent', data);
  }

  async getAudioContent(companyId: string) {
    return await this.db.query('audioContent', (content) => content.companyId === companyId);
  }

  // Progress Management
  async getUserProgress(userId: string) {
    const progressRecords = await this.db.query('progress', (p) => p.userId === userId);
    return progressRecords.length > 0 ? progressRecords[0] : null;
  }

  async getCompanyProgress(companyId: string) {
    return await this.db.query('progress', (p) => p.companyId === companyId);
  }

  async createOrUpdateProgress(userId: string, companyId: string, data: any) {
    const existing = await this.getUserProgress(userId);
    if (existing) {
      await this.db.patch('progress', existing._id, { ...data, updatedAt: Date.now() });
      return existing._id;
    } else {
      return await this.db.insert('progress', { userId, companyId, ...data });
    }
  }

  // Notifications
  async createNotification(data: any) {
    return await this.db.insert('notifications', data);
  }

  async getUserNotifications(userId: string) {
    return await this.db.query('notifications', (n) => n.userId === userId);
  }

  async markNotificationRead(notificationId: string) {
    await this.db.patch('notifications', notificationId, { 
      isRead: true, 
      readAt: Date.now() 
    });
  }

  // Settings Management
  async saveUserSettings(userId: string, settings: any) {
    // Remove existing settings first
    const existing = await this.db.query('settings', (s) => s.userId === userId);
    for (const setting of existing) {
      await this.db.remove('settings', setting._id);
    }

    // Insert new settings
    for (const [key, value] of Object.entries(settings)) {
      await this.db.insert('settings', {
        userId,
        settingKey: key,
        settingValue: value,
        category: 'user_preferences',
        isPublic: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  async getUserSettings(userId: string) {
    const settings = await this.db.query('settings', (s) => s.userId === userId);
    const settingsObj: any = {};
    settings.forEach(setting => {
      settingsObj[setting.settingKey] = setting.settingValue;
    });
    return settingsObj;
  }

  async saveCompanySettings(companyId: string, settings: any) {
    // Remove existing settings first
    const existing = await this.db.query('settings', (s) => s.companyId === companyId);
    for (const setting of existing) {
      await this.db.remove('settings', setting._id);
    }

    // Insert new settings
    for (const [key, value] of Object.entries(settings)) {
      await this.db.insert('settings', {
        companyId,
        settingKey: key,
        settingValue: value,
        category: 'company_config',
        isPublic: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Also update the company record's settings field to match Convex schema
    if (settings.apis) {
      const companySettings = {
        openRouterApiKey: settings.apis.openrouter?.apiKey || '',
        elevenLabsApiKey: settings.apis.elevenlabs?.apiKey || '',
        resendApiKey: settings.apis.resend?.apiKey || '',
        cambridgeApiKey: settings.apis.cambridge?.apiKey || '',
        testFrequency: settings.company?.testFrequency || 30,
        autoGrouping: settings.company?.autoGrouping !== undefined ? settings.company.autoGrouping : true,
        emailNotifications: settings.company?.emailNotifications !== undefined ? settings.company.emailNotifications : true,
      };

      await this.db.patch('companies', companyId, {
        settings: companySettings,
        updatedAt: Date.now(),
      });
    }
  }

  async getCompanySettings(companyId: string) {
    const settings = await this.db.query('settings', (s) => s.companyId === companyId);
    const settingsObj: any = {};
    settings.forEach(setting => {
      settingsObj[setting.settingKey] = setting.settingValue;
    });
    return settingsObj;
  }

  // Analytics
  async getDashboardStats(companyId: string) {
    const users = await this.db.query('users', (u) => u.companyId === companyId);
    const progress = await this.db.query('progress', (p) => p.companyId === companyId);
    
    const totalEmployees = users.length;
    const activeEmployees = users.filter(u => u.isActive).length;
    const averageScore = users.reduce((sum, u) => sum + (u.totalScore || 0), 0) / users.length || 0;
    const completedTests = users.reduce((sum, u) => sum + (u.completedTests || 0), 0);
    
    return {
      totalEmployees,
      activeEmployees,
      totalGroups: Math.ceil(activeEmployees / 8), // Estimate groups
      averageScore: Math.round(averageScore),
      completedTests,
      pendingInvitations: 3, // Mock value
    };
  }
}

// Export singleton instance
export const db = new DatabaseService();