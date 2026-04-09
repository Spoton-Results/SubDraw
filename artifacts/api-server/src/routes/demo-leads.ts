import { Router } from "express";
import { db } from "@workspace/db";
import { demoLeadsTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";

const router = Router();

// ── POST /api/demo-leads ── (public, no auth required)
router.post("/", async (req, res) => {
  const { firstName, email, role, sessionId, referrer } = req.body;

  if (!firstName?.trim() || !email?.trim() || !role) {
    res.status(400).json({ error: "firstName, email, and role are required" });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: "Invalid email format" });
    return;
  }

  if (!["GC", "SUB"].includes(role)) {
    res.status(400).json({ error: "Role must be GC or SUB" });
    return;
  }

  const lead = (await db.insert(demoLeadsTable).values({
    firstName: firstName.trim(),
    email: email.trim().toLowerCase(),
    role,
    sessionId: sessionId ?? null,
    referrer: referrer ?? req.headers.referer ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  }).returning())[0];

  // Fire GHL webhook if configured
  const ghlWebhookUrl = process.env.GHL_DEMO_LEAD_WEBHOOK;
  if (ghlWebhookUrl) {
    fetch(ghlWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: lead.firstName,
        email: lead.email,
        role: lead.role,
        capturedAt: lead.capturedAt.toISOString(),
        source: "demo_gate",
      }),
    }).catch(err => console.error("[demo-leads] GHL webhook failed:", err.message));
  }

  res.json({ success: true, id: lead.id });
});

// ── GET /api/demo-leads ── (admin — imported and used in admin router)
export async function getDemoLeads() {
  return db.select().from(demoLeadsTable).orderBy(desc(demoLeadsTable.capturedAt));
}

export default router;
