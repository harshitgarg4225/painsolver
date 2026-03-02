/**
 * Email Service for PainSolver
 * Uses Resend API for sending transactional emails
 */

import { env } from "../config/env";
import { prisma } from "../db/prisma";

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email using Resend API
 */
export async function sendEmail(payload: EmailPayload): Promise<SendEmailResult> {
  const apiKey = env.RESEND_API_KEY;

  // If no API key, log and skip (development mode)
  if (!apiKey) {
    console.log("[Email] No RESEND_API_KEY configured, skipping email send:", {
      to: payload.to,
      subject: payload.subject
    });
    return { success: true, messageId: "mock-" + Date.now() };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM_ADDRESS,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        reply_to: payload.replyTo || env.EMAIL_REPLY_TO
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[Email] Failed to send email:", errorData);
      return {
        success: false,
        error: `Email send failed: ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json();
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("[Email] Error sending email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// =============================================
// Email Templates
// =============================================

function emailWrapper(content: string, unsubscribeUrl?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PainSolver Notification</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #f3f4f6;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .card {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #0d3b3f, #14b8a6);
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 700;
    }
    .content {
      padding: 32px 24px;
    }
    .footer {
      padding: 16px 24px;
      background: #f9fafb;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
    .footer a {
      color: #14b8a6;
      text-decoration: none;
    }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background: #14b8a6;
      color: #ffffff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 16px 0;
    }
    .btn:hover {
      background: #0d9488;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 100px;
      font-size: 12px;
      font-weight: 600;
    }
    .status-planned {
      background: rgba(139, 92, 246, 0.15);
      color: #8b5cf6;
    }
    .status-in_progress {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
    }
    .status-complete {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
    }
    .muted {
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>PainSolver</h1>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <p>Powered by <a href="https://painsolver.vercel.app">PainSolver</a></p>
        ${unsubscribeUrl ? `<p><a href="${unsubscribeUrl}">Manage notification preferences</a></p>` : ""}
      </div>
    </div>
  </div>
</body>
</html>`;
}

// =============================================
// Notification Email Functions
// =============================================

/**
 * Send status change notification email
 */
export async function sendStatusChangeEmail(input: {
  userEmail: string;
  userName: string;
  postTitle: string;
  postId: string;
  boardId: string;
  oldStatus: string;
  newStatus: string;
}): Promise<SendEmailResult> {
  const { userEmail, userName, postTitle, postId, oldStatus, newStatus } = input;

  const statusLabels: Record<string, string> = {
    under_review: "Under Review",
    upcoming: "Upcoming",
    backlog: "Backlog",
    planned: "Planned",
    in_progress: "In Progress",
    complete: "Complete",
    shipped: "Shipped"
  };

  const viewUrl = `${env.APP_URL}/portal?post=${postId}`;
  const unsubscribeUrl = `${env.APP_URL}/profile?tab=settings`;

  const content = `
    <h2>Status Update</h2>
    <p>Hi ${userName || "there"},</p>
    <p>Good news! The status of an idea you voted on has been updated:</p>
    <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <strong style="font-size: 16px;">${postTitle}</strong>
      <p class="muted" style="margin: 8px 0 0 0;">
        Status changed: <span class="status-badge">${statusLabels[oldStatus] || oldStatus}</span> 
        → <span class="status-badge status-${newStatus}">${statusLabels[newStatus] || newStatus}</span>
      </p>
    </div>
    <a href="${viewUrl}" class="btn">View Idea</a>
    <p class="muted">You're receiving this because you voted on this idea.</p>
  `;

  return sendEmail({
    to: userEmail,
    subject: `Status Update: ${postTitle}`,
    html: emailWrapper(content, unsubscribeUrl),
    text: `Status Update for "${postTitle}"\n\nStatus changed from ${statusLabels[oldStatus] || oldStatus} to ${statusLabels[newStatus] || newStatus}.\n\nView: ${viewUrl}`
  });
}

/**
 * Send comment reply notification email
 */
export async function sendCommentReplyEmail(input: {
  userEmail: string;
  userName: string;
  postTitle: string;
  postId: string;
  commenterName: string;
  commentBody: string;
}): Promise<SendEmailResult> {
  const { userEmail, userName, postTitle, postId, commenterName, commentBody } = input;

  const viewUrl = `${env.APP_URL}/portal?post=${postId}`;
  const unsubscribeUrl = `${env.APP_URL}/profile?tab=settings`;

  const content = `
    <h2>New Reply to Your Comment</h2>
    <p>Hi ${userName || "there"},</p>
    <p><strong>${commenterName}</strong> replied to your comment on:</p>
    <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <strong style="font-size: 16px;">${postTitle}</strong>
      <div style="margin-top: 12px; padding: 12px; background: #ffffff; border-left: 3px solid #14b8a6; font-style: italic;">
        "${commentBody.length > 200 ? commentBody.substring(0, 200) + "..." : commentBody}"
      </div>
    </div>
    <a href="${viewUrl}" class="btn">View Conversation</a>
    <p class="muted">You're receiving this because you commented on this idea.</p>
  `;

  return sendEmail({
    to: userEmail,
    subject: `${commenterName} replied to your comment`,
    html: emailWrapper(content, unsubscribeUrl),
    text: `${commenterName} replied to your comment on "${postTitle}":\n\n"${commentBody}"\n\nView: ${viewUrl}`
  });
}

/**
 * Send mention notification email
 */
export async function sendMentionEmail(input: {
  userEmail: string;
  userName: string;
  postTitle: string;
  postId: string;
  mentionerName: string;
  commentBody: string;
}): Promise<SendEmailResult> {
  const { userEmail, userName, postTitle, postId, mentionerName, commentBody } = input;

  const viewUrl = `${env.APP_URL}/portal?post=${postId}`;
  const unsubscribeUrl = `${env.APP_URL}/profile?tab=settings`;

  const content = `
    <h2>You Were Mentioned</h2>
    <p>Hi ${userName || "there"},</p>
    <p><strong>${mentionerName}</strong> mentioned you in a comment:</p>
    <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <strong style="font-size: 16px;">${postTitle}</strong>
      <div style="margin-top: 12px; padding: 12px; background: #ffffff; border-left: 3px solid #14b8a6;">
        "${commentBody.length > 200 ? commentBody.substring(0, 200) + "..." : commentBody}"
      </div>
    </div>
    <a href="${viewUrl}" class="btn">View Comment</a>
    <p class="muted">You're receiving this because you were mentioned.</p>
  `;

  return sendEmail({
    to: userEmail,
    subject: `${mentionerName} mentioned you`,
    html: emailWrapper(content, unsubscribeUrl),
    text: `${mentionerName} mentioned you in a comment on "${postTitle}":\n\n"${commentBody}"\n\nView: ${viewUrl}`
  });
}

/**
 * Send weekly digest email
 */
export async function sendWeeklyDigestEmail(input: {
  userEmail: string;
  userName: string;
  newIdeasCount: number;
  statusUpdatesCount: number;
  topIdeas: Array<{ title: string; voteCount: number; status: string }>;
}): Promise<SendEmailResult> {
  const { userEmail, userName, newIdeasCount, statusUpdatesCount, topIdeas } = input;

  const portalUrl = `${env.APP_URL}/portal`;
  const roadmapUrl = `${env.APP_URL}/roadmap`;
  const unsubscribeUrl = `${env.APP_URL}/profile?tab=settings`;

  const topIdeasHtml = topIdeas
    .map(
      (idea) => `
      <div style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
        <strong>${idea.title}</strong>
        <span class="status-badge status-${idea.status}" style="margin-left: 8px;">${idea.status.replace("_", " ")}</span>
        <span class="muted" style="float: right;">👍 ${idea.voteCount}</span>
      </div>
    `
    )
    .join("");

  const content = `
    <h2>Your Weekly Digest</h2>
    <p>Hi ${userName || "there"},</p>
    <p>Here's what happened this week:</p>
    
    <div style="display: flex; gap: 16px; margin: 24px 0;">
      <div style="flex: 1; background: #f9fafb; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 32px; font-weight: 700; color: #14b8a6;">${newIdeasCount}</div>
        <div class="muted">New Ideas</div>
      </div>
      <div style="flex: 1; background: #f9fafb; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 32px; font-weight: 700; color: #14b8a6;">${statusUpdatesCount}</div>
        <div class="muted">Status Updates</div>
      </div>
    </div>
    
    ${
      topIdeas.length > 0
        ? `
    <h3>Top Ideas This Week</h3>
    <div style="background: #f9fafb; padding: 16px; border-radius: 8px;">
      ${topIdeasHtml}
    </div>
    `
        : ""
    }
    
    <div style="margin-top: 24px;">
      <a href="${portalUrl}" class="btn">View Feedback Board</a>
      <a href="${roadmapUrl}" class="btn" style="background: transparent; color: #14b8a6; border: 2px solid #14b8a6; margin-left: 8px;">View Roadmap</a>
    </div>
    
    <p class="muted" style="margin-top: 24px;">You're receiving this weekly digest because you're subscribed to updates.</p>
  `;

  return sendEmail({
    to: userEmail,
    subject: `Weekly Digest: ${newIdeasCount} new ideas, ${statusUpdatesCount} updates`,
    html: emailWrapper(content, unsubscribeUrl),
    text: `Weekly Digest\n\n${newIdeasCount} new ideas\n${statusUpdatesCount} status updates\n\nView: ${portalUrl}`
  });
}

/**
 * Check user's notification preferences before sending
 */
export async function shouldSendNotification(
  userId: string,
  type: "productUpdates" | "commentReplies" | "mentions" | "weeklyDigest"
): Promise<boolean> {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId }
  });

  // Default to true if no preferences set
  if (!pref) return true;

  return pref[type] ?? true;
}

/**
 * Queue a notification email (for use with workers)
 */
export async function queueNotificationEmail(input: {
  userId: string;
  type: "status_change" | "comment_reply" | "mention" | "announcement";
  postId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  // For now, just log. In production, this would push to a queue (Redis, SQS, etc.)
  console.log("[Email Queue] Notification queued:", input);

  // In a real implementation:
  // await redisClient.lpush('email_queue', JSON.stringify(input));
}

