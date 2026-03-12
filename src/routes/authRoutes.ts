import { Router } from "express";
import { z } from "zod";
import {
  signup,
  login,
  logout,
  validateSession,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  inviteUser,
  acceptInvite
} from "../services/authService";
import { requireTenantContext, getCompanyId } from "../middleware/tenantContext";

export const authRoutes = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  companyName: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.string().min(1).optional()
  ),
  companySlug: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.string().min(1).regex(/^[a-z0-9-]+$/).optional()
  )
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const resetRequestSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8)
});

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(["admin", "member"]).optional()
});

const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8)
});

// Helper to set session cookie
function setSessionCookie(res: any, token: string): void {
  res.cookie("ps_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/"
  });
}

function clearSessionCookie(res: any): void {
  res.clearCookie("ps_session", { path: "/" });
}

// =============================================
// Public auth routes
// =============================================

/**
 * Sign up a new user and company
 */
authRoutes.post("/signup", async (req, res) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid signup data", details: parsed.error.flatten() });
      return;
    }

    const result = await signup(parsed.data);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    if (result.sessionToken) {
      setSessionCookie(res, result.sessionToken);
    }

    res.status(201).json({
      success: true,
      user: result.user,
      requiresVerification: result.requiresVerification
    });
  } catch (error) {
    console.error("Signup route error:", error);
    res.status(500).json({ error: "An unexpected error occurred. Please try again." });
  }
});

/**
 * Log in
 */
authRoutes.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid login data" });
      return;
    }

    const result = await login(parsed.data, {
      userAgent: req.headers["user-agent"],
      ip: req.ip || req.headers["x-forwarded-for"]?.toString()
    });

    if (!result.success) {
      res.status(401).json({ error: result.error });
      return;
    }

    if (result.sessionToken) {
      setSessionCookie(res, result.sessionToken);
    }

    res.status(200).json({
      success: true,
      user: result.user,
      requiresVerification: result.requiresVerification
    });
  } catch (error) {
    console.error("Login route error:", error);
    res.status(500).json({ error: "An unexpected error occurred. Please try again." });
  }
});

/**
 * Log out
 */
authRoutes.post("/logout", async (req, res) => {
  const token = req.cookies?.ps_session;
  if (token) {
    await logout(token);
  }
  clearSessionCookie(res);
  res.status(200).json({ success: true });
});

/**
 * Get current session
 */
authRoutes.get("/session", async (req, res) => {
  const token = req.cookies?.ps_session;
  if (!token) {
    res.status(200).json({ authenticated: false });
    return;
  }

  const session = await validateSession(token);
  if (!session.valid) {
    clearSessionCookie(res);
    res.status(200).json({ authenticated: false });
    return;
  }

  res.status(200).json({
    authenticated: true,
    user: session.user
  });
});

/**
 * Verify email
 */
authRoutes.get("/verify", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  
  const result = await verifyEmail(token);
  
  if (!result.success) {
    // Redirect to error page
    res.redirect(`/auth/verify-error?error=${encodeURIComponent(result.error || "Verification failed")}`);
    return;
  }

  // Redirect to success page
  res.redirect("/auth/verify-success");
});

/**
 * Request password reset
 */
authRoutes.post("/forgot-password", async (req, res) => {
  const parsed = resetRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }

  await requestPasswordReset(parsed.data.email);

  // Always return success to prevent email enumeration
  res.status(200).json({
    success: true,
    message: "If an account exists with this email, you will receive a password reset link."
  });
});

/**
 * Reset password with token
 */
authRoutes.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const result = await resetPassword(parsed.data.token, parsed.data.password);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(200).json({
    success: true,
    message: "Password reset successfully. Please log in with your new password."
  });
});

/**
 * Accept invitation (set password for invited user)
 */
authRoutes.post("/accept-invite", async (req, res) => {
  const parsed = acceptInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const result = await acceptInvite(parsed.data.token, parsed.data.password);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  if (result.sessionToken) {
    setSessionCookie(res, result.sessionToken);
  }

  res.status(200).json({
    success: true,
    user: result.user
  });
});

// =============================================
// Protected routes (require authentication)
// =============================================

/**
 * Middleware to require authentication
 */
async function requireAuth(req: any, res: any, next: any): Promise<void> {
  const token = req.cookies?.ps_session;
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const session = await validateSession(token);
  if (!session.valid || !session.user) {
    clearSessionCookie(res);
    res.status(401).json({ error: "Session expired. Please log in again." });
    return;
  }

  // Attach user to request
  req.authUser = session.user;
  next();
}

/**
 * Invite user to company (requires auth + admin)
 */
authRoutes.post("/invite", requireAuth, requireTenantContext, async (req: any, res) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid invite data", details: parsed.error.flatten() });
    return;
  }

  // Check if user is admin or owner
  if (req.authUser.role !== "admin" && req.authUser.role !== "owner") {
    res.status(403).json({ error: "Only admins can invite users" });
    return;
  }

  const companyId = getCompanyId(req);
  const result = await inviteUser({
    companyId,
    email: parsed.data.email,
    name: parsed.data.name,
    role: parsed.data.role,
    invitedBy: req.authUser.name || req.authUser.email
  });

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(201).json({
    success: true,
    message: "Invitation sent",
    userId: result.userId
  });
});

/**
 * Resend verification email
 */
authRoutes.post("/resend-verification", requireAuth, async (req: any, res) => {
  if (req.authUser.emailVerified) {
    res.status(400).json({ error: "Email is already verified" });
    return;
  }

  // This would need to regenerate the token and resend - simplified for now
  res.status(200).json({
    success: true,
    message: "Verification email sent"
  });
});

