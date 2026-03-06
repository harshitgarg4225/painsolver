import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "../db/prisma";
import { sendEmail } from "./emailService";

// Simple password hashing using SHA-256 with salt (for demo - use bcrypt in production)
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt || randomBytes(16).toString("hex");
  const hash = createHash("sha256")
    .update(password + useSalt)
    .digest("hex");
  return { hash: `${useSalt}:${hash}`, salt: useSalt };
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  
  const { hash: computedHash } = hashPassword(password, salt);
  const [, computed] = computedHash.split(":");
  
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(computed || ""));
  } catch {
    return false;
  }
}

function generateToken(length: number = 32): string {
  return randomBytes(length).toString("hex");
}

// Session duration: 7 days
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export interface SignupInput {
  email: string;
  password: string;
  name: string;
  companyName?: string;
  companySlug?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    companyId: string;
    companyName: string;
    companySlug: string;
  };
  sessionToken?: string;
  requiresVerification?: boolean;
}

/**
 * Sign up a new user and create their company
 */
export async function signup(input: SignupInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const name = input.name.trim();
  const companyName = input.companyName?.trim() || `${name}'s Company`;
  const companySlug = input.companySlug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") || 
    companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  // Validate
  if (!email || !email.includes("@")) {
    return { success: false, error: "Invalid email address" };
  }
  if (!password || password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" };
  }
  if (!name) {
    return { success: false, error: "Name is required" };
  }

  try {
    // Check if company slug is taken
    const existingCompany = await prisma.company.findUnique({
      where: { slug: companySlug }
    });
    if (existingCompany) {
      return { success: false, error: "Company name already taken. Please choose another." };
    }

    // Check if email exists in any company
    const existingUser = await prisma.user.findFirst({
      where: { email }
    });
    if (existingUser) {
      return { success: false, error: "Email already registered. Please login instead." };
    }

    // Hash password
    const { hash: passwordHash } = hashPassword(password);
    const emailVerifyToken = generateToken();

    // Create company, user, and default board in transaction
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName,
          slug: companySlug,
          boards: {
            create: {
              name: "Feature Requests",
              slug: "feature-requests",
              visibility: "public",
              categories: {
                create: { name: "General" }
              }
            }
          },
          portalSettings: {
            create: {
              portalName: companyName + " Feedback"
            }
          }
        }
      });

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          email,
          name,
          passwordHash,
          role: "owner",
          emailVerified: false,
          emailVerifyToken,
          emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      });

      return { company, user };
    });

    // Send verification email
    await sendVerificationEmail(email, name, emailVerifyToken);

    // Create session
    const sessionToken = generateToken();
    await prisma.session.create({
      data: {
        userId: result.user.id,
        token: sessionToken,
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
      }
    });

    return {
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        companyId: result.company.id,
        companyName: result.company.name,
        companySlug: result.company.slug
      },
      sessionToken,
      requiresVerification: true
    };
  } catch (error) {
    console.error("Signup error:", error);
    return { success: false, error: "Failed to create account. Please try again." };
  }
}

/**
 * Log in an existing user
 */
export async function login(input: LoginInput, meta?: { userAgent?: string; ip?: string }): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }

  try {
    // Find user by email (across all companies for login)
    const user = await prisma.user.findFirst({
      where: { email },
      include: { company: true }
    });

    if (!user || !user.passwordHash) {
      return { success: false, error: "Invalid email or password" };
    }

    // Verify password
    if (!verifyPassword(password, user.passwordHash)) {
      return { success: false, error: "Invalid email or password" };
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Create session
    const sessionToken = generateToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
        userAgent: meta?.userAgent,
        ipAddress: meta?.ip
      }
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
        companyName: user.company.name,
        companySlug: user.company.slug
      },
      sessionToken,
      requiresVerification: !user.emailVerified
    };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: "Login failed. Please try again." };
  }
}

/**
 * Validate a session token and return user
 */
export async function validateSession(token: string): Promise<{
  valid: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    companyId: string;
    companySlug: string;
    companyName: string;
    emailVerified: boolean;
  };
}> {
  if (!token) {
    return { valid: false };
  }

  try {
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          include: { company: true }
        }
      }
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        // Clean up expired session
        await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      }
      return { valid: false };
    }

    return {
      valid: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        companyId: session.user.companyId,
        companySlug: session.user.company.slug,
        companyName: session.user.company.name,
        emailVerified: session.user.emailVerified
      }
    };
  } catch (error) {
    console.error("Session validation error:", error);
    return { valid: false };
  }
}

/**
 * Log out - invalidate session
 */
export async function logout(token: string): Promise<boolean> {
  try {
    await prisma.session.delete({ where: { token } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Verify email with token
 */
export async function verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
  if (!token) {
    return { success: false, error: "Invalid verification token" };
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
        emailVerifyExpires: { gt: new Date() }
      }
    });

    if (!user) {
      return { success: false, error: "Invalid or expired verification link" };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Email verification error:", error);
    return { success: false, error: "Verification failed. Please try again." };
  }
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail }
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { success: true };
    }

    const resetToken = generateToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      }
    });

    await sendPasswordResetEmail(user.email, user.name, resetToken);

    return { success: true };
  } catch (error) {
    console.error("Password reset request error:", error);
    return { success: false, error: "Failed to send reset email. Please try again." };
  }
}

/**
 * Reset password with token
 */
export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  if (!token || !newPassword) {
    return { success: false, error: "Invalid request" };
  }

  if (newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" };
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() }
      }
    });

    if (!user) {
      return { success: false, error: "Invalid or expired reset link" };
    }

    const { hash: passwordHash } = hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null
      }
    });

    // Invalidate all existing sessions
    await prisma.session.deleteMany({
      where: { userId: user.id }
    });

    return { success: true };
  } catch (error) {
    console.error("Password reset error:", error);
    return { success: false, error: "Reset failed. Please try again." };
  }
}

/**
 * Invite a user to a company
 */
export async function inviteUser(input: {
  companyId: string;
  email: string;
  name?: string;
  role?: "admin" | "member";
  invitedBy: string;
}): Promise<{ success: boolean; error?: string; userId?: string }> {
  const email = input.email.trim().toLowerCase();
  const name = input.name?.trim() || email.split("@")[0];
  const role = input.role || "member";

  try {
    // Check if user already exists in this company
    const existingUser = await prisma.user.findFirst({
      where: {
        companyId: input.companyId,
        email
      }
    });

    if (existingUser) {
      return { success: false, error: "User already exists in this company" };
    }

    // Create user with invite token (no password)
    const inviteToken = generateToken();
    const user = await prisma.user.create({
      data: {
        companyId: input.companyId,
        email,
        name,
        role,
        emailVerified: false,
        emailVerifyToken: inviteToken,
        emailVerifyExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    // Get company info for email
    const company = await prisma.company.findUnique({
      where: { id: input.companyId }
    });

    // Send invite email
    await sendInviteEmail(email, name, inviteToken, company?.name || "PainSolver", input.invitedBy);

    return { success: true, userId: user.id };
  } catch (error) {
    console.error("Invite user error:", error);
    return { success: false, error: "Failed to send invitation" };
  }
}

/**
 * Accept invitation and set password
 */
export async function acceptInvite(token: string, password: string): Promise<AuthResult> {
  if (!token || !password) {
    return { success: false, error: "Invalid request" };
  }

  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" };
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
        emailVerifyExpires: { gt: new Date() },
        passwordHash: null // Only invited users (no password set)
      },
      include: { company: true }
    });

    if (!user) {
      return { success: false, error: "Invalid or expired invitation link" };
    }

    const { hash: passwordHash } = hashPassword(password);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
        lastLoginAt: new Date()
      },
      include: { company: true }
    });

    // Create session
    const sessionToken = generateToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
      }
    });

    return {
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        companyId: updatedUser.companyId,
        companyName: updatedUser.company.name,
        companySlug: updatedUser.company.slug
      },
      sessionToken
    };
  } catch (error) {
    console.error("Accept invite error:", error);
    return { success: false, error: "Failed to accept invitation" };
  }
}

// Email helpers
async function sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
  const verifyUrl = `${process.env.APP_URL || "https://painsolver.vercel.app"}/auth/verify?token=${token}`;
  
  await sendEmail({
    to: email,
    subject: "Verify your PainSolver account",
    html: `
      <h2>Welcome to PainSolver, ${name}!</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${verifyUrl}" style="background:#004549;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Verify Email</a></p>
      <p>Or copy this link: ${verifyUrl}</p>
      <p>This link expires in 24 hours.</p>
      <p>If you didn't create this account, you can safely ignore this email.</p>
    `
  });
}

async function sendPasswordResetEmail(email: string, name: string, token: string): Promise<void> {
  const resetUrl = `${process.env.APP_URL || "https://painsolver.vercel.app"}/auth/reset-password?token=${token}`;
  
  await sendEmail({
    to: email,
    subject: "Reset your PainSolver password",
    html: `
      <h2>Password Reset Request</h2>
      <p>Hi ${name},</p>
      <p>We received a request to reset your password. Click the link below to choose a new one:</p>
      <p><a href="${resetUrl}" style="background:#004549;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Reset Password</a></p>
      <p>Or copy this link: ${resetUrl}</p>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `
  });
}

async function sendInviteEmail(email: string, name: string, token: string, companyName: string, invitedBy: string): Promise<void> {
  const inviteUrl = `${process.env.APP_URL || "https://painsolver.vercel.app"}/auth/accept-invite?token=${token}`;
  
  await sendEmail({
    to: email,
    subject: `You're invited to join ${companyName} on PainSolver`,
    html: `
      <h2>You're Invited!</h2>
      <p>Hi ${name},</p>
      <p>${invitedBy} has invited you to join <strong>${companyName}</strong> on PainSolver.</p>
      <p>PainSolver helps teams collect and prioritize customer feedback.</p>
      <p><a href="${inviteUrl}" style="background:#004549;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Accept Invitation</a></p>
      <p>Or copy this link: ${inviteUrl}</p>
      <p>This invitation expires in 7 days.</p>
    `
  });
}

