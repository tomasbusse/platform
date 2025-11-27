// User Management Types
export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student' | 'corporate_admin';
  companyId: string;
  isActive: boolean;
  currentLevel?: string;
  targetLevel?: string;
  totalScore: number;
  averageScore: number;
  completedTests: number;
  lastLogin?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Company {
  _id: string;
  name: string;
  contactEmail: string;
  contactPhone?: string;
  domain?: string;
  description?: string;
  subscriptionPlan: 'trial' | 'basic' | 'premium' | 'enterprise';
  subscriptionStatus: 'active' | 'inactive' | 'cancelled';
  maxStudents: number;
  currentStudentCount: number;
  settings?: any;
  createdAt: number;
  updatedAt: number;
}

export interface Group {
  _id: string;
  name: string;
  companyId: string;
  level: string;
  teacherId: string;
  maxStudents: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Test {
  _id: string;
  name: string;
  companyId: string;
  testType: 'placement' | 'progress' | 'final' | 'custom';
  level: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TestSession {
  _id: string;
  testId: string;
  userId: string;
  companyId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'expired';
  totalScore: number;
  createdAt: number;
  updatedAt: number;
}

export interface Lesson {
  _id: string;
  title: string;
  companyId: string;
  level: string;
  type: string;
  isPublished: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Progress {
  _id: string;
  userId: string;
  companyId: string;
  currentLevel: string;
  overallScore: number;
  completedLessons: number;
  lastActivity: number;
  createdAt: number;
  updatedAt: number;
}

export interface Notification {
  _id: string;
  userId: string;
  companyId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'reminder';
  isRead: boolean;
  createdAt: number;
}

export interface AuditLog {
  _id: string;
  companyId: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  newValues?: any;
  timestamp: number;
}

// Form Data Types
export interface CompanyFormData {
  name: string;
  contactEmail: string;
  contactPhone?: string;
  domain?: string;
  description?: string;
  maxStudents: number;
  address?: string;
}

export interface EmployeeFormData {
  name: string;
  email: string;
  role: string;
  currentLevel: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Dashboard Statistics
export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  totalGroups: number;
  averageScore: number;
  completedTests: number;
  pendingInvitations: number;
}

// Filter Types
export interface EmployeeFilter {
  role: 'all' | 'student' | 'teacher' | 'admin';
  status: 'all' | 'active' | 'inactive';
  search: string;
}

export interface GroupFilter {
  level: 'all' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  status: 'all' | 'active' | 'inactive';
  search: string;
}