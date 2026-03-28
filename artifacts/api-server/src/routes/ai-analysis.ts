import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, planFilesTable, projectMembersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireGC } from "../middlewares/requireAuth.js";
import { getEffectiveGcId } from "../lib/auth.js";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage.js";
import { isR2Path, extractR2Key, downloadBufferFromR2 } from "../lib/r2.js";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require("pdf-parse");

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

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function getImageMediaType(fileName: string): ImageMediaType | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

function isPdf(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".pdf");
}

function isSupported(fileName: string): boolean {
  return isPdf(fileName) || getImageMediaType(fileName) !== null;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return (data.text ?? "").trim();
  } catch {
    return "";
  }
}

function cleanAnthropicError(err: any): string {
  const raw: string = err?.message ?? "";
  try {
    const jsonStart = raw.indexOf("{");
    if (jsonStart !== -1) {
      const parsed = JSON.parse(raw.slice(jsonStart));
      const msg: string = parsed?.error?.message ?? parsed?.message ?? "";
      if (msg) return msg;
    }
  } catch {
    // fall through
  }
  if (raw.length > 120) return "AI service error. Please try again.";
  return raw || "AI analysis failed. Please try again.";
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

    const planFiles = await db.select().from(planFilesTable).where(eq(planFilesTable.projectId, projectId));
    if (planFiles.length === 0) {
      res.status(400).json({ error: "No plan files uploaded yet. Upload plans first to enable AI analysis." });
      return;
    }

    const members = await db.select().from(projectMembersTable)
      .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.roleOnProject, "SUB")));
    const trades = [...new Set(members.map(m => m.tradeCategory).filter(Boolean))] as string[];

    type ImageBlock = { type: "image"; source: { type: "base64"; media_type: ImageMediaType; data: string } };
    type TextBlock = { type: "text"; text: string };
    type ContentBlock = ImageBlock | TextBlock;

    const contentBlocks: ContentBlock[] = [];
    const skipped: string[] = [];
    const pdfTexts: string[] = [];

    for (const pf of planFiles.slice(0, 5)) {
      if (!isSupported(pf.fileName)) {
        skipped.push(pf.fileName);
        console.info(`[ai-analysis] Skipping unsupported file type: ${pf.fileName}`);
        continue;
      }
      try {
        let buffer: Buffer;
        if (isR2Path(pf.objectPath)) {
          buffer = await downloadBufferFromR2(extractR2Key(pf.objectPath));
        } else {
          const file = await objectStorageService.getObjectEntityFile(pf.objectPath);
          const [downloaded] = await file.download();
          buffer = downloaded;
        }

        if (isPdf(pf.fileName)) {
          // Vertex AI doesn't support PDF document blocks — extract text instead
          const text = await extractPdfText(buffer);
          if (text) {
            pdfTexts.push(`--- Plan File: ${pf.fileName} ---\n${text.slice(0, 8000)}`);
            console.info(`[ai-analysis] Extracted ${text.length} chars from PDF: ${pf.fileName}`);
          } else {
            console.warn(`[ai-analysis] PDF text extraction yielded nothing: ${pf.fileName}`);
            skipped.push(pf.fileName);
          }
        } else {
          const mediaType = getImageMediaType(pf.fileName)!;
          contentBlocks.push({
            type: "image",
            source: { type: "base64", media_type: mediaType, data: buffer.toString("base64") },
          });
          console.info(`[ai-analysis] Added image block: ${pf.fileName}`);
        }
      } catch (err) {
        if (err instanceof ObjectNotFoundError) {
          console.warn(`[ai-analysis] Plan file not found in storage: ${pf.objectPath}`);
          continue;
        }
        console.warn(`[ai-analysis] Failed to process plan file ${pf.objectPath}:`, (err as any)?.message);
        continue;
      }
    }

    // Append all PDF text as a single text block
    if (pdfTexts.length > 0) {
      contentBlocks.push({ type: "text", text: pdfTexts.join("\n\n") });
    }

    if (contentBlocks.length === 0) {
      const msg = skipped.length > 0 && pdfTexts.length === 0
        ? `The uploaded plan files (${skipped.join(", ")}) could not be read for AI analysis. Please upload PDF or image files (PNG, JPG).`
        : "Could not read plan files. Please re-upload them and try again.";
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

    contentBlocks.push({ type: "text", text: userPrompt });

    console.info(`[ai-analysis] Calling Claude with ${contentBlocks.length} block(s) for project ${projectId}`);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: contentBlocks as any }],
    });

    const responseText = message.content.find(b => b.type === "text")?.text ?? "";
    console.info(`[ai-analysis] Claude response received (${responseText.length} chars)`);

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
    res.status(500).json({ error: cleanAnthropicError(err) });
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
