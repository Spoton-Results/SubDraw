import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import {
  generateR2Key,
  getPresignedPutUrl,
  makeR2Path,
  isR2Path,
  extractR2Key,
  getPresignedGetUrl,
} from "../lib/r2";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload (Cloudflare R2).
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned PUT URL.
 * The returned objectPath is stored in the DB and used for all future downloads/deletes.
 */
router.post("/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;
    const key = generateR2Key("uploads", name);
    const uploadURL = await getPresignedPutUrl(key, contentType);
    const objectPath = makeR2Path(key);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    console.error("Error generating R2 upload URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/r2/*
 *
 * Download a file from Cloudflare R2 via presigned GET URL redirect.
 * objectPath stored in DB is like "/r2/uploads/timestamp-filename.pdf"
 * Frontend calls /api/storage/r2/uploads/timestamp-filename.pdf
 * which maps to GET /storage/r2/uploads/timestamp-filename.pdf here.
 */
router.get("/r2/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const keyPath = Array.isArray(raw) ? raw.join("/") : raw;
    const r2Path = makeR2Path(keyPath);

    if (!isR2Path(r2Path)) {
      res.status(400).json({ error: "Invalid R2 path" });
      return;
    }

    const key = extractR2Key(r2Path);
    const filename = key.split("/").pop() ?? "download";
    const signedUrl = await getPresignedGetUrl(key, filename);
    res.redirect(307, signedUrl);
  } catch (error) {
    console.error("Error serving R2 object:", error);
    res.status(500).json({ error: "Failed to serve file" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS (legacy GCS).
 */
router.get("/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error("Error serving public object:", error);
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve legacy GCS object entities from PRIVATE_OBJECT_DIR.
 * Kept for backward compatibility with files uploaded before R2 migration.
 */
router.get("/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error("Error serving object:", error);
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
