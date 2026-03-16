import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword, generateToken, setAuthCookie, clearAuthCookie } from "../lib/auth.js";
import { requireAuth } from "../middlewares/requireAuth.js";

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
  res.json(safeUser);
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

export default router;
