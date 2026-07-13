const PEOPLE_ORG_QUERY =
  /\b(?:who\s+(?:leads|runs|is|owns|heads)|show\s+(?:the\s+)?(?:rsi\s+)?org(?:anization)?\s+chart|org(?:anization)?\s+chart(?:\s+\w+){0,3}|reporting\s+structure|leadership|accounting|controller|finance|financial|operations|manufacturing|supply\s+chain|sales|programs|ceo|cfo|managing\s+partner|manager|person|people|title|role|department|owner|reports?\s+to)\b/i;

export function isPeopleOrgQuery(query: string): boolean {
  return PEOPLE_ORG_QUERY.test(query);
}

export function extractTopicTerms(query: string): string[] {
  const terms: string[] = [];
  if (/accounting|controller|finance|financial/i.test(query)) {
    terms.push("accounting", "controller", "finance", "financial");
  }
  if (/sales|programs/i.test(query)) terms.push("sales", "programs");
  if (/it|erp|technology/i.test(query)) terms.push("technology", "erp");
  if (/operations|manufacturing|quality|engineering|perfect-3d/i.test(query)) {
    terms.push("operations", "manufacturing", "quality", "engineering", "perfect-3d");
  }
  if (/supply\s*chain|business\s*development/i.test(query)) {
    terms.push("supply chain", "business development");
  }
  if (/ceo|managing partner|executive/i.test(query)) {
    terms.push("ceo", "managing partner");
  }
  return terms;
}
