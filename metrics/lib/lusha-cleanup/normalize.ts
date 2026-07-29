// Normalization helpers. Every rule here exists to make comparison
// tolerant of the real quirks in Lusha exports — see the "Quirks
// observed" table in the spec. Nothing here mutates data that ends up
// in the CSV; these functions are only used for matching.

export function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_\-().]/g, "");
}

export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

// Digits-only view of a phone number, used for de-duplication.
// Preserves nothing else. The original formatting is kept elsewhere so
// international formats survive the round-trip.
export function digitsOnly(s: string): string {
  return s.replace(/\D+/g, "");
}

export function normalizeDomain(s: string): string {
  const raw = (s ?? "").trim();
  if (!raw) return "";
  let d = raw.toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.split(/[/?#]/)[0];
  d = d.replace(/\/+$/, "");
  return d;
}

export function normalizeCompanyName(
  s: string,
  legalSuffixes: string[]
): string {
  let n = (s ?? "").toLowerCase();
  // Strip punctuation, collapse whitespace.
  n = n.replace(/[.,;:'"!?()[\]{}]/g, " ");
  n = n.replace(/\s+/g, " ").trim();
  if (!n) return "";
  const suffixSet = new Set(legalSuffixes.map((x) => x.toLowerCase()));
  // Peel off any trailing legal suffix tokens (potentially multiple:
  // "acme co ltd" -> "acme").
  for (;;) {
    const parts = n.split(" ");
    const last = parts[parts.length - 1];
    if (parts.length > 1 && suffixSet.has(last)) {
      n = parts.slice(0, -1).join(" ").trim();
    } else break;
  }
  return n;
}
