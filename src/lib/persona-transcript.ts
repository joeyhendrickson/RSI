import type { PersonaLiveTranscriptRow } from "./types";

export function combinePersonaTranscript(
  saved: PersonaLiveTranscriptRow[],
  draft: string
): string {
  const chronological = [...saved].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const parts = chronological.map((t) => t.content.trim()).filter(Boolean);
  const draftTrimmed = draft.trim();
  if (draftTrimmed) parts.push(draftTrimmed);
  return parts.join("\n\n");
}
