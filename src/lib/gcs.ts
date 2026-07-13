import { Storage } from "@google-cloud/storage";
import { env } from "./env";

let storageClient: Storage | null = null;

function getStorage(): Storage {
  if (!storageClient) {
    const credentials = JSON.parse(
      Buffer.from(env.gcpServiceAccountKey(), "base64").toString("utf-8")
    );
    storageClient = new Storage({
      projectId: env.gcpProjectId(),
      credentials,
    });
  }
  return storageClient;
}

export function getBucket() {
  return getStorage().bucket(env.gcsBucketName());
}

export async function uploadFileToGcs(
  destinationPath: string,
  buffer: Buffer,
  contentType?: string
): Promise<string> {
  const bucket = getBucket();
  const file = bucket.file(destinationPath);
  await file.save(buffer, {
    contentType,
    resumable: false,
  });
  return `gs://${env.gcsBucketName()}/${destinationPath}`;
}

export async function downloadFileFromGcs(gcsPath: string): Promise<Buffer> {
  const bucket = getBucket();
  const [buffer] = await bucket.file(gcsPath).download();
  return buffer;
}

export async function listGcsFiles(prefix?: string) {
  const bucket = getBucket();
  const [files] = await bucket.getFiles({ prefix });
  return files;
}
