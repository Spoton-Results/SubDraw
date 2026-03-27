import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import {
  generateR2Key,
  makeR2Path,
  isR2Path,
  extractR2Key,
  getPresignedPutUrl,
  getPresignedGetUrl,
} from "../lib/r2";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Generates a presigned PUT URL so the browser can upload directly to R2.
 * No file data is sent to this server — only metadata (name, size, contentType).
 *
 * R2 bucket must have CORS configured to allow PUT from browser origins.
 */
router.post("/uploads/request-url", async (req: Request, res: Response) => {
  const { name, size, contentType } = req.body as {
    name?: string;
    size?: number;
    contentType?: string;
  };

  if (!name || !contentType) {
    res.status(400).json({ error: "name and contentType are required" });
    return;
  }

  const key = generateR2Key("uploads", name);

  try {
    const uploadURL = await getPresignedPutUrl(key, contentType);
    const objectPath = makeR2Path(key);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size: size ?? 0, contentType },
      }),
    );
  } catch (error: any) {
    console.error("[upload] Failed to generate presigned URL:", error);
    res.status(500).json({ error: error?.message ?? "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/r2/*
 *
 * Download a file from Cloudflare R2 via presigned GET URL redirect.
 * objectPath stored in DB is like "/r2/uploads/timestamp-filename.pdf"
 * Frontend calls /api/storage/r2/uploads/timestamp-filename.pdf
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
