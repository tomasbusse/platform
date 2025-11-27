# Platform - Epic Breakdown

**Author:** Tomas
**Date:** 2025-11-10
**Project Level:** Enterprise
**Target Scale:** Multi-tenant (1000+ users per client)

---

## Overview

This document provides the complete epic and story breakdown for Platform, decomposing the requirements from the [System Architecture](./system-architecture.md) and [UX Design Specification](./ux-design-specification.md) into implementable stories.

The Language School Management Platform will serve three distinct user types through a modern, AI-powered interface designed to provide positive learning experiences while enabling efficient management by administrators and teachers.

## Epic Structure Analysis

Based on the comprehensive documentation, I've identified 6 major epics that form natural value-delivering capabilities:

1. **Foundation & Infrastructure Epic** - Establishes the technical foundation enabling all subsequent features
2. **User Management & Authentication Epic** - Multi-tenant user system with role-based access control  
3. **Corporate Client Management Epic** - B2B onboarding, management, and analytics for enterprise clients
4. **Learning & Assessment Epic** - Core learning management, testing, and progress tracking capabilities
5. **Content Creation & AI Integration Epic** - AI-powered content generation and audio integration
6. **Communication & Analytics Epic** - Email systems, notifications, and business intelligence

This structure enables:
- Independent value delivery in each epic
- Logical technical dependencies (Foundation → Management → Learning → Content → Communication)
- Clear business value for each capability
- Realistic development timelines (4-6 weeks per epic)

---

## Epic 1: Foundation & Infrastructure

**Epic Goal:** Establish the technical foundation and development environment that enables all platform features, including Convex database, React frontend, authentication system, and deployment infrastructure.

### Story 1.1: Project Infrastructure Setup

As a developer,
I want a complete project setup with database schema, React frontend, and development environment,
So that I can build and deploy the language school platform features efficiently.

**Acceptance Criteria:**

**Given** A fresh development environment
**When** I start the project setup
**Then** I have Convex database with 10+ tables, React TypeScript app with Tailwind CSS, and working development server

**And** The project structure follows our architecture design with proper folder organization
**And** Convex development server runs successfully with real-time database capabilities
**And** Frontend builds without errors and serves on localhost:3000

**Prerequisites:** Convex project already initialized

**Technical Notes:** 
- Convex schema should include: users, companies, groups, tests, test_sessions, lessons, progress, notifications, analytics, system_config tables
- React app should include: TypeScript, Tailwind CSS, routing, state management (Zustand)
- Development tools: ESLint, Prettier, testing setup
- Environment variables: Convex URL, deployment configuration

---

### Story 1.2: Authentication & Authorization System

As a user,
I want to securely log in with email/password and access different interfaces based on my role,
So that I can safely access features appropriate for my role (admin, teacher, or student).

**Acceptance Criteria:**

**Given** The foundational project setup from Story 1.1
**When** I log in with my credentials
**Then** I am authenticated and can access the appropriate dashboard based on my role

**And** Corporate admins see client management and analytics interfaces
**And** Teachers see group management and content creation interfaces  
**And** Students see learning interface with tests and progress
**And** Multi-tenant data isolation ensures users only see their company's data
**And** Session management works across browser refreshes and tabs

**Prerequisites:** Story 1.1 completed

**Technical Notes:**
- Use Convex Auth for authentication
- Role-based access control: super_admin, school_admin, corporate_admin, teacher, student
- Company-based data isolation for multi-tenant architecture
- JWT token management and refresh
- Password reset functionality

---

## Epic 2: User Management & Authentication

**Epic Goal:** Build comprehensive user management system supporting corporate client onboarding, multi-role user creation, group assignment, and employee management for enterprise language training programs.

### Story 2.1: Corporate Client Onboarding

As a corporate client administrator,
I want to register my company and configure our language training program,
So that I can onboard employees for English assessment and group assignment.

**Acceptance Criteria:**

**Given** The authentication system from Epic 1
**When** I complete the company registration form
**Then** My company account is created with trial status and can manage employee accounts

**And** I can configure training parameters (test frequency, auto-grouping, email preferences)
**And** I receive welcome email with platform access instructions
**And** The system sets up proper data isolation for our company
**And** I can access the corporate client management dashboard

**Prerequisites:** Epic 1 completed

**Technical Notes:**
- Company registration with business details and contact information
- Trial period configuration (default 30 days)
- Business logic for enterprise client onboarding
- Welcome email integration with Resend
- Corporate dashboard with company-specific data

---

### Story 2.2: Employee Management System

As a corporate administrator,
I want to invite and manage employee accounts for language training,
So that I can assign employees to appropriate groups and track their progress.

**Acceptance Criteria:**

**Given** Company onboarding from Story 2.1
**When** I add employees to our company
**Then** Employee accounts are created and can be assigned to language learning groups

**And** I can send assessment invitations via email with unique links
**And** Employee accounts are properly associated with our company
**And** I can manage employee status (active, inactive, pending)
**And** I can view all company employees in a management interface
**And** Bulk employee import from CSV files is supported

**Prerequisites:** Story 2.1 completed

**Technical Notes:**
- Employee invitation system with email links
- Bulk CSV import functionality
- Employee status management
- Company-employee data relationships
- Email integration for invitations and notifications

---

## Epic 3: Corporate Client Management

**Epic Goal:** Provide comprehensive management tools for corporate clients to monitor employee progress, view analytics, manage training programs, and track business metrics for their language learning initiatives.

### Story 3.1: Corporate Dashboard & Analytics

As a corporate client administrator,
I want to view comprehensive analytics about our employees' language learning progress and training effectiveness,
So that I can make data-driven decisions about our language training program and ROI.

**Acceptance Criteria:**

**Given** Employee management from Epic 2
**When** I access the corporate dashboard
**Then** I see real-time analytics about our training program performance

**And** I can view employee assessment scores and progress over time
**And** I can see group completion rates and average scores
**And** I can export reports for management reporting
**And** I can compare different time periods and groups
**And** I can track training program ROI and effectiveness metrics

**Prerequisites:** Epic 2 completed

**Technical Notes:**
- Real-time analytics dashboard with charts and metrics
- Data aggregation and business intelligence
- Report generation and export capabilities
- Time-series data for progress tracking
- KPI tracking for training program effectiveness

---

### Story 3.2: Training Program Configuration

As a corporate client administrator,
I want to configure our language training program settings and group allocation rules,
So that the system automatically assigns employees to appropriate groups based on their assessment results.

**Acceptance Criteria:**

**Given** Corporate dashboard from Story 3.1
**When** I configure our training program settings
**Then** The system automatically manages group assignments and training schedules according to our rules

**And** I can set automatic group allocation based on assessment scores
**And** I can configure test frequency requirements (monthly, quarterly, etc.)
**And** I can customize group size limits and scheduling preferences
**And** I can set up custom learning paths and progression requirements
**And** I can configure notification preferences for updates and reminders

**Prerequisites:** Story 3.1 completed

**Technical Notes:**
- Rule-based group allocation algorithms
- Configuration management for corporate settings
- Automated scheduling and assignment logic
- Custom business rule engine
- Preference management system

---

## Epic 4: Learning & Assessment

**Epic Goal:** Create the core learning management system including test taking, progress tracking, lesson scheduling, and teacher tools for managing group-based English language training programs.

### Story 4.1: Assessment System with Cambridge Integration

As a student,
I want to take comprehensive English assessments that align with Cambridge English standards,
So that I can get accurate level assessment and be assigned to the appropriate learning group.

**Acceptance Criteria:**

**Given** User management from Epic 2
**When** I am invited to take an English assessment
**Then** I can complete a comprehensive test that evaluates my skills across reading, listening, writing, and speaking

**And** The test interface provides a positive, encouraging experience
**And** Tests align with Cambridge English standards (A1-C2 levels)
**And** Results are processed and scores calculated automatically
**And** I am automatically assigned to appropriate groups based on my level
**And** My teacher and company administrator can see my results and progress

**Prerequisites:** Epic 2 completed

**Technical Notes:**
- Cambridge English API integration for standardized testing
- Web-based test interface with audio capabilities
- Automatic scoring and level determination
- Group allocation algorithm based on scores
- Real-time progress tracking and result distribution

---

### Story 4.2: Learning Management & Progress Tracking

As a student,
I want to track my learning progress and access lessons assigned to my group,
So that I can see my improvement over time and understand what I need to work on.

**Acceptance Criteria:**

**Given** Assessment system from Story 4.1
**When** I access my learning dashboard
**Then** I can see my progress, assigned lessons, and upcoming activities

**And** I can view my assessment history and score improvements
**And** I can access lessons and content assigned to my learning group
**And** I can see my skill level progression (reading, listening, writing, speaking)
**And** I can track learning streaks and achievements
**And** I receive encouraging feedback and next steps

**Prerequisites:** Story 4.1 completed

**Technical Notes:**
- Progress tracking across multiple skill areas
- Learning path management and content delivery
- Achievement and gamification system
- Personal dashboard with motivational design
- Skill-specific progress indicators

---

### Story 4.3: Teacher Group Management

As a language teacher,
I want to manage my assigned groups, schedule lessons, and track student attendance and progress,
So that I can effectively deliver language instruction and support student learning.

**Acceptance Criteria:**

**Given** Learning management from Story 4.2
**When** I access my teacher interface
**Then** I can manage my groups, schedule lessons, and monitor student progress

**And** I can view all students assigned to my groups with their current levels
**And** I can schedule lessons with calendar integration
**And** I can take attendance and track student participation
**And** I can create and assign custom content and exercises
**And** I can monitor group progress and individual student achievements
**And** I can communicate with students and provide feedback

**Prerequisites:** Story 4.2 completed

**Technical Notes:**
- Teacher-specific dashboard and management interface
- Calendar integration for lesson scheduling
- Attendance tracking and management
- Content creation tools for teachers
- Student communication system

---

## Epic 5: Content Creation & AI Integration

**Epic Goal:** Implement AI-powered content generation and audio integration to create engaging, personalized learning content and listening exercises that enhance the learning experience.

### Story 5.1: AI Content Generation with OpenRouter

As a teacher,
I want to generate custom English learning content and quizzes using AI,
So that I can create personalized exercises tailored to my students' specific needs and interests.

**Acceptance Criteria:**

**Given** Teacher group management from Epic 4
**When** I request AI-generated content
**Then** The system creates high-quality English learning exercises and quizzes

**And** Content is generated using OpenRouter API with Claude or other models
**And** Generated content includes multiple choice questions, fill-in-the-blank, and comprehension exercises
**And** Content quality is automatically validated before being assigned to students
**And** I can review and edit generated content before publishing
**And** Content is automatically adapted to the skill level of my group

**Prerequisites:** Epic 4 completed

**Technical Notes:**
- OpenRouter API integration for content generation
- AI content quality validation and review workflow
- Content template system for different exercise types
- Teacher review and editing interface
- Level-appropriate content generation algorithms

---

### Story 5.2: Audio Integration with ElevenLabs

As a teacher,
I want to add high-quality audio to learning content and create listening exercises,
So that students can develop their listening skills with natural-sounding speech.

**Acceptance Criteria:**

**Given** AI content generation from Story 5.1
**When** I add audio to content or create listening exercises
**Then** The system generates natural-sounding speech using ElevenLabs TTS

**And** Audio content is generated in multiple English accents and voice styles
**And** Listening exercises are created with audio prompts and comprehension questions
**And** Audio quality is high and suitable for language learning
**And** Students can replay audio multiple times and control playback speed
**And** Audio content is automatically generated for existing text content

**Prerequisites:** Story 5.1 completed

**Technical Notes:**
- ElevenLabs API integration for text-to-speech
- Audio content generation and management
- Multiple voice and accent options
- Web Audio API integration for playback control
- Automatic audio generation for text content

---

## Epic 6: Communication & Analytics

**Epic Goal:** Implement comprehensive email communication, automated notifications, and advanced analytics to enhance engagement, provide insights, and support business intelligence for all stakeholders.

### Story 6.1: Email Communication System

As a platform administrator,
I want to send automated emails and notifications to users based on their activities and progress,
So that all stakeholders stay informed about important updates, assignments, and achievements.

**Acceptance Criteria:**

**Given** Audio integration from Epic 5
**When** Users perform key activities in the platform
**Then** The system automatically sends relevant email notifications

**And** Assessment invitations are sent to new students
**And** Results notifications are sent after test completion
**And** Group assignment notifications include class schedules and login details
**And** Progress updates are sent to corporate administrators
**And** Achievement celebrations are sent to students
**And** Email templates are branded and professional

**Prerequisites:** Epic 5 completed

**Technical Notes:**
- Resend API integration for transactional emails
- Automated email triggers based on user actions
- Professional email template system
- Email delivery tracking and analytics
- Unsubscribe and preference management

---

### Story 6.2: Advanced Analytics & Reporting

As a corporate client administrator,
I want comprehensive analytics and reporting about our language training program effectiveness,
So that I can demonstrate ROI, identify improvement opportunities, and make strategic decisions.

**Acceptance Criteria:**

**Given** Email system from Story 6.1
**When** I access the analytics dashboard
**Then** I see comprehensive business intelligence and program effectiveness metrics

**And** I can view detailed progress reports for individual employees and groups
**And** I can analyze training program ROI and cost-effectiveness
**And** I can track improvement trends and identify struggling students
**And** I can export executive summary reports for management
**And** I can compare performance across different time periods and groups
**And** I can set up automated reporting schedules

**Prerequisites:** Story 6.1 completed

**Technical Notes:**
- Advanced business intelligence and analytics engine
- Comprehensive reporting system with export capabilities
- Trend analysis and predictive insights
- Executive dashboard with key metrics
- Automated report generation and scheduling

---

## Epic Breakdown Summary

This epic breakdown creates a logical progression from technical foundation to advanced features, ensuring each epic delivers independent business value:

- **Epic 1 (Foundation)** enables all subsequent development
- **Epic 2-3 (Management)** delivers core administrative value
- **Epic 4 (Learning)** provides the primary user value proposition
- **Epic 5 (Content)** enhances learning with AI-powered features
- **Epic 6 (Communication)** provides business intelligence and engagement

Each story is sized for single-session completion by development agents, with clear BDD-style acceptance criteria and technical implementation guidance. The sequence ensures proper dependencies while allowing for parallel development in some areas.

---

_For implementation: Use the `create-story` workflow to generate individual story implementation plans from this epic breakdown._