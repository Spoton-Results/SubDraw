import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable, subProfilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword, generateToken, setAuthCookie, clearAuthCookie } from "../lib/auth.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { sendPasswordResetEmail } from "../lib/email.js";

const router = Router();

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
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
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
  res.json({ ...safeUser, subProfile });
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
  const [updated] = await db
    .update(usersTable)
    .set({ passwordHash: newHash, mustChangePassword: false, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id))
    .returning();

  const token = generateToken(updated);
  setAuthCookie(res, token);

  res.json({ message: "Password changed successfully" });
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
  await db.update(usersTable).set({
    passwordHash: newHash,
    passwordResetToken: null,
    passwordResetExpires: null,
    mustChangePassword: false,
    updatedAt: new Date(),
  }).where(eq(usersTable.id, user.id));
  res.json({ message: "Password reset successfully. You can now log in with your new password." });
});

export default router;
