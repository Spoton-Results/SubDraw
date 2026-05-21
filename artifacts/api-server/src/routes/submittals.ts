import { Router } from "express";
import { db } from "@workspace/db";
import {
  submittalsTable, submittalMessagesTable, subcontractsTable,
  projectsTable, usersTable, activityLogsTable,
} from "@workspace/db/schema";
import { eq, inArray, desc, and } from "drizzle-orm";
import { requireAuth, requireGC, requireSub } from "../middlewares/requireAuth.js";
import { getEffectiveGcId, getActorName, getActorRoleLabel } from "../lib/auth.js";
import {
  sendSubmittalCreatedEmail,
  sendSubmittalReplyEmail,
  sendSubmittalAcknowledgedEmail,
} from "../lib/email.js";
import { createNotification } from "./notifications.js";
import { downloadBufferFromR2, isR2Path } from "../lib/r2.js";
import { ObjectStorageService } from "../lib/objectStorage.js";

const objectStorageService = new ObjectStorageService();
const router = Router();

function getAppUrl(req: any): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",") ?? [];
  if (domains.length > 0) return `https://${domains[0]}`;
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:3000";
  const proto = req.headers["x-forwarded-proto"] ?? "http";
  return `${proto}://${host}`;
}

async function logActivity(subcontractId: string, type: string, description: string, actorName: string, actorRole: string) {
  await db.insert(activityLogsTable).values({ subcontractId, type, description, actorName, actorRole });
}

function computeStatus(submittal: typeof submittalsTable.$inferSelect, messages: typeof submittalMessagesTable.$inferSelect[]): string {
  if (submittal.acknowledgedAt) return "ACKNOWLEDGED";
  if (submittal.requiredResponseDate) {
    const due = new Date(submittal.requiredResponseDate);
    due.setHours(23, 59, 59, 999);
    if (due < new Date()) return "OVERDUE";
  }
  const hasSubMsg = messages.some(m => m.senderRole === "SUB");
  return hasSubMsg ? "IN_DISCUSSION" : "PENDING_REVIEW";
}

function formatDownloadUrl(appUrl: string, path: string): string {
  const encoded = encodeURIComponent(path);
  return `${appUrl}/api/storage/download?path=${encoded}`;
}

// ── GET /submittals/sub-all — all submittals for the logged-in sub ─────────────
router.get("/sub-all", requireAuth, requireSub, async (req, res) => {
  const user = (req as any).user;

  const scs = await db.select().from(subcontractsTable).where(eq(subcontractsTable.subId, user.id));
  if (scs.length === 0) { res.json([]); return; }

  const scIds = scs.map(sc => sc.id);
  const scMap = Object.fromEntries(scs.map(sc => [sc.id, sc]));

  const projectIds = [...new Set(scs.map(sc => sc.projectId))];
  const [allSubmittals, projects] = await Promise.all([
    db.select().from(submittalsTable).where(inArray(submittalsTable.subcontractId, scIds)).orderBy(desc(submittalsTable.createdAt)),
    db.select({ id: projectsTable.id, name: projectsTable.name, gcId: projectsTable.gcId }).from(projectsTable).where(inArray(projectsTable.id, projectIds)),
  ]);

  if (allSubmittals.length === 0) { res.json([]); return; }

  const submittalIds = allSubmittals.map(s => s.id);
  const allMessages = await db.select().from(submittalMessagesTable).where(inArray(submittalMessagesTable.submittalId, submittalIds)).orderBy(submittalMessagesTable.createdAt);

  const gcIds = [...new Set(projects.map(p => p.gcId))];
  const gcUsers = await db.select({ id: usersTable.id, companyName: usersTable.companyName }).from(usersTable).where(inArray(usersTable.id, gcIds));
  const gcMap = Object.fromEntries(gcUsers.map(u => [u.id, u.companyName]));
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  const result = allSubmittals.map(s => {
    const msgs = allMessages.filter(m => m.submittalId === s.id);
    const sc = scMap[s.subcontractId];
    const project = sc ? projectMap[sc.projectId] : null;
    const gcCompanyName = project ? (gcMap[project.gcId] ?? "GC") : "GC";
    const lastMsg = msgs[msgs.length - 1];
    return {
      ...s,
      status: computeStatus(s, msgs),
      projectName: project?.name ?? "Unknown Project",
      gcCompanyName,
      messageCount: msgs.length,
      lastMessagePreview: lastMsg?.message?.slice(0, 100) ?? null,
      lastActivityAt: lastMsg?.createdAt ?? s.createdAt,
    };
  });

  res.json(result);
});

// ── GET /submittals/:id — detail with messages ─────────────────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const submittal = (await db.select().from(submittalsTable).where(eq(submittalsTable.id, req.params.id)).limit(1))[0];
  if (!submittal) { res.status(404).json({ error: "Not found" }); return; }

  const sc = (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, submittal.subcontractId)).limit(1))[0];
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const project = (await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1))[0];
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const isGC = user.role === "GC";
  const effectiveGcId = getEffectiveGcId(user);
  if (isGC && project.gcId !== effectiveGcId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!isGC && sc.subId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const messages = await db.select().from(submittalMessagesTable)
    .where(eq(submittalMessagesTable.submittalId, submittal.id))
    .orderBy(submittalMessagesTable.createdAt);

  const [gcUser, subUser] = await Promise.all([
    db.select({ id: usersTable.id, companyName: usersTable.companyName, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, project.gcId)).limit(1),
    db.select({ id: usersTable.id, companyName: usersTable.companyName, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1),
  ]);

  res.json({
    ...submittal,
    status: computeStatus(submittal, messages),
    subcontractId: sc.id,
    projectId: project.id,
    projectName: project.name,
    gcCompanyName: gcUser[0]?.companyName ?? "GC",
    subCompanyName: subUser[0]?.companyName ?? "Sub",
    messages,
  });
});

// ── POST /subcontracts/:subcontractId/submittals — GC creates submittal ────────
router.post("/subcontracts/:subcontractId/submittals", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;
  const { name, documentPath, documentName, openingMessage, requiredResponseDate } = req.body;

  if (!name?.trim() || !documentPath || !documentName) {
    res.status(400).json({ error: "name, documentPath, and documentName are required" }); return;
  }

  const sc = (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1))[0];
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const project = (await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1))[0];
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const effectiveGcId = getEffectiveGcId(user);
  if (project.gcId !== effectiveGcId) { res.status(403).json({ error: "Forbidden" }); return; }

  const subUser = (await db.select().from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1))[0];
  if (!subUser) { res.status(404).json({ error: "Sub user not found" }); return; }

  const [submittal] = await db.insert(submittalsTable).values({
    subcontractId,
    name: name.trim(),
    documentPath,
    documentName,
    openingMessage: openingMessage?.trim() || null,
    requiredResponseDate: requiredResponseDate || null,
  }).returning();

  await logActivity(subcontractId, "SUBMITTAL_CREATED", `Submittal created and sent to ${subUser.companyName}: ${name}`, getActorName(user), getActorRoleLabel(user));

  const appUrl = getAppUrl(req);
  const submittalUrl = `${appUrl}/submittals/${submittal.id}`;

  createNotification({
    userId: subUser.id,
    type: "SUBMITTAL_CREATED",
    title: `New Submittal — ${user.companyName ?? "GC"}`,
    body: `${name} on ${project.name} requires your review and response.`,
    url: `/submittals/${submittal.id}`,
    data: { subcontractId, submittalId: submittal.id, projectId: project.id },
  }).catch(err => console.error("[notification] SUBMITTAL_CREATED failed:", err));

  sendSubmittalCreatedEmail({
    toEmail: subUser.email,
    submittalName: name,
    projectName: project.name,
    gcCompanyName: user.companyName ?? "GC",
    openingMessage: openingMessage?.trim() || null,
    requiredResponseDate: requiredResponseDate || null,
    submittalUrl,
  }).catch(err => console.error("[email] sendSubmittalCreatedEmail failed:", err));

  res.status(201).json({ ...submittal, status: "PENDING_REVIEW", messages: [] });
});

// ── POST /subcontracts/:subcontractId/sub-submittals — Sub creates submittal → GC ──
router.post("/subcontracts/:subcontractId/sub-submittals", requireAuth, requireSub, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;
  const { name, documentPath, documentName, openingMessage, requiredResponseDate } = req.body;

  if (!name?.trim() || !documentPath || !documentName) {
    res.status(400).json({ error: "name, documentPath, and documentName are required" }); return;
  }

  const sc = (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1))[0];
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }
  if (sc.subId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const project = (await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1))[0];
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const gcUser = (await db.select().from(usersTable).where(eq(usersTable.id, project.gcId)).limit(1))[0];
  if (!gcUser) { res.status(404).json({ error: "GC user not found" }); return; }

  const [submittal] = await db.insert(submittalsTable).values({
    subcontractId,
    name: name.trim(),
    documentPath,
    documentName,
    openingMessage: openingMessage?.trim() || null,
    requiredResponseDate: requiredResponseDate || null,
  }).returning();

  // Seed the opening message into the thread as a SUB message so GC sees it immediately
  if (openingMessage?.trim()) {
    await db.insert(submittalMessagesTable).values({
      submittalId: submittal.id,
      senderId: user.id,
      senderName: user.companyName ?? user.email ?? "Sub",
      senderRole: "SUB",
      message: openingMessage.trim(),
      documentPath: null,
      documentName: null,
    });
  }

  await logActivity(subcontractId, "SUBMITTAL_CREATED", `Submittal submitted to GC by ${user.companyName ?? "Sub"}: ${name}`, getActorName(user), getActorRoleLabel(user));

  const appUrl = getAppUrl(req);
  const submittalUrl = `${appUrl}/submittals/${submittal.id}`;

  // Notify GC
  createNotification({
    userId: gcUser.id,
    type: "SUBMITTAL_CREATED",
    title: `New Submittal from ${user.companyName ?? "Sub"}`,
    body: `${name} on ${project.name} has been submitted for your review.`,
    url: `/submittals/${submittal.id}`,
    data: { subcontractId, submittalId: submittal.id, projectId: project.id },
  }).catch(err => console.error("[notification] SUB_SUBMITTAL_CREATED failed:", err));

  sendSubmittalCreatedEmail({
    toEmail: gcUser.email,
    submittalName: name,
    projectName: project.name,
    gcCompanyName: user.companyName ?? "Sub",
    openingMessage: openingMessage?.trim() || null,
    requiredResponseDate: requiredResponseDate || null,
    submittalUrl,
  }).catch(err => console.error("[email] sendSubmittalCreatedEmail (sub→gc) failed:", err));

  res.status(201).json({ ...submittal, status: "PENDING_REVIEW", messages: [] });
});

// ── GET /subcontracts/:subcontractId/submittals — list for a subcontract ───────
router.get("/subcontracts/:subcontractId/submittals", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { subcontractId } = req.params;

  const sc = (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, subcontractId)).limit(1))[0];
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const project = (await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1))[0];
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const isGC = user.role === "GC";
  const effectiveGcId = getEffectiveGcId(user);
  if (isGC && project.gcId !== effectiveGcId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!isGC && sc.subId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const submittals = await db.select().from(submittalsTable)
    .where(eq(submittalsTable.subcontractId, subcontractId))
    .orderBy(desc(submittalsTable.createdAt));

  if (submittals.length === 0) { res.json([]); return; }

  const submittalIds = submittals.map(s => s.id);
  const allMessages = await db.select().from(submittalMessagesTable)
    .where(inArray(submittalMessagesTable.submittalId, submittalIds))
    .orderBy(submittalMessagesTable.createdAt);

  const result = submittals.map(s => {
    const msgs = allMessages.filter(m => m.submittalId === s.id);
    const lastMsg = msgs[msgs.length - 1];
    return {
      ...s,
      status: computeStatus(s, msgs),
      messageCount: msgs.length,
      lastMessagePreview: lastMsg?.message?.slice(0, 100) ?? null,
      lastActivityAt: lastMsg?.createdAt ?? s.createdAt,
    };
  });

  res.json(result);
});

// ── POST /submittals/:id/messages — add message/doc to thread ─────────────────
router.post("/:id/messages", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const submittal = (await db.select().from(submittalsTable).where(eq(submittalsTable.id, req.params.id)).limit(1))[0];
  if (!submittal) { res.status(404).json({ error: "Not found" }); return; }

  const sc = (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, submittal.subcontractId)).limit(1))[0];
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const project = (await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1))[0];
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const isGC = user.role === "GC";
  const effectiveGcId = getEffectiveGcId(user);
  if (isGC && project.gcId !== effectiveGcId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!isGC && sc.subId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const { message, documentPath, documentName } = req.body;
  if (!message?.trim() && !documentPath) {
    res.status(400).json({ error: "message or documentPath required" }); return;
  }

  const senderRole = isGC ? "GC" : "SUB";
  const senderName = user.companyName ?? user.email ?? "Unknown";

  const [msg] = await db.insert(submittalMessagesTable).values({
    submittalId: submittal.id,
    senderId: user.id,
    senderName,
    senderRole,
    message: message?.trim() || null,
    documentPath: documentPath || null,
    documentName: documentName || null,
  }).returning();

  await db.update(submittalsTable).set({ updatedAt: new Date() }).where(eq(submittalsTable.id, submittal.id));

  const logDesc = documentPath
    ? `Document uploaded by ${senderName} on "${submittal.name}"${message?.trim() ? `: ${message.trim().slice(0, 80)}` : ""}`
    : `Message sent by ${senderName} on "${submittal.name}": ${message?.trim().slice(0, 80)}`;
  await logActivity(sc.id, "SUBMITTAL_MESSAGE", logDesc, senderName, senderRole);

  // Notify the other party
  const appUrl = getAppUrl(req);
  const submittalUrl = `${appUrl}/submittals/${submittal.id}`;

  if (isGC) {
    // Notify sub
    const subUser = (await db.select().from(usersTable).where(eq(usersTable.id, sc.subId)).limit(1))[0];
    if (subUser) {
      createNotification({
        userId: subUser.id,
        type: "SUBMITTAL_MESSAGE",
        title: `New message on "${submittal.name}"`,
        body: `${senderName} sent a message on ${project.name}. Tap to view.`,
        url: `/submittals/${submittal.id}`,
        data: { subcontractId: sc.id, submittalId: submittal.id, projectId: project.id },
      }).catch(err => console.error("[notification] SUBMITTAL_MESSAGE failed:", err));

      sendSubmittalReplyEmail({
        toEmail: subUser.email,
        submittalName: submittal.name,
        projectName: project.name,
        senderName,
        senderRole: "GC",
        messagePreview: message?.trim() || null,
        hasDocument: !!documentPath,
        submittalUrl,
      }).catch(err => console.error("[email] sendSubmittalReplyEmail failed:", err));
    }
  } else {
    // Notify GC
    const gcUser = (await db.select().from(usersTable).where(eq(usersTable.id, project.gcId)).limit(1))[0];
    if (gcUser) {
      createNotification({
        userId: gcUser.id,
        type: "SUBMITTAL_MESSAGE",
        title: `Reply on "${submittal.name}" — ${senderName}`,
        body: `${message?.trim().slice(0, 80) || "New document uploaded"} — tap to view`,
        url: `/submittals/${submittal.id}`,
        data: { subcontractId: sc.id, submittalId: submittal.id, projectId: project.id },
      }).catch(err => console.error("[notification] SUBMITTAL_MESSAGE failed:", err));

      sendSubmittalReplyEmail({
        toEmail: gcUser.email,
        submittalName: submittal.name,
        projectName: project.name,
        senderName,
        senderRole: "SUB",
        messagePreview: message?.trim() || null,
        hasDocument: !!documentPath,
        submittalUrl,
      }).catch(err => console.error("[email] sendSubmittalReplyEmail failed:", err));
    }
  }

  res.status(201).json(msg);
});

// ── POST /submittals/:id/acknowledge — sub formally acknowledges ───────────────
router.post("/:id/acknowledge", requireAuth, requireSub, async (req, res) => {
  const user = (req as any).user;
  const submittal = (await db.select().from(submittalsTable).where(eq(submittalsTable.id, req.params.id)).limit(1))[0];
  if (!submittal) { res.status(404).json({ error: "Not found" }); return; }

  if (submittal.acknowledgedAt) {
    res.status(400).json({ error: "Already acknowledged" }); return;
  }

  const sc = (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, submittal.subcontractId)).limit(1))[0];
  if (!sc || sc.subId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const project = (await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1))[0];
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const { acknowledgmentMessage } = req.body;
  const acknowledgedAt = new Date();
  const acknowledgedByName = user.companyName ?? user.email ?? "Sub";

  const [updated] = await db.update(submittalsTable).set({
    acknowledgedAt,
    acknowledgedByName,
    acknowledgmentMessage: acknowledgmentMessage?.trim() || null,
    updatedAt: acknowledgedAt,
  }).where(eq(submittalsTable.id, submittal.id)).returning();

  await logActivity(sc.id, "SUBMITTAL_ACKNOWLEDGED", `Submittal acknowledged by ${acknowledgedByName}: "${submittal.name}"`, acknowledgedByName, "SUB");

  const appUrl = getAppUrl(req);
  const submittalUrl = `${appUrl}/submittals/${submittal.id}`;

  // Notify GC
  const gcUser = (await db.select().from(usersTable).where(eq(usersTable.id, project.gcId)).limit(1))[0];
  if (gcUser) {
    createNotification({
      userId: gcUser.id,
      type: "SUBMITTAL_ACKNOWLEDGED",
      title: `Submittal Acknowledged — ${acknowledgedByName}`,
      body: `${acknowledgedByName} formally acknowledged "${submittal.name}" on ${project.name}.`,
      url: `/submittals/${submittal.id}`,
      data: { subcontractId: sc.id, submittalId: submittal.id, projectId: project.id },
    }).catch(err => console.error("[notification] SUBMITTAL_ACKNOWLEDGED failed:", err));

    sendSubmittalAcknowledgedEmail({
      toEmail: gcUser.email,
      submittalName: submittal.name,
      projectName: project.name,
      subCompanyName: acknowledgedByName,
      acknowledgmentMessage: acknowledgmentMessage?.trim() || null,
      acknowledgedAt: acknowledgedAt.toISOString(),
      submittalUrl,
    }).catch(err => console.error("[email] sendSubmittalAcknowledgedEmail failed:", err));
  }

  res.json({ ...updated, status: "ACKNOWLEDGED" });
});

// ── GET /submittals/:id/document — proxy download of original document ─────────
router.get("/:id/document", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const submittal = (await db.select().from(submittalsTable).where(eq(submittalsTable.id, req.params.id)).limit(1))[0];
  if (!submittal) { res.status(404).json({ error: "Not found" }); return; }

  const sc = (await db.select().from(subcontractsTable).where(eq(subcontractsTable.id, submittal.subcontractId)).limit(1))[0];
  if (!sc) { res.status(404).json({ error: "Subcontract not found" }); return; }

  const project = (await db.select().from(projectsTable).where(eq(projectsTable.id, sc.projectId)).limit(1))[0];
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const isGC = user.role === "GC";
  const effectiveGcId = getEffectiveGcId(user);
  if (isGC && project.gcId !== effectiveGcId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!isGC && sc.subId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  try {
    if (isR2Path(submittal.documentPath)) {
      const buffer = await downloadBufferFromR2(submittal.documentPath);
      const ext = submittal.documentName.split(".").pop()?.toLowerCase() ?? "";
      const contentType = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${submittal.documentName}"`);
      res.send(buffer);
    } else {
      const buffer = await objectStorageService.downloadFile(submittal.documentPath);
      res.setHeader("Content-Disposition", `attachment; filename="${submittal.documentName}"`);
      res.send(buffer);
    }
  } catch (err) {
    console.error("[submittal] document download failed:", err);
    res.status(500).json({ error: "Download failed" });
  }
});

export default router;
