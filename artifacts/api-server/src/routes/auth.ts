import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable, subProfilesTable, magicLinkTokensTable } from "@workspace/db/schema";
import { eq, and, isNull, lt, gt } from "drizzle-orm";
import { hashPassword, comparePassword, generateToken, setAuthCookie, clearAuthCookie } from "../lib/auth.js";
import { publicAuthUser, isMagicLinkUsable } from "../lib/authRecoveryPolicy.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { sendPasswordResetEmail, sendMagicLinkEmail } from "../lib/email.js";
import { getGCPlanInfo } from "../lib/stripeStorage.js";

const router = Router();
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

function generateMagicToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function createMagicToken(userId: string): Promise<string> {
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
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
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
  const safeUser = publicAuthUser(user);
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
  const safeUser = publicAuthUser(user);
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
  const safeUser = publicAuthUser(user);
  let subProfile = null;
  if (user.role === "SUB") {
    const [profile] = await db.select().from(subProfilesTable).where(eq(subProfilesTable.userId, user.id)).limit(1);
    subProfile = profile ?? null;
  }
  const hasPassword = user.passwordHash.startsWith("$2b$") || user.passwordHash.startsWith("$2a$");
  const paused = !!user.pausedAt && !userPayload.impersonatedBy;
  const impersonatedBy = userPayload.impersonatedBy ?? null;

  // For GC users without an active subscription/admin override, check if trial has expired.
  // This lets ProtectedRoute redirect them to the upgrade gate instead of a blank paused screen.
  let trialExpired = false;
  if (user.role === "GC" && !paused) {
    try {
      const planInfo = await getGCPlanInfo(user.id);
      trialExpired = planInfo.trialExpired && !planInfo.subscribed;
    } catch {
      // If plan info fails, don't block login — fail open.
      trialExpired = false;
    }
  }

  res.json({ ...safeUser, subProfile, hasPassword, paused, impersonatedBy, trialExpired });
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
    .set({ passwordHash: newHash, mustChangePassword: false, passwordChangedAt, passwordResetToken: null, passwordResetExpires: null, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id))
    .returning();

  const token = generateToken(updated);
  setAuthCookie(res, token);

  res.json({ message: "Password changed successfully" });
});

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
    .set({ passwordHash: newHash, mustChangePassword: false, passwordChangedAt, passwordResetToken: null, passwordResetExpires: null, updatedAt: new Date() })
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
  res.json(publicAuthUser(updated));
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.json({ message: "If that email exists, a reset link has been sent." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, String(email).toLowerCase().trim())).limit(1);
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);
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

router.post("/magic-link/request", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.json({ message: "If that email is registered, a login link has been sent." });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, String(email).toLowerCase().trim()))
    .limit(1);

  if (user && !user.pausedAt) {
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

router.get("/magic-link/verify", async (req, res) => {
  const { token } = req.query;
  const appUrl = process.env.APP_URL || `https://${(req as any).hostname}`;
  if (!token || typeof token !== "string") {
    res.redirect(`${appUrl}/login?error=invalid_link`);
    return;
  }
  try {
    const session = await db.transaction(async tx => {
      const [record] = await tx.select().from(magicLinkTokensTable).where(eq(magicLinkTokensTable.token, token)).limit(1);
      if (!record) return null;
      const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, record.userId)).limit(1).for("update");
      if (!user || !["GC", "SUB"].includes(user.role) || !isMagicLinkUsable(record, user)) return null;
      const now = new Date();
      const [consumed] = await tx.update(magicLinkTokensTable)
        .set({ usedAt: now })
        .where(and(eq(magicLinkTokensTable.id, record.id), isNull(magicLinkTokensTable.usedAt), gt(magicLinkTokensTable.expiresAt, now)))
        .returning({ id: magicLinkTokensTable.id });
      if (!consumed) return null;
      const jwt = generateToken(user);
      await tx.update(usersTable).set({ lastLoginAt: now, updatedAt: now }).where(eq(usersTable.id, user.id));
      return jwt;
    });
    if (!session) {
      res.redirect(`${appUrl}/login?error=invalid_link`);
      return;
    }
    setAuthCookie(res, session);
    res.redirect(`${appUrl}/dashboard`);
  } catch {
    console.error("[auth] Magic-link verification unavailable");
    res.status(503).json({ error: "Login verification is temporarily unavailable. Request a new link if needed." });
  }
});

router.post("/demo-login", async (req, res) => {
  try {
    const { role } = req.body;
    if (!["GC", "SUB"].includes(role)) {
      res.status(400).json({ error: "role must be GC or SUB" });
      return;
    }
    const primaryEmail = role === "GC" ? "demo-gc@subdraw.com" : "demo-sub@subdraw.com";
    const legacyEmail = role === "GC" ? "demo-gc@subtracker.com" : "demo-sub@subtracker.com";
    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, primaryEmail))
      .limit(1);

    if (!user) {
      [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, legacyEmail))
        .limit(1);
    }

    if (!user || !user.isDemo || user.pausedAt) {
      res.status(503).json({ error: "Demo account is unavailable. Please try again later." });
      return;
    }

    await db.update(usersTable).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(usersTable.id, user.id));
    const token = generateToken(user);
    setAuthCookie(res, token);
    const safeUser = publicAuthUser(user);
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
  const [updated] = await db.update(usersTable).set({
    passwordHash: newHash,
    passwordResetToken: null,
    passwordResetExpires: null,
    mustChangePassword: false,
    passwordChangedAt,
    updatedAt: new Date(),
  }).where(and(eq(usersTable.id, user.id), eq(usersTable.passwordResetToken, String(token)), gt(usersTable.passwordResetExpires, new Date()))).returning({ id: usersTable.id });
  if (!updated) {
    res.status(400).json({ error: "This reset link is invalid or has expired." });
    return;
  }
  res.json({ message: "Password reset successfully. You can now log in with your new password." });
});

export default router;
