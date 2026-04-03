import { Router } from "express";
import { db } from "@workspace/db";
import { demoClicksTable, pageViewsTable } from "@workspace/db/schema";

const router = Router();

router.post("/demo-click", async (req, res) => {
  try {
    const { role } = req.body as { role?: string };
    const eventType = role === "GC" ? "GC_DEMO" : role === "SUB" ? "SUB_DEMO" : null;
    if (!eventType) return res.status(400).json({ error: "Invalid role" });

    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      null;
    const userAgent = req.headers["user-agent"] || null;

    await db.insert(demoClicksTable).values({ eventType, ipAddress, userAgent });
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

router.post("/pageview", async (req, res) => {
  try {
    const { path, isAuthenticated } = req.body as { path?: string; isAuthenticated?: boolean };
    if (!path) return res.status(400).json({ error: "path required" });
    await db.insert(pageViewsTable).values({ path, isAuthenticated: !!isAuthenticated });
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

export default router;
