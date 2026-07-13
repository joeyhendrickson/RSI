# Sing Creative Advisor

An AI advisor for Business Central process guidance, built on a Pinecone knowledge base sourced from files in Google Cloud Storage.

## Tabs

- **Advisor Chat** — RAG-grounded chat (OpenAI `gpt-5.5-mini`) for Business Central process questions, with on-demand process flow chart image generation. Save/export chat history per session.
- **Vectorize Knowledge Base** — Upload files (they land in GCS), then click **Vectorize** to chunk, embed, and upsert them into Pinecone. Screenshots (PNG, JPG, WEBP, GIF) are OCR'd via OpenAI vision before embedding. Use **Sync bucket → knowledge base** to pull in and vectorize files already sitting in the bucket.
- **Persona Interview** — Paste live interview transcripts and generate context-aware interview questions, or discuss the interview with the copilot. Save/export chat history and generated question batches.

## Setup

1. Copy `.env.local` values (see below) — API keys, Pinecone index, GCS bucket/service account, Supabase project.
2. Run the schema in `supabase/schema.sql` once via the Supabase SQL editor.
3. Install dependencies and start the dev server:

   ```bash
   npm install
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Environment variables

See `.env.local` for the full list. At minimum you need:

- `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_EMBEDDING_DIMENSIONS`, `OPENAI_IMAGE_MODEL`
- Optional: `OPENAI_VISION_MODEL` — for screenshot OCR during vectorization (defaults to `OPENAI_CHAT_MODEL`)
- `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`, `PINECONE_HOST`
- `GCS_BUCKET_NAME`, `GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT_KEY` (base64-encoded service account JSON)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

`OPENAI_EMBEDDING_DIMENSIONS` must match the dimension your Pinecone index was created with.

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS v4 · Vercel AI SDK (`ai`, `@ai-sdk/openai`) · Pinecone · Google Cloud Storage · Supabase (Postgres, service-role access only).
