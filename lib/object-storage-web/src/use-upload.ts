import { useState, useCallback } from "react";
import type { UppyFile } from "@uppy/core";

interface UploadMetadata {
  name: string;
  size: number;
  contentType: string;
}

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  uploaded?: boolean;
  metadata?: UploadMetadata;
}

interface UseUploadOptions {
  /** Base path where object storage routes are mounted (default: "/api/storage") */
  basePath?: string;
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * React hook for handling file uploads.
 *
 * Sends the file as multipart form data to the server, which uploads it
 * directly to Cloudflare R2 and returns the objectPath and public URL.
 * When the server responds with `uploaded: true` the client-side PUT step
 * is skipped (the upload is already done).
 */
export function useUpload(options: UseUploadOptions = {}) {
  const basePath = options.basePath ?? "/api/storage";
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const requestUploadUrl = useCallback(
    async (file: File): Promise<UploadResponse> => {
      const formData = new FormData();
      formData.append("file", file, file.name);

      const response = await fetch(`${basePath}/uploads/request-url`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload file");
      }

      return response.json();
    },
    [basePath]
  );

  const uploadToPresignedUrl = useCallback(
    async (file: File, uploadURL: string): Promise<void> => {
      const response = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to upload file to storage");
      }
    },
    []
  );

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        setProgress(10);
        const uploadResponse = await requestUploadUrl(file);

        if (!uploadResponse.uploaded) {
          setProgress(30);
          await uploadToPresignedUrl(file, uploadResponse.uploadURL);
        }

        setProgress(100);
        options.onSuccess?.(uploadResponse);
        return uploadResponse;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [requestUploadUrl, uploadToPresignedUrl, options]
  );

  const getUploadParameters = useCallback(
    async (
      file: UppyFile<Record<string, unknown>, Record<string, unknown>>
    ): Promise<{
      method: "PUT";
      url: string;
      headers?: Record<string, string>;
    }> => {
      const formData = new FormData();
      formData.append("file", file.data as Blob, file.name);

      const response = await fetch(`${basePath}/uploads/request-url`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to upload file");
      }

      const data = await response.json();
      return {
        method: "PUT",
        url: data.uploadURL,
        headers: { "Content-Type": (file.type as string) || "application/octet-stream" },
      };
    },
    [basePath]
  );

  return {
    uploadFile,
    getUploadParameters,
    isUploading,
    error,
    progress,
  };
}
