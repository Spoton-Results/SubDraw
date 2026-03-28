import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, planFilesTable, projectMembersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";
import { getEffectiveGcId } from "../lib/auth.js";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage.js";
import { isR2Path, extractR2Key, downloadBufferFromR2 } from "../lib/r2.js";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router = Router({ mergeParams: true });
const objectStorageService = new ObjectStorageService();

const SYSTEM_PROMPT = `You are an experienced construction cost estimator with deep knowledge of subcontractor pricing across all trades in the United States. You have expertise in regional labor rates, current material pricing, and trade-specific scope analysis.

Analyze the attached plan files and the project details provided. For each trade listed provide a realistic bid range estimate with a low end and high end dollar amount based on:
- The scope visible in the plans
- The project location and regional pricing for that market
- The labor type specified (union vs. non-union)
- Current material costs as of the date provided

For each trade also provide two to three sentences explaining what in these specific plans drives the cost estimate for that trade, and list any scope items or conditions that could push the bid significantly above or below your estimated range.

Return your response as valid JSON only with no preamble or explanation outside the JSON. The JSON structure should be an array of trade objects each containing:
- trade: string (the trade name)
- lowEstimate: number (low end dollar amount, no formatting)
- highEstimate: number (high end dollar amount, no formatting)
- costDrivers: string (2-3 sentences about what drives the cost in these specific plans)
- rangeFactors: string (scope items or conditions that could push bids outside the range)`;

type SupportedMediaType = "application/pdf" | "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function getSupportedMediaType(fileName: string): SupportedMediaType | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  // DWG, DOCX, DOC — not supported as document blocks by Claude
  return null;
}

// POST /api/projects/:projectId/ai-analysis — run AI bid analysis
router.post("/", requireAuth, requireGC, async (req, res) => {
  try {
    const user = (req as any).user;
    const { projectId } = req.params as any;
    const effectiveGcId = getEffectiveGcId(user);

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (project.gcId !== effectiveGcId) { res.status(403).json({ error: "Forbidden" }); return; }

    // Get plan files
    const planFiles = await db.select().from(planFilesTable).where(eq(planFilesTable.projectId, projectId));
    if (planFiles.length === 0) {
      res.status(400).json({ error: "No plan files uploaded yet. Upload plans first to enable AI analysis." });
      return;
    }

    // Get trades (unique trade categories from project members who are subs)
    const members = await db.select().from(projectMembersTable)
      .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.roleOnProject, "SUB")));
    const trades = [...new Set(members.map(m => m.tradeCategory).filter(Boolean))] as string[];

    // Download plan files as base64 — only PDF and image files are supported by Claude
    const planFileContents: { fileName: string; base64: string; mediaType: SupportedMediaType }[] = [];
    const skipped: string[] = [];
    for (const pf of planFiles.slice(0, 5)) {
      const mediaType = getSupportedMediaType(pf.fileName);
      if (!mediaType) {
        skipped.push(pf.fileName);
        console.info(`[ai-analysis] Skipping unsupported file type: ${pf.fileName}`);
        continue;
      }
      try {
        let buffer: Buffer;
        if (isR2Path(pf.objectPath)) {
          const key = extractR2Key(pf.objectPath);
          buffer = await downloadBufferFromR2(key);
        } else {
          const file = await objectStorageService.getObjectEntityFile(pf.objectPath);
          const [downloaded] = await file.download();
          buffer = downloaded;
        }
        const base64 = buffer.toString("base64");
        planFileContents.push({ fileName: pf.fileName, base64, mediaType });
      } catch (err) {
        if (err instanceof ObjectNotFoundError) {
          console.warn(`[ai-analysis] Plan file not found in storage: ${pf.objectPath}`);
          continue;
        }
        console.warn(`[ai-analysis] Failed to download plan file ${pf.objectPath}:`, (err as any)?.message);
        continue;
      }
    }

    if (planFileContents.length === 0) {
      const msg = skipped.length > 0
        ? `The uploaded plan files (${skipped.join(", ")}) are not supported for AI analysis. Please upload PDF or image files (PNG, JPG).`
        : "Could not retrieve plan files from storage.";
      res.status(400).json({ error: msg });
      return;
    }

    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const laborLabel = project.laborType === "union" ? "Union Prevailing Wage" : "Non-Union Open Shop";

    const tradesLine = trades.length > 0
      ? `- Trades to Estimate: ${trades.join(", ")}`
      : `- Trades to Estimate: Please identify all relevant subcontractor trades from the plan files`;

    const userPrompt = `Project Information:
- Project Name: ${project.name}
- Project Address: ${project.address || "Not specified"}
- Description/Type: ${project.description || "Not specified"}
- Labor Type: ${laborLabel}
- Analysis Date: ${today}
${tradesLine}

Please analyze the attached plan files and provide bid range estimates for each trade. ${trades.length === 0 ? "Identify all relevant trades from the plans." : "Only estimate the trades listed above."}`;

    // Build message content — plan files as document blocks + text prompt
    type DocumentBlock = {
      type: "document";
      source: { type: "base64"; media_type: string; data: string };
      title?: string;
    };
    type TextBlock = { type: "text"; text: string };
    type ContentBlock = DocumentBlock | TextBlock;

    const contentBlocks: ContentBlock[] = [
      ...planFileContents.map(pf => ({
        type: "document" as const,
        source: { type: "base64" as const, media_type: pf.mediaType, data: pf.base64 },
        title: pf.fileName,
      })),
      { type: "text" as const, text: userPrompt },
    ];

    console.info(`[ai-analysis] Calling Claude with ${planFileContents.length} file(s) for project ${projectId}`);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: contentBlocks as any }],
    });

    const responseText = message.content.find(b => b.type === "text")?.text ?? "";
    console.info(`[ai-analysis] Claude response received (${responseText.length} chars)`);

    // Parse JSON response — strip any markdown code fences
    let analysis: any[];
    try {
      const cleaned = responseText.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim();
      analysis = JSON.parse(cleaned);
      if (!Array.isArray(analysis)) throw new Error("Response is not an array");
    } catch (err) {
      console.error("[ai-analysis] Failed to parse Claude response:", responseText.slice(0, 500));
      res.status(500).json({ error: "AI returned an unexpected format. Please try again." });
      return;
    }

    // Store results on the project
    const now = new Date();
    await db.update(projectsTable).set({
      aiAnalysis: analysis as any,
      aiAnalysisAt: now,
      updatedAt: now,
    }).where(eq(projectsTable.id, projectId));

    console.info(`[ai-analysis] Analysis stored for project ${projectId} — ${analysis.length} trades`);
    res.json({ analysis, analyzedAt: now.toISOString() });
  } catch (err: any) {
    console.error("[ai-analysis] Unhandled error:", err);
    res.status(500).json({ error: err?.message || "An unexpected error occurred during AI analysis." });
  }
});

// POST /api/projects/:projectId/ai-analysis/feedback — record per-trade feedback
router.post("/feedback", requireAuth, requireGC, async (req, res) => {
  const user = (req as any).user;
  const { projectId } = req.params as any;
  const effectiveGcId = getEffectiveGcId(user);

  const [project] = await db.select({ gcId: projectsTable.gcId, aiAnalysisFeedback: projectsTable.aiAnalysisFeedback })
    .from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (project.gcId !== effectiveGcId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { trade, helpful, reason } = req.body;
  if (!trade || typeof helpful !== "boolean") {
    res.status(400).json({ error: "trade (string) and helpful (boolean) are required" });
    return;
  }

  const existing = (project.aiAnalysisFeedback ?? {}) as Record<string, any>;
  const updated = { ...existing, [trade]: { helpful, reason: reason?.trim() || null } };

  await db.update(projectsTable).set({ aiAnalysisFeedback: updated as any, updatedAt: new Date() }).where(eq(projectsTable.id, projectId));
  res.json({ ok: true });
});

export default router;
