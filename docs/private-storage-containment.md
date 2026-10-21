# Private storage containment: do not deploy without migration and integration work

## Deliberate access changes

New uploads through the storage endpoint require authentication and a non-demo, non-impersonated GC or SUB account. Files are placed in a separately configured bucket under unpredictable uploader-scoped keys with owner metadata. Upload limit is 50 MB and one file per request. This is not malware scanning, content verification, rate limiting, or aggregate-memory protection.

Download requests require authentication, a matching uploader namespace, and matching object owner metadata. The response redirects to a 60-second signed download with attachment disposition. That signed URL is a bearer credential for its lifetime, not a permanently user-bound link. No public R2 URL fallback is used by this storage endpoint.

Legacy GCS private downloads require a private ACL whose owner matches the current user. Legacy public-assets handling remains intentionally public. Unknown/legacy R2 keys are denied by the application route until ownership migration is reviewed.

## Configuration and external-state limits

The code requires CLOUDFLARE_R2_PRIVATE_BUCKET_NAME to differ from the configured legacy CLOUDFLARE_R2_BUCKET_NAME, the standard HTTPS CLOUDFLARE_R2_ENDPOINT, existing S3 credentials, CLOUDFLARE_API_TOKEN with permission to inspect bucket configuration, and HTTPS APP_URL. It checks the managed r2.dev and custom-domain settings before upload or signing; enabled or unrecognized settings fail closed. These checks do not detect an independently exposed Worker binding or every proxy/cache path. Bucket policy can change after a check. Audit those exposures separately.

No bucket is created or configured by this commit. No credentials, Cloudflare settings, existing files, public URLs, or caches are modified. Existing public files remain public until an explicitly approved migration, public-access shutdown, and cache review occurs. This patch alone does not remediate old public URLs.

## Unfinished integration: release blockers

This is containment and a private-storage foundation, not completed shared-document functionality. New downloads are uploader-only. GC/subcontractor/project sharing needs explicit grants and validated attachment binding before rollout. Do not infer a grant just because someone supplied another user's objectPath.

The primary useUpload hook accepts server-completed uploads and receives the same response fields. The alternate Uppy getUploadParameters path, preview components, generated PDFs, exports, and direct uses of the old r2.ts helper require review. Those helpers still target legacy storage; this patch does not migrate or authorize them. Private-bucket files can be unavailable to those old code paths. Do not delete old files to resolve integration errors.

## Verification

Five policy tests cover key ownership, malformed paths, owner identifiers, public-domain flags, and download filename sanitization. They do not access Cloudflare or prove storage or API integration. No passing result is claimed on this commit at preparation time.

Before release, verify credentials and network access in staging, actual bucket privacy and Worker bindings, metadata ownership, cross-user denial, expired signed URLs, legacy ACL behavior, upload-size failures, stream errors, previews, project sharing, exports, and migration reconciliation. Cloudflare API inspection failures must remain fail-closed. Require a reviewed rollout and rollback plan before merging or deployment.
