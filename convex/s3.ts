import { S3Client } from "@aws-sdk/client-s3";

export const BUCKET_NAME = process.env.S3_BUCKET_NAME || "videos";

function getBasePublicUrl(): string {
  const baseUrl = process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT;
  if (!baseUrl) {
    throw new Error("Missing S3_PUBLIC_URL or S3_ENDPOINT for bucket URLs");
  }
  return baseUrl;
}

export function buildPublicUrl(key: string): string {
  const url = new URL(getBasePublicUrl());
  const basePath = url.pathname.endsWith("/")
    ? url.pathname.slice(0, -1)
    : url.pathname;
  
  // R2 public buckets usually don't include the bucket name in the path if using a custom domain
  // But we'll keep it flexible via an env var
  const includeBucket = process.env.S3_PUBLIC_URL_INCLUDE_BUCKET === "true";
  const objectPath = includeBucket ? `${BUCKET_NAME}/${key}` : key;
  
  url.pathname = `${basePath}/${objectPath}`;
  return url.toString();
}

export function getS3Client(): S3Client {
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const endpoint = process.env.S3_ENDPOINT;

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error("Missing Cloudflare R2 (S3) credentials or endpoint");
  }

  return new S3Client({
    // R2 requires 'auto' as the region
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // R2 requires path-style requests for the standard <accountid>.r2.cloudflarestorage.com endpoint
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    });
}
