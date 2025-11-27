"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

// Send test email action (uses Node.js runtime for fetch)
export const sendTestEmail = action({
  args: {
    apiKey: v.string(),
    domain: v.optional(v.string()),
    toEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { apiKey, domain, toEmail } = args;

    if (!apiKey) {
      return { success: false, message: 'Resend API key is required' };
    }

    if (!toEmail) {
      return { success: false, message: 'Email address is required' };
    }

    const fromEmail = domain ? `noreply@${domain}` : 'onboarding@resend.dev';

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject: 'Test Email from Simmonds Platform',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #003F37, #9F9D38); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Test Email Successful!</h1>
              </div>
              <div style="background: #fff; padding: 30px; border: 1px solid #E3C6AB; border-top: none; border-radius: 0 0 16px 16px;">
                <p style="color: #333; font-size: 16px; line-height: 1.6;">
                  Congratulations! Your Resend email integration is working correctly.
                </p>
                <p style="color: #666; font-size: 14px; line-height: 1.6;">
                  This test was sent from your <strong>Simmonds Language Platform</strong> settings page.
                </p>
                <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
                  <p style="color: #888; font-size: 12px; margin: 0;">
                    <strong>From:</strong> ${fromEmail}<br>
                    <strong>Sent:</strong> ${new Date().toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          `,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: `Test email sent successfully to ${toEmail}! Check your inbox.`,
          emailId: data.id,
        };
      } else {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          return {
            success: false,
            message: 'API key is invalid or unauthorized.',
          };
        } else if (response.status === 422) {
          return {
            success: false,
            message: `Validation error: ${errorData.message || 'Check your domain configuration'}`,
          };
        } else if (response.status === 429) {
          return {
            success: false,
            message: 'Rate limit exceeded. Please wait a moment and try again.',
          };
        } else {
          return {
            success: false,
            message: `Failed to send: ${errorData.message || response.statusText}`,
          };
        }
      }
    } catch (error: any) {
      console.error('Error sending test email:', error);
      return {
        success: false,
        message: `Network error: ${error.message || 'Unknown error'}`,
      };
    }
  },
});
