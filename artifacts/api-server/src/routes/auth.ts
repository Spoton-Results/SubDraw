import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword, generateToken, setAuthCookie, clearAuthCookie, getAuthUser } from "../lib/auth.js";
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

export default router;
