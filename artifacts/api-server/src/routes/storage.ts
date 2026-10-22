import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { Readable } from "stream";
import multer from "multer";
import { RequestUploadUrlResponse } from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { getObjectAclPolicy } from "../lib/objectAcl";
import { requireAuth } from "../middlewares/requireAuth.js";
import { uploadPrivateFile, privateDownloadUrl, PrivateFileNotFound } from "../lib/privateR2.js";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 2, parts: 3 } });
function requireUploadActor(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || !["GC", "SUB"].includes(user.role) || user.isDemo || user.impersonatedBy) {
    res.status(403).json({ error: "File upload is not permitted for this session" }); return;
  }
  next();
}
function privateHeaders(res: Response): void {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
}
function receiveFile(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, error => {
    if (error) {
      const tooLarge = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
      res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? "File exceeds the 50 MB upload limit" : "Invalid multipart upload" });
      return;
    }
    next();
  });
}
router.post("/uploads/request-url", requireAuth, requireUploadActor, receiveFile, async (req, res) => {
  privateHeaders(res);
  const file = req.file;
  if (!file) { res.status(400).json({ error: "Provide one file in the file field" }); return; }
  try {
    const stored = await uploadPrivateFile((req as any).user.id, file.buffer, file.originalname, file.mimetype || "application/octet-stream");
    res.json(RequestUploadUrlResponse.parse({ ...stored, uploaded: true,
      metadata: { name: file.originalname, size: file.size, contentType: file.mimetype || "application/octet-stream" },
    }));
  } catch {
    console.error("[private-storage] Upload unavailable");
    res.status(503).json({ error: "Private upload storage is unavailable or not verified private" });
  }
});
router.get("/r2/*path", requireAuth, async (req, res) => {
  privateHeaders(res);
  const raw = req.params.path;
  const key = Array.isArray(raw) ? raw.join("/") : raw;
  if (typeof key !== "string") { res.status(404).json({ error: "File not found" }); return; }
  try {
    const url = await privateDownloadUrl((req as any).user.id, key);
    res.redirect(307, url);
  } catch (error) {
    if (error instanceof PrivateFileNotFound) { res.status(404).json({ error: "File not found" }); return; }
    console.error("[private-storage] Download unavailable");
    res.status(503).json({ error: "Private download storage is unavailable or not verified private" });
  }
});

// Intentionally public legacy assets only; no new private upload is written here.
router.get("/public-objects/*filePath", async (req, res) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) { res.status(404).json({ error: "File not found" }); return; }
    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    else res.end();
  } catch {
    res.status(500).json({ error: "Failed to serve public asset" });
  }
});
router.get("/objects/*path", requireAuth, async (req, res) => {
  privateHeaders(res);
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    if (typeof wildcardPath !== "string" || wildcardPath.includes("\\") || wildcardPath.split("/").some(part => part === "." || part === "..")) {
      res.status(404).json({ error: "File not found" }); return;
    }
    const objectFile = await objectStorageService.getObjectEntityFile(`/objects/${wildcardPath}`);
    const acl = await getObjectAclPolicy(objectFile);
    if (!acl || acl.visibility !== "private" || acl.owner !== (req as any).user.id) {
      res.status(404).json({ error: "File not found" }); return;
    }
    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    privateHeaders(res);
    res.setHeader("Content-Disposition", "attachment");
    if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    else res.end();
  } catch (error) {
    if (error instanceof ObjectNotFoundError) { res.status(404).json({ error: "File not found" }); return; }
    console.error("[private-storage] Legacy object unavailable");
    res.status(503).json({ error: "Unable to verify private file access" });
  }
});
export default router;
