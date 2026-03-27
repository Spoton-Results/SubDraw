import { Router } from "express";
import { Readable } from "stream";
import { db } from "@workspace/db";
import { gcProjectCredentialsTable, projectsTable, projectMembersTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { isR2Path, deleteFromR2, extractR2Key, getPresignedGetUrl } from "../lib/r2.js";

const objectStorageService = new ObjectStorageService();
const router = Router({ mergeParams: true });

function getEffectiveGcId(user: any): string {
  return user.gcParentId ?? user.id;
}

async function getProjectAndCheckAccess(projectId: string, user: any): Promise<{ project: any; isGC: boolean } | null> {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) return null;

  if (user.role === "GC") {
    const effectiveGcId = getEffectiveGcId(user);
    if (project.gcId !== effectiveGcId) return null;
    return { project, isGC: true };
  }

  if (user.role === "SUB") {
    const [member] = await db
      .select({ projectId: projectMembersTable.projectId })
      .from(projectMembersTable)
      .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, user.id)))
      .limit(1);
    if (!member) return null;
    return { project, isGC: false };
  }

  return null;
}

// GET /api/projects/:projectId/gc-credentials — GC (owner) or any sub member can read
router.get("/", requireAuth, async (req, res) => {
  const { projectId } = req.params as any;
  const user = (req as any).user;

  const access = await getProjectAndCheckAccess(projectId, user);
  if (!access) { res.status(403).json({ error: "Forbidden" }); return; }

  // Always fetch GC company name so the sub dashboard can show the GC's name
  const [projectRow] = await db
    .select({ gcCompanyName: usersTable.companyName })
    .from(projectsTable)
    .innerJoin(usersTable, eq(usersTable.id, projectsTable.gcId))
    .where(eq(projectsTable.id, projectId))
    .limit(1);

  const [creds] = await db
    .select()
    .from(gcProjectCredentialsTable)
    .where(eq(gcProjectCredentialsTable.projectId, projectId))
    .limit(1);

  res.json({ ...(creds ?? {}), gcCompanyName: projectRow?.gcCompanyName ?? null });
});

// PUT /api/projects/:projectId/gc-credentials — GC only, upsert
router.put("/", requireAuth, requireGC, async (req, res) => {
  const { projectId } = req.params as any;
  const user = (req as any).user;

  const [project] = await db.select({ gcId: projectsTable.gcId }).from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const effectiveGcId = getEffectiveGcId(user);
  if (project.gcId !== effectiveGcId) { res.status(403).json({ error: "Forbidden" }); return; }

  const body = req.body;

  // Normalize: treat empty strings as null
  function norm(v: any) { return (v === "" || v === undefined) ? null : v ?? null; }

  const insCompany = norm(body.insCompany);
  const insPolicyNumber = norm(body.insPolicyNumber);
  const insGLCoverage = norm(body.insGLCoverage);
  const insWCCoverage = norm(body.insWCCoverage);
  const insExpDate = norm(body.insExpDate);
  const licNumber = norm(body.licNumber);
  const licType = norm(body.licType);
  const licState = norm(body.licState);
  const licExpDate = norm(body.licExpDate);

  const [existing] = await db
    .select()
    .from(gcProjectCredentialsTable)
    .where(eq(gcProjectCredentialsTable.projectId, projectId))
    .limit(1);

  // Only update cert/license paths when explicitly provided (don't overwrite uploads with null from form saves)
  const insCertPath = body.insCertPath !== undefined ? norm(body.insCertPath) : (existing?.insCertPath ?? null);
  const licDocPath = body.licDocPath !== undefined ? norm(body.licDocPath) : (existing?.licDocPath ?? null);

  // Compute credentialsComplete: all 5 required fields must be present
  const credentialsComplete = !!(insCompany && insPolicyNumber && insExpDate && licNumber && licState);

  let result;
  if (existing) {
    const insExpChanged = insExpDate !== existing.insExpDate;
    const licExpChanged = licExpDate !== existing.licExpDate;

    [result] = await db
      .update(gcProjectCredentialsTable)
      .set({
        insCompany, insPolicyNumber, insGLCoverage, insWCCoverage, insExpDate, insCertPath,
        ...(insExpChanged ? { insNotifiedAt30: null, insNotifiedAt7: null } : {}),
        licNumber, licType, licState, licExpDate, licDocPath,
        credentialsComplete,
        updatedAt: new Date(),
      })
      .where(eq(gcProjectCredentialsTable.id, existing.id))
      .returning();
  } else {
    [result] = await db
      .insert(gcProjectCredentialsTable)
      .values({ projectId, insCompany, insPolicyNumber, insGLCoverage, insWCCoverage, insExpDate, insCertPath, licNumber, licType, licState, licExpDate, licDocPath, credentialsComplete })
      .returning();
  }

  res.json(result);
});

// DELETE field — clear a specific document path (cert or license doc)
router.delete("/document/:docType", requireAuth, requireGC, async (req, res) => {
  const { projectId, docType } = req.params as any;
  const user = (req as any).user;

  const [project] = await db.select({ gcId: projectsTable.gcId }).from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const effectiveGcId = getEffectiveGcId(user);
  if (project.gcId !== effectiveGcId) { res.status(403).json({ error: "Forbidden" }); return; }

  if (docType !== "cert" && docType !== "license") {
    res.status(400).json({ error: "docType must be cert or license" }); return;
  }

  const [existing] = await db
    .select()
    .from(gcProjectCredentialsTable)
    .where(eq(gcProjectCredentialsTable.projectId, projectId))
    .limit(1);

  if (existing) {
    const pathField = docType === "cert" ? existing.insCertPath : existing.licDocPath;
    if (pathField) {
      try {
        if (isR2Path(pathField)) {
          await deleteFromR2(pathField);
        } else {
          const file = await objectStorageService.getObjectEntityFile(pathField);
          await file.delete();
        }
      } catch { }
    }
    await db
      .update(gcProjectCredentialsTable)
      .set({
        ...(docType === "cert" ? { insCertPath: null } : { licDocPath: null }),
        updatedAt: new Date(),
      })
      .where(eq(gcProjectCredentialsTable.id, existing.id));
  }

  res.status(204).send();
});

// GET /download/:docType — stream the PDF document for download
router.get("/download/:docType", requireAuth, async (req, res) => {
  const { projectId, docType } = req.params as any;
  const user = (req as any).user;

  const access = await getProjectAndCheckAccess(projectId, user);
  if (!access) { res.status(403).json({ error: "Forbidden" }); return; }

  if (docType !== "cert" && docType !== "license") {
    res.status(400).json({ error: "docType must be cert or license" }); return;
  }

  const [creds] = await db
    .select()
    .from(gcProjectCredentialsTable)
    .where(eq(gcProjectCredentialsTable.projectId, projectId))
    .limit(1);

  if (!creds) { res.status(404).json({ error: "No credentials found" }); return; }

  const objectPath = docType === "cert" ? creds.insCertPath : creds.licDocPath;
  if (!objectPath) { res.status(404).json({ error: "No document uploaded" }); return; }

  try {
    const ext = objectPath.match(/\.(png|jpg|jpeg|gif|webp|pdf)$/i)?.[1] ?? "pdf";
    const fileName = docType === "cert" ? `gc-insurance-certificate.${ext}` : `gc-contractor-license.${ext}`;

    if (isR2Path(objectPath)) {
      const key = extractR2Key(objectPath);
      const signedUrl = await getPresignedGetUrl(key, fileName);
      res.redirect(307, signedUrl);
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (err: any) {
    console.error("[gc-credentials] Download error:", err.message);
    res.status(500).json({ error: "Failed to download document" });
  }
});

export default router;
