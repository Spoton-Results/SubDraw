import crypto from "crypto";
import { Router } from "express";
import { db } from "@workspace/db";

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

  const lead = {
    id: crypto.randomUUID(),
    firstName: firstName.trim(),
    email: email.trim().toLowerCase(),
    role,
    sessionId: sessionId ?? null,
    referrer: referrer ?? req.headers.referer ?? null,
    userAgent: req.headers["user-agent"] ?? null,
    capturedAt: new Date(),
  };

  console.log("[demo-leads] captured", lead);

  const ghlToken = process.env.GHL_API_TOKEN;
  const ghlLocationId = process.env.GHL_LOCATION_ID;

  if (ghlToken && ghlLocationId) {
    const ghlRes = await fetch("https://services.leadconnectorhq.com/contacts/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ghlToken}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      },
      body: JSON.stringify({
        locationId: ghlLocationId,
        firstName: lead.firstName,
        email: lead.email,
        source: "SubDraw Demo Gate",
        tags: [
          "SubDraw Demo",
          lead.role === "GC" ? "GC Demo Lead" : "Sub Demo Lead",
        ],
      }),
    });

    if (!ghlRes.ok) {
      const text = await ghlRes.text().catch(() => "");
      console.error("[demo-leads] GHL API failed", ghlRes.status, text);
    } else {
      console.log("[demo-leads] sent to GHL", lead.email);
    }
  } else {
    console.warn("[demo-leads] GHL vars missing");
  }

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
  return [];
}

export default router;
