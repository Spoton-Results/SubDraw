import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/", requireAuth, requireGC, async (req, res) => {
  const users = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    role: usersTable.role,
    companyName: usersTable.companyName,
    createdAt: usersTable.createdAt,
  }).from(usersTable);
  res.json(users);
});

export default router;
