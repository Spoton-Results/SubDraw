import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable, subProfilesTable, magicLinkTokensTable } from "@workspace/db/schema";
import { eq, and, isNull, lt } from "drizzle-orm";
import { hashPassword, comparePassword, generateToken, setAuthCookie, clearAuthCookie } from "../lib/auth.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { sendPasswordResetEmail, sendMagicLinkEmail } from "../lib/email.js";

const router = Router();

function generateMagicToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function createMagicToken(userId: string): Promise<string> {
  // Clean up any expired unused tokens for this user first
  await db
    .delete(magicLinkTokensTable)
    .where(
      and(
        eq(magicLinkTokensTable.userId, userId),
        isNull(magicLinkTokensTable.usedAt),
        lt(magicLinkTokensTable.expiresAt, new Date())
      )
    );

  const token = generateMagicToken();
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours
  await db.insert(magicLinkTokensTable).values({ userId, token, expiresAt });
  return token;
}

router.post("/register", async (req, res) => {
  const { email, password, role, companyName } = req.body;
  if (!email || !password || !role || !companyName) {
    res.status(400).json({ error: "email, password, role, companyName are required" });
    return;
  }
  if (!["GC", "SUB"].includes(role)) {
    res.status(400).json({ error: "role must be GC or SUB" });
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }
  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({ email, passwordHash, role, companyName }).returning();
  const token = generateToken(user);
  setAuthCookie(res, token);
  const { passwordHash: _, ...safeUser } = user;
  res.status(201).json({ user: safeUser });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (user.pausedAt) {
    res.status(403).json({ error: "ACCOUNT_PAUSED", message: "Your account has been paused. Please contact support." });
    return;
  }
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  await db.update(usersTable).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(usersTable.id, user.id));
  const token = generateToken(user);
  setAuthCookie(res, token);
  const { passwordHash: _, ...safeUser } = user;
  res.status(200).json({ user: safeUser });
});

router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ message: "Logged out" });
});

router.get("/me", requireAuth, async (req, res) => {
  const userPayload = (req as any).user;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userPayload.id)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  const { passwordHash: _, ...safeUser } = user;
  let subProfile = null;
  if (user.role === "SUB") {
    const [profile] = await db.select().from(subProfilesTable).where(eq(subProfilesTable.userId, user.id)).limit(1);
    subProfile = profile ?? null;
  }
  const hasPassword = user.passwordHash.startsWith("$2b$") || user.passwordHash.startsWith("$2a$");
  const paused = !!user.pausedAt && !userPayload.impersonatedBy;
  const impersonatedBy = userPayload.impersonatedBy ?? null;
  res.json({ ...safeUser, subProfile, hasPassword, paused, impersonatedBy });
});

router.post("/change-password", requireAuth, async (req, res) => {
  const userPayload = (req as any).user;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "currentPassword and newPassword are required" });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userPayload.id)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await hashPassword(newPassword);
  const passwordChangedAt = new Date();
  const [updated] = await db
    .update(usersTable)
    .set({ passwordHash: newHash, mustChangePassword: false, passwordChangedAt, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id))
    .returning();

  // Issue a fresh token so the current session stays valid
  const token = generateToken(updated);
  setAuthCookie(res, token);

  res.json({ message: "Password changed successfully" });
});

// Set password for users who don't have one (magic-link-only users)
router.post("/set-password", requireAuth, async (req, res) => {
  const userPayload = (req as any).user;
  const { newPassword } = req.body;

  if (!newPassword) {
    res.status(400).json({ error: "newPassword is required" });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userPayload.id)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const hasExistingPassword = user.passwordHash.startsWith("$2b$") || user.passwordHash.startsWith("$2a$");
  if (hasExistingPassword) {
    res.status(400).json({ error: "You already have a password. Use Change Password instead." });
    return;
  }

  const newHash = await hashPassword(newPassword);
  const passwordChangedAt = new Date();
  const [updated] = await db
    .update(usersTable)
    .set({ passwordHash: newHash, mustChangePassword: false, passwordChangedAt, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id))
    .returning();

  const token = generateToken(updated);
  setAuthCookie(res, token);

  res.json({ message: "Password set successfully" });
});

router.patch("/update-profile", requireAuth, async (req, res) => {
  const userPayload = (req as any).user;
  const { companyName } = req.body;
  if (!companyName || !String(companyName).trim()) {
    res.status(400).json({ error: "companyName is required" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ companyName: String(companyName).trim(), updatedAt: new Date() })
    .where(eq(usersTable.id, userPayload.id))
    .returning();
  const { passwordHash: _, passwordResetToken: __, passwordResetExpires: ___, ...safeUser } = updated;
  res.json(safeUser);
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  // Always respond 200 to prevent email enumeration
  if (!email) {
    res.json({ message: "If that email exists, a reset link has been sent." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, String(email).toLowerCase().trim())).limit(1);
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await db.update(usersTable).set({ passwordResetToken: token, passwordResetExpires: expires, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
    const appUrl = process.env.APP_URL || `https://${(req as any).hostname}`;
    sendPasswordResetEmail({
      toEmail: user.email,
      companyName: user.companyName,
      resetUrl: `${appUrl}/reset-password?token=${token}`,
    }).catch(err => console.error("[email] sendPasswordResetEmail failed:", err));
  }
  res.json({ message: "If that email exists, a reset link has been sent." });
});

// Request a magic login link — anyone can request one for their own email
router.post("/magic-link/request", async (req, res) => {
  const { email } = req.body;
  // Always 200 to prevent email enumeration
  if (!email) {
    res.json({ message: "If that email is registered, a login link has been sent." });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, String(email).toLowerCase().trim()))
    .limit(1);

  if (user) {
    const token = await createMagicToken(user.id);
    const appUrl = process.env.APP_URL || `https://${(req as any).hostname}`;
    const magicUrl = `${appUrl}/api/auth/magic-link/verify?token=${token}`;
    sendMagicLinkEmail({
      toEmail: user.email,
      companyName: user.companyName,
      magicUrl,
    }).catch(err => console.error("[email] sendMagicLinkEmail failed:", err));
  }

  res.json({ message: "If that email is registered, a login link has been sent." });
});

// Verify a magic link token — GET so it works as a direct email link
router.get("/magic-link/verify", async (req, res) => {
  const { token } = req.query;
  const appUrl = process.env.APP_URL || `https://${(req as any).hostname}`;

  if (!token || typeof token !== "string") {
    res.redirect(`${appUrl}/login?error=invalid_link`);
    return;
  }

  const [record] = await db
    .select()
    .from(magicLinkTokensTable)
    .where(eq(magicLinkTokensTable.token, token))
    .limit(1);

  if (!record) {
    res.redirect(`${appUrl}/login?error=invalid_link`);
    return;
  }

  if (record.usedAt) {
    res.redirect(`${appUrl}/login?error=link_used`);
    return;
  }

  if (record.expiresAt < new Date()) {
    res.redirect(`${appUrl}/login?error=link_expired`);
    return;
  }

  // Mark token as used
  await db
    .update(magicLinkTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(magicLinkTokensTable.id, record.id));

  // Load user and set permanent auth cookie
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, record.userId))
    .limit(1);

  if (!user) {
    res.redirect(`${appUrl}/login?error=invalid_link`);
    return;
  }

  const jwt = generateToken(user);
  setAuthCookie(res, jwt);

  res.redirect(`${appUrl}/`);
});

router.post("/demo-login", async (req, res) => {
  try {
    const { role } = req.body;
    if (!["GC", "SUB"].includes(role)) {
      res.status(400).json({ error: "role must be GC or SUB" });
      return;
    }
    const email =
      role === "GC" ? "demo-gc@subtracker.com" : "demo-sub@subtracker.com";
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    if (!user) {
      res.status(503).json({ error: "Demo account is being set up. Please try again in a moment." });
      return;
    }
    const token = generateToken(user);
    setAuthCookie(res, token);
    const { passwordHash: _, ...safeUser } = user;
    res.status(200).json({ user: safeUser });
  } catch (err: any) {
    console.error("[demo-login] Error:", err?.message ?? err);
    res.status(500).json({ error: "Demo login failed. Please try again in a moment." });
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    res.status(400).json({ error: "token and newPassword are required" });
    return;
  }
  if (String(newPassword).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.passwordResetToken, String(token))).limit(1);
  if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    res.status(400).json({ error: "This reset link is invalid or has expired." });
    return;
  }
  const newHash = await hashPassword(String(newPassword));
  const passwordChangedAt = new Date();
  await db.update(usersTable).set({
    passwordHash: newHash,
    passwordResetToken: null,
    passwordResetExpires: null,
    mustChangePassword: false,
    passwordChangedAt,
    updatedAt: new Date(),
  }).where(eq(usersTable.id, user.id));
  res.json({ message: "Password reset successfully. You can now log in with your new password." });
});

export default router;
