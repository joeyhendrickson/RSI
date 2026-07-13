import { Storage } from "@google-cloud/storage";
import { Pinecone } from "@pinecone-database/pinecone";
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf-8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx), l.slice(idx + 1)];
    })
);

async function testGCS() {
  const credentials = JSON.parse(Buffer.from(env.GCP_SERVICE_ACCOUNT_KEY, "base64").toString("utf-8"));
  const storage = new Storage({ projectId: env.GCP_PROJECT_ID, credentials });
  // Matches what the app actually does (list/read/write objects) — avoids
  // bucket.exists(), which needs storage.buckets.get (not granted by
  // Storage Object Admin, and not something the app needs anyway).
  const [files] = await storage.bucket(env.GCS_BUCKET_NAME).getFiles({ maxResults: 5 });
  console.log(
    "GCS object list access OK — sample files:",
    files.map((f) => f.name)
  );
}

async function testPinecone() {
  const pc = new Pinecone({ apiKey: env.PINECONE_API_KEY });
  const desc = await pc.describeIndex(env.PINECONE_INDEX_NAME);
  console.log(
    "Pinecone index:",
    JSON.stringify({
      name: desc.name,
      dimension: desc.dimension,
      metric: desc.metric,
      host: desc.host,
      status: desc.status,
    })
  );
}

try {
  await testGCS();
} catch (e) {
  console.error("GCS ERROR:", e.message);
}
try {
  await testPinecone();
} catch (e) {
  console.error("PINECONE ERROR:", e.message);
}
