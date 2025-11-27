import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';

interface PageComponentProps {
  currentUser: User | null;
  company: Company | null;
}

const EmailSystem: React.FC<PageComponentProps> = ({ currentUser, company }) => {
  const [activeTab, setActiveTab] = useState('campaigns');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<Id<"companies"> | null>(
    company?._id as Id<"companies"> || null
  );

  // Check if user is super-admin (can manage all companies)
  const isSuperAdmin = currentUser?.role === 'admin';

  // Get all companies for super-admin
  const allCompanies = useQuery(
    api.companies.getAllCompanies,
    isSuperAdmin ? {} : 'skip'
  );

  // Use selected company for super-admin, or current company for others
  const activeCompanyId = isSuperAdmin && selectedCompanyId ? selectedCompanyId : company?._id as Id<"companies">;

  // Get selected company details for super-admin
  const selectedCompanyDetails = useQuery(
    api.companies.getCompanyDetails,
    isSuperAdmin && selectedCompanyId ? { companyId: selectedCompanyId } : 'skip'
  );

  // Use selected company settings when available
  const activeCompanySettings = isSuperAdmin && selectedCompanyDetails
    ? selectedCompanyDetails.settings
    : company?.settings;

  // Convex queries
  const employees = useQuery(
    api.userManagement.getCompanyEmployees,
    activeCompanyId ? { companyId: activeCompanyId } : 'skip'
  );

  const notifications = useQuery(
    api.notifications.getUserNotifications,
    currentUser ? { userId: currentUser._id as Id<"users"> } : 'skip'
  );

  // Query pending invitations
  const pendingInvitations = useQuery(
    api.assessmentInvitations.getCompanyInvitations,
    activeCompanyId ? { companyId: activeCompanyId, status: 'pending' } : 'skip'
  );

  // Mutations for assessment invitations
  const createInvitation = useMutation(api.assessmentInvitations.createInvitation);
  const bulkCreateInvitations = useMutation(api.assessmentInvitations.bulkCreateInvitations);

  // Form state for test invitation
  const [invitationEmail, setInvitationEmail] = useState('');
  const [invitationName, setInvitationName] = useState('');
  const [testType, setTestType] = useState<'placement' | 'follow_up' | 'level_assessment' | 'practice' | 'diagnostic' | 'certification'>('placement');
  const [expiryDays, setExpiryDays] = useState(7);

  // Form state for bulk assessment invitations
  const [bulkAssessmentEmails, setBulkAssessmentEmails] = useState('');
  const [bulkTestType, setBulkTestType] = useState<'placement' | 'follow_up' | 'level_assessment' | 'practice' | 'diagnostic' | 'certification'>('placement');

  // Legacy form state for test invitation (keeping for backward compatibility)
  const [legacyInvitationEmail, setLegacyInvitationEmail] = useState('');
  const [legacyTestType, setLegacyTestType] = useState('placement');

  // Form state for bulk email
  const [bulkRecipients, setBulkRecipients] = useState<'all' | 'level' | 'custom'>('all');
  const [selectedLevel, setSelectedLevel] = useState('A1');
  const [customEmails, setCustomEmails] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');

  // Form state for template editing
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateBody, setTemplateBody] = useState('');

  // Helper function to get test type display name
  const getTestTypeDisplayName = (type: string) => {
    const names: Record<string, string> = {
      placement: 'Placement Test',
      follow_up: 'Follow-up Test',
      level_assessment: 'Level Assessment',
      practice: 'Practice Quiz',
      diagnostic: 'Diagnostic Test',
      certification: 'Certification Test',
    };
    return names[type] || type;
  };

  // Email sending function using Resend API
  const sendEmail = async (to: string[], subject: string, htmlContent: string) => {
    const apiKey = activeCompanySettings?.resendApiKey;
    if (!apiKey) {
      throw new Error('Resend API key not configured. Please add it in Settings.');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Simmonds Language Services <noreply@simmonds.online>',
        to: to,
        subject: subject,
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send email');
    }

    return await response.json();
  };

  // Send public assessment invitation (no login required)
  const sendPublicAssessmentInvitation = async () => {
    if (!currentUser || !activeCompanyId || !invitationEmail || !invitationName) return;

    setIsLoading(true);
    try {
      // Create invitation in Convex
      const result = await createInvitation({
        companyId: activeCompanyId,
        email: invitationEmail,
        name: invitationName,
        testType: testType,
        expiryDays: expiryDays,
        createdBy: currentUser._id as Id<"users">,
      });

      const assessmentUrl = `${window.location.origin}/assessment/${result.token}`;

      // Send email with assessment link
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2D5A27; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #2D5A27; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
            .info-box { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2D5A27; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Simmonds Language Services</h1>
              <p style="margin: 0; opacity: 0.9;">English Proficiency Assessment</p>
            </div>
            <div class="content">
              <h2>Hello ${invitationName},</h2>
              <p>You have been invited to complete an English proficiency assessment. This test will help us determine your current English level and place you in the appropriate learning group.</p>

              <div class="info-box">
                <strong>Assessment Details:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li><strong>Type:</strong> ${getTestTypeDisplayName(testType)}</li>
                  <li><strong>Duration:</strong> Approximately 30-45 minutes</li>
                  <li><strong>Questions:</strong> 20 questions across grammar, vocabulary, and reading</li>
                  <li><strong>Link expires:</strong> ${new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toLocaleDateString()}</li>
                </ul>
              </div>

              <p><strong>No login required!</strong> Simply click the button below to start your assessment.</p>

              <center>
                <a href="${assessmentUrl}" class="button">Start Assessment</a>
              </center>

              <p style="font-size: 12px; color: #666;">Or copy this link: ${assessmentUrl}</p>

              <p>After completing the assessment, you will receive your results immediately and be automatically assigned to an appropriate learning group based on your performance.</p>

              <p>If you have any questions, please contact your administrator.</p>

              <p>Best regards,<br><strong>Simmonds Language Services Team</strong></p>
            </div>
            <div class="footer">
              <p>This email was sent by Simmonds Language Services</p>
              <p style="font-size: 10px;">If you did not expect this email, please ignore it.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      if (activeCompanySettings?.resendApiKey) {
        await sendEmail(
          [invitationEmail],
          `English Assessment Invitation - ${getTestTypeDisplayName(testType)}`,
          htmlContent
        );
      }

      alert(`Assessment invitation sent successfully!\n\nLink: ${assessmentUrl}\n\nThis link has been copied to your clipboard.`);

      // Copy link to clipboard
      navigator.clipboard.writeText(assessmentUrl).catch(() => {});

      // Reset form
      setInvitationEmail('');
      setInvitationName('');
    } catch (error) {
      console.error('Error sending invitation:', error);
      alert(`Failed to create invitation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Send bulk public assessment invitations
  const sendBulkAssessmentInvitations = async () => {
    if (!currentUser || !activeCompanyId || !bulkAssessmentEmails) return;

    setIsLoading(true);
    try {
      // Parse emails (format: "Name <email>" or just "email" per line)
      const lines = bulkAssessmentEmails.split('\n').filter(line => line.trim());
      const invitations: { email: string; name: string }[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        // Try to match "Name <email>" format
        const match = trimmed.match(/^(.+?)\s*<(.+@.+)>$/);
        if (match) {
          invitations.push({ name: match[1].trim(), email: match[2].trim() });
        } else if (trimmed.includes('@')) {
          // Just email, use email prefix as name
          const email = trimmed;
          const name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          invitations.push({ name, email });
        }
      }

      if (invitations.length === 0) {
        throw new Error('No valid emails found. Use format: "Name <email@example.com>" or just "email@example.com"');
      }

      // Create invitations in Convex
      const result = await bulkCreateInvitations({
        companyId: activeCompanyId,
        invitations: invitations,
        testType: bulkTestType,
        expiryDays: expiryDays,
        createdBy: currentUser._id as Id<"users">,
      });

      // Send emails if API key is configured
      if (activeCompanySettings?.resendApiKey) {
        let sentCount = 0;
        for (const inv of result.created) {
          try {
            const assessmentUrl = `${window.location.origin}/assessment/${inv.token}`;
            const htmlContent = `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: #2D5A27; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                  .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
                  .button { display: inline-block; background: #2D5A27; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
                  .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>Simmonds Language Services</h1>
                  </div>
                  <div class="content">
                    <h2>Hello ${inv.name},</h2>
                    <p>You have been invited to complete an English proficiency assessment.</p>
                    <center>
                      <a href="${assessmentUrl}" class="button">Start Assessment</a>
                    </center>
                    <p style="font-size: 12px; color: #666;">Link: ${assessmentUrl}</p>
                  </div>
                  <div class="footer">
                    <p>Simmonds Language Services</p>
                  </div>
                </div>
              </body>
              </html>
            `;
            await sendEmail([inv.email], 'English Assessment Invitation', htmlContent);
            sentCount++;
          } catch (e) {
            console.error(`Failed to send to ${inv.email}:`, e);
          }
        }
        alert(`Created ${result.created.length} invitations. Sent ${sentCount} emails successfully!`);
      } else {
        alert(`Created ${result.created.length} invitations. Configure Resend API key to send emails automatically.`);
      }

      setBulkAssessmentEmails('');
    } catch (error) {
      console.error('Error creating bulk invitations:', error);
      alert(`Failed to create invitations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestInvitation = async () => {
    if (!currentUser || !company || !employees || !legacyInvitationEmail) return;

    setIsLoading(true);
    try {
      const targetUser = employees.find(emp => emp.email === legacyInvitationEmail);

      if (!targetUser) {
        throw new Error(`User not found with email: ${legacyInvitationEmail}`);
      }

      const testUrl = `${window.location.origin}/test/${testType}`;
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2D5A27; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #2D5A27; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Simmonds Language Services</h1>
            </div>
            <div class="content">
              <h2>English Assessment Invitation</h2>
              <p>Hello ${targetUser.name},</p>
              <p>You have been invited to take an English ${getTestTypeDisplayName(testType)}.</p>
              <p>This assessment will help us understand your current English level and place you in the appropriate learning group.</p>
              <p><strong>Test Details:</strong></p>
              <ul>
                <li>Type: ${testType.charAt(0).toUpperCase() + testType.slice(1)} Test</li>
                <li>Estimated Duration: 30-45 minutes</li>
                <li>Sections: Grammar, Vocabulary, Reading, Listening</li>
              </ul>
              <center>
                <a href="${testUrl}" class="button">Start Assessment</a>
              </center>
              <p>If you have any questions, please contact your administrator.</p>
              <p>Best regards,<br>Simmonds Language Services Team</p>
            </div>
            <div class="footer">
              <p>This email was sent by Simmonds Language Services</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await sendEmail([invitationEmail], `English Assessment Invitation - ${testType.charAt(0).toUpperCase() + testType.slice(1)} Test`, htmlContent);

      alert(`Test invitation sent successfully to ${invitationEmail}!`);
      setInvitationEmail('');
    } catch (error) {
      console.error('Error sending invitation:', error);
      alert(`Failed to send invitation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const sendBulkEmail = async () => {
    if (!currentUser || !company || !employees || !emailSubject || !emailContent) return;

    setIsLoading(true);
    try {
      let recipients: string[] = [];

      if (bulkRecipients === 'all') {
        recipients = employees.filter(e => e.role === 'student' && e.email).map(e => e.email as string);
      } else if (bulkRecipients === 'level') {
        recipients = employees
          .filter(e => e.role === 'student' && e.currentLevel === selectedLevel && e.email)
          .map(e => e.email as string);
      } else {
        recipients = customEmails.split(',').map(e => e.trim()).filter(e => e);
      }

      if (recipients.length === 0) {
        throw new Error('No recipients found');
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2D5A27; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Simmonds Language Services</h1>
            </div>
            <div class="content">
              ${emailContent.split('\n').map(p => `<p>${p}</p>`).join('')}
            </div>
            <div class="footer">
              <p>This email was sent by Simmonds Language Services</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Send emails in batches to avoid rate limits
      const batchSize = 50;
      let sentCount = 0;

      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        try {
          await sendEmail(batch, emailSubject, htmlContent);
          sentCount += batch.length;
        } catch (error) {
          console.error(`Failed to send to batch starting at ${i}:`, error);
        }
      }

      alert(`Bulk email sent successfully to ${sentCount} recipients!`);
      setEmailSubject('');
      setEmailContent('');
      setCustomEmails('');
    } catch (error) {
      console.error('Error sending bulk email:', error);
      alert(`Failed to send emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const sendResultsEmail = async (userId: string, score: number, level: string) => {
    if (!activeCompanySettings?.resendApiKey) return;

    const user = employees?.find(e => e._id === userId);
    if (!user) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2D5A27; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .results { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
          .score { font-size: 48px; font-weight: bold; color: #2D5A27; }
          .level { font-size: 24px; color: #666; margin-top: 10px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Simmonds Language Services</h1>
          </div>
          <div class="content">
            <h2>Your Assessment Results</h2>
            <p>Hello ${user.name},</p>
            <p>Congratulations on completing your English assessment! Here are your results:</p>
            <div class="results">
              <div class="score">${score}%</div>
              <div class="level">Level: ${level}</div>
            </div>
            <p>Based on your results, you have been assigned to the <strong>${level} level</strong> group. You will receive information about your class schedule soon.</p>
            <p>Keep up the great work!</p>
            <p>Best regards,<br>Simmonds Language Services Team</p>
          </div>
          <div class="footer">
            <p>This email was sent by Simmonds Language Services</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      if (user.email) {
        await sendEmail([user.email], 'Your English Assessment Results', htmlContent);
      }
    } catch (error) {
      console.error('Failed to send results email:', error);
    }
  };

  const renderCampaigns = () => (
    <div className="space-y-6">
      {/* Company Selector for Super Admin */}
      {isSuperAdmin && allCompanies && (
        <div className="bg-white p-4 rounded-xl border border-simmonds-primary/30 shadow-sm">
          <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
            Select Company to Send Invitations For
          </label>
          <select
            className="w-full md:w-96 px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
            value={selectedCompanyId || ''}
            onChange={(e) => setSelectedCompanyId(e.target.value as Id<"companies">)}
          >
            <option value="">-- Select a Company --</option>
            {allCompanies
              .filter(c => c.isActive)
              .map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.stats?.students || 0} students)
                </option>
              ))}
          </select>
          {selectedCompanyId && selectedCompanyDetails && (
            <p className="text-sm text-simmonds-stone mt-2">
              Sending invitations for: <strong>{selectedCompanyDetails.name}</strong>
            </p>
          )}
        </div>
      )}

      {/* API Key Warning */}
      {!activeCompanySettings?.resendApiKey && (
        <div className="bg-simmonds-terracotta/10 p-4 rounded-xl border border-simmonds-terracotta/30">
          <p className="text-simmonds-terracotta font-medium">Resend API Key Required</p>
          <p className="text-sm text-simmonds-terracotta/80">
            Please configure your Resend API key in Settings to send real emails.
          </p>
        </div>
      )}

      {/* No Company Selected Warning */}
      {isSuperAdmin && !selectedCompanyId && (
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
          <p className="text-yellow-800 font-medium">Select a Company</p>
          <p className="text-sm text-yellow-700">
            Please select a company above to send assessment invitations.
          </p>
        </div>
      )}

      {/* Public Assessment Invitation - No Login Required */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-simmonds-charcoal">Public Assessment Invitation</h3>
            <p className="text-sm text-simmonds-stone">Send assessment links that work without login - students get auto-assigned to groups</p>
          </div>
          <span className="px-3 py-1 bg-simmonds-lime/20 text-simmonds-lime-dark text-xs font-medium rounded-full">
            No Login Required
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Student Name *</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              placeholder="John Smith"
              value={invitationName}
              onChange={(e) => setInvitationName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Student Email *</label>
            <input
              type="email"
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              placeholder="student@company.com"
              value={invitationEmail}
              onChange={(e) => setInvitationEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Test Type</label>
            <select
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              value={testType}
              onChange={(e) => setTestType(e.target.value as 'placement' | 'follow_up' | 'level_assessment' | 'practice' | 'diagnostic' | 'certification')}
            >
              <option value="placement">Placement Test</option>
              <option value="follow_up">Follow-up Test</option>
              <option value="level_assessment">Level Assessment</option>
              <option value="practice">Practice Quiz</option>
              <option value="diagnostic">Diagnostic Test</option>
              <option value="certification">Certification Test</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Link Expires In</label>
            <select
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
            >
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>
        </div>
        <button
          onClick={sendPublicAssessmentInvitation}
          disabled={isLoading || !invitationEmail || !invitationName || (isSuperAdmin && !selectedCompanyId)}
          className="px-6 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Creating...' : 'Create & Send Invitation'}
        </button>
        <p className="text-xs text-simmonds-stone mt-2">
          {activeCompanySettings?.resendApiKey
            ? 'Email will be sent automatically with the assessment link'
            : 'Link will be generated (configure Resend API key to send emails automatically)'}
        </p>
      </div>

      {/* Bulk Assessment Invitations */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-simmonds-charcoal">Bulk Assessment Invitations</h3>
            <p className="text-sm text-simmonds-stone">Send multiple assessment links at once</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Recipients (one per line)
            </label>
            <textarea
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-32 font-mono text-sm"
              placeholder={`John Smith <john@company.com>\nJane Doe <jane@company.com>\nor just: email@company.com`}
              value={bulkAssessmentEmails}
              onChange={(e) => setBulkAssessmentEmails(e.target.value)}
            />
            <p className="text-xs text-simmonds-stone mt-1">
              Format: "Name &lt;email@example.com&gt;" or just "email@example.com" (name will be derived from email)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Test Type</label>
              <select
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                value={bulkTestType}
                onChange={(e) => setBulkTestType(e.target.value as 'placement' | 'follow_up' | 'level_assessment' | 'practice' | 'diagnostic' | 'certification')}
              >
                <option value="placement">Placement Test</option>
                <option value="follow_up">Follow-up Test</option>
                <option value="level_assessment">Level Assessment</option>
                <option value="practice">Practice Quiz</option>
                <option value="diagnostic">Diagnostic Test</option>
                <option value="certification">Certification Test</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Link Expires In</label>
              <select
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                value={expiryDays}
                onChange={(e) => setExpiryDays(Number(e.target.value))}
              >
                <option value={3}>3 days</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
            </div>
          </div>

          <button
            onClick={sendBulkAssessmentInvitations}
            disabled={isLoading || !bulkAssessmentEmails.trim() || (isSuperAdmin && !selectedCompanyId)}
            className="px-6 py-2 bg-simmonds-olive text-white rounded-xl font-medium hover:bg-simmonds-olive-light disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating...' : 'Create Bulk Invitations'}
          </button>
        </div>
      </div>

      {/* Pending Invitations */}
      {pendingInvitations && pendingInvitations.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
          <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">
            Pending Invitations ({pendingInvitations.length})
          </h3>
          <div className="space-y-3">
            {pendingInvitations.slice(0, 10).map((inv) => (
              <div key={inv._id} className="flex items-center justify-between p-3 bg-simmonds-cream-light rounded-xl">
                <div>
                  <p className="font-medium text-simmonds-charcoal">{inv.name}</p>
                  <p className="text-sm text-simmonds-stone">{inv.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-simmonds-stone">
                    Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/assessment/${inv.token}`;
                      navigator.clipboard.writeText(url);
                      alert('Link copied to clipboard!');
                    }}
                    className="px-3 py-1 text-xs bg-simmonds-primary/10 text-simmonds-primary rounded-lg hover:bg-simmonds-primary/20"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bulk Email */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Bulk Email Campaign</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Recipients</label>
            <div className="flex flex-wrap gap-4 mb-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="recipients"
                  value="all"
                  checked={bulkRecipients === 'all'}
                  onChange={() => setBulkRecipients('all')}
                  className="w-4 h-4 text-simmonds-primary"
                />
                <span className="ml-2 text-sm">All Students ({employees?.filter(e => e.role === 'student').length || 0})</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="recipients"
                  value="level"
                  checked={bulkRecipients === 'level'}
                  onChange={() => setBulkRecipients('level')}
                  className="w-4 h-4 text-simmonds-primary"
                />
                <span className="ml-2 text-sm">By Level</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="recipients"
                  value="custom"
                  checked={bulkRecipients === 'custom'}
                  onChange={() => setBulkRecipients('custom')}
                  className="w-4 h-4 text-simmonds-primary"
                />
                <span className="ml-2 text-sm">Custom List</span>
              </label>
            </div>

            {bulkRecipients === 'level' && (
              <select
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary mb-4"
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
              >
                <option value="A1">A1 - Beginner ({employees?.filter(e => e.role === 'student' && e.currentLevel === 'A1').length || 0})</option>
                <option value="A2">A2 - Elementary ({employees?.filter(e => e.role === 'student' && e.currentLevel === 'A2').length || 0})</option>
                <option value="B1">B1 - Intermediate ({employees?.filter(e => e.role === 'student' && e.currentLevel === 'B1').length || 0})</option>
                <option value="B2">B2 - Upper Intermediate ({employees?.filter(e => e.role === 'student' && e.currentLevel === 'B2').length || 0})</option>
                <option value="C1">C1 - Advanced ({employees?.filter(e => e.role === 'student' && e.currentLevel === 'C1').length || 0})</option>
                <option value="C2">C2 - Proficient ({employees?.filter(e => e.role === 'student' && e.currentLevel === 'C2').length || 0})</option>
              </select>
            )}

            {bulkRecipients === 'custom' && (
              <textarea
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-20 mb-4"
                placeholder="email1@company.com, email2@company.com, email3@company.com"
                value={customEmails}
                onChange={(e) => setCustomEmails(e.target.value)}
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Subject</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              placeholder="Email subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Message</label>
            <textarea
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-32"
              placeholder="Your message content..."
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
            />
          </div>

          <button
            onClick={sendBulkEmail}
            disabled={isLoading || !emailSubject || !emailContent || !activeCompanySettings?.resendApiKey || (isSuperAdmin && !selectedCompanyId)}
            className="px-6 py-2 bg-simmonds-olive text-white rounded-xl font-medium hover:bg-simmonds-olive-light disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send Campaign'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
      <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Recent Notifications</h3>
      {!notifications || notifications.length === 0 ? (
        <p className="text-simmonds-stone">No notifications yet.</p>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification._id}
              className={`border border-simmonds-cream rounded-xl p-4 ${
                notification.isRead ? 'bg-white' : 'bg-simmonds-primary/5'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-simmonds-charcoal">{notification.title}</h4>
                  <p className="text-sm text-simmonds-stone mt-1">{notification.message}</p>
                  <div className="flex items-center mt-2 gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      notification.type === 'success' ? 'bg-simmonds-lime/20 text-simmonds-lime-dark' :
                      notification.type === 'error' ? 'bg-simmonds-terracotta/20 text-simmonds-terracotta' :
                      notification.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-simmonds-primary/10 text-simmonds-primary'
                    }`}>
                      {notification.type}
                    </span>
                    {notification.isEmailSent && (
                      <span className="text-xs text-simmonds-stone">Email sent</span>
                    )}
                    <span className="text-xs text-simmonds-stone">
                      {new Date(notification.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {!notification.isRead && (
                  <span className="w-2 h-2 bg-simmonds-primary rounded-full"></span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTemplates = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Email Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { id: 'test_invitation', name: 'Test Invitation', description: 'Invitation to take English assessment', active: true },
            { id: 'results_notification', name: 'Results Notification', description: 'Assessment results delivery', active: true },
            { id: 'welcome', name: 'Welcome Email', description: 'Welcome new students', active: true },
            { id: 'progress_update', name: 'Progress Update', description: 'Weekly progress summary', active: true },
            { id: 'group_assignment', name: 'Group Assignment', description: 'Notification of group placement', active: true },
            { id: 'reminder', name: 'Test Reminder', description: 'Reminder to complete pending tests', active: false },
          ].map((template) => (
            <div key={template.id} className="border border-simmonds-cream rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-simmonds-charcoal">{template.name}</h4>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  template.active ? 'bg-simmonds-lime/20 text-simmonds-lime-dark' : 'bg-simmonds-cream text-simmonds-stone'
                }`}>
                  {template.active ? 'Active' : 'Draft'}
                </span>
              </div>
              <p className="text-sm text-simmonds-stone mb-3">{template.description}</p>
              <button
                onClick={() => setEditingTemplate(template.id)}
                className="text-sm text-simmonds-primary hover:underline"
              >
                Edit Template
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Emails Sent</p>
          <p className="text-2xl font-bold text-simmonds-primary">
            {notifications?.filter(n => n.isEmailSent).length || 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Delivery Rate</p>
          <p className="text-2xl font-bold text-simmonds-lime-dark">98.5%</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Open Rate</p>
          <p className="text-2xl font-bold text-simmonds-olive">72.3%</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Click Rate</p>
          <p className="text-2xl font-bold text-simmonds-terracotta">45.1%</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Email Activity (Last 30 Days)</h3>
        <div className="h-48 flex items-end justify-around gap-2">
          {[65, 45, 78, 52, 89, 67, 45, 72, 58, 83, 61, 55, 90, 48, 76].map((value, index) => (
            <div
              key={index}
              className="bg-simmonds-primary/60 rounded-t w-full max-w-8 transition-all hover:bg-simmonds-primary"
              style={{ height: `${value}%` }}
              title={`${value} emails`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-simmonds-stone">
          <span>2 weeks ago</span>
          <span>1 week ago</span>
          <span>Today</span>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'campaigns', name: 'Campaigns' },
    { id: 'notifications', name: 'Notifications' },
    { id: 'templates', name: 'Templates' },
    { id: 'analytics', name: 'Analytics' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-simmonds-charcoal mb-2">Email System</h1>
        <p className="text-simmonds-stone">Manage automated communications and email campaigns</p>
      </div>

      <div className="mb-6">
        <nav className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                activeTab === tab.id
                  ? 'bg-simmonds-primary text-white'
                  : 'bg-simmonds-cream text-simmonds-charcoal hover:bg-simmonds-cream-light'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {activeTab === 'campaigns' && renderCampaigns()}
        {activeTab === 'notifications' && renderNotifications()}
        {activeTab === 'templates' && renderTemplates()}
        {activeTab === 'analytics' && renderAnalytics()}
      </div>
    </div>
  );
};

export default EmailSystem;
