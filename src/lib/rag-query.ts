const PEOPLE_ORG_QUERY =
  /\b(?:who\s+(?:leads|runs|is|owns|heads)|show\s+(?:the\s+)?(?:rsi\s+)?org(?:anization)?\s+chart|org(?:anization)?\s+chart(?:\s+\w+){0,3}|reporting\s+structure|leadership|accounting|controller|finance|financial|operations|manufacturing|supply\s+chain|sales|programs|ceo|cfo|managing\s+partner|manager|person|people|title|role|department|owner|reports?\s+to)\b/i;

const IMPLEMENTATION_PARTNER_QUERY =
  /\b(?:what vendor|which vendor|who did(?: rsi| renaissance)?(?:\s+\w+){0,4}\shir|who(?:'s| is)(?: rsi(?:'s|s)?| renaissance(?:\s+services)?)?(?:\s+\w+){0,4}\s+(?:implementation|erp|bc)\s+partner|implementation partner|erp partner|bc partner|consulting (?:firm|partner|vendor)|integrator|dexpro|implementation plan|external (?:vendor|partner|consultant)|third[- ]party.*(?:implement|consult|partner)|vendor.*(?:rsi|renaissance).*(?:hire|hired)|(?:hire|hired).*(?:vendor|partner|consultant|integrator|dexpro))\b/i;

export function isImplementationPartnerQuery(query: string): boolean {
  return IMPLEMENTATION_PARTNER_QUERY.test(query);
}

export function isPeopleOrgQuery(query: string): boolean {
  if (isImplementationPartnerQuery(query)) return false;
  return PEOPLE_ORG_QUERY.test(query);
}

/** BC supplier master-data exports — not the consulting firm RSI hired. */
export function isBcVendorMasterDataQuery(query: string): boolean {
  if (isImplementationPartnerQuery(query)) return false;
  return /(?:accounts payable|vendor master|vendor record|purchase invoice|purchase order|procure|supplier master|\bvendors?\s+(?:master|record|setup|list|table|export|number|posting|code))/i.test(
    query
  );
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
