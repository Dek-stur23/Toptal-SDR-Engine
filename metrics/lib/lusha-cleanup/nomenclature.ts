// Deterministic email-nomenclature engine for the Lusha cleanup tool.
//
// Given one verified example email and the name it belongs to, infer the
// company's local-part pattern, then render a best-guess address for any
// other contact at that company who has no email of their own.
//
// Pure + client-side: no network, no AI. Everything is exact string
// matching, so a generated address is reproducible and explainable — the
// same (verified example, target name) always yields the same guess.
//
// A template is the full email pattern including the domain, e.g.
// "{first}.{last}@acme.com". Placeholders understood in the local part:
//   {first} full first name      {last} full last name
//   {f} first initial            {l} last initial
// Anything else in the local part (dots, underscores, hyphens) is a
// literal. The domain (after @) is always literal.

export interface NameParts {
  first: string;
  last: string;
}

// Lowercase, strip diacritics, drop anything that isn't a-z0-9. Matches
// the "name → local part" reality of corporate email (José → jose, van
// der Berg → vanderberg). Used for both derivation and rendering so the
// two stay symmetric.
export function normalizeNamePart(s: string): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Local-part templates to test against a verified example, ordered from
// most to least common so the first exact match wins.
const LOCAL_TEMPLATES = [
  "{first}.{last}",
  "{first}_{last}",
  "{first}-{last}",
  "{first}{last}",
  "{f}{last}",
  "{f}.{last}",
  "{f}_{last}",
  "{f}-{last}",
  "{first}{l}",
  "{first}.{l}",
  "{last}.{first}",
  "{last}{first}",
  "{last}{f}",
  "{last}.{f}",
  "{f}{l}",
  "{f}.{l}",
  "{first}",
  "{last}",
] as const;

// Split an email into a lowercased local + domain, or null if it doesn't
// look like an address.
export function splitEmail(
  email: string
): { local: string; domain: string } | null {
  const at = (email ?? "").trim().toLowerCase();
  const m = /^([^@\s]+)@([^@\s]+\.[^@\s]+)$/.exec(at);
  if (!m) return null;
  return { local: m[1], domain: m[2] };
}

// Render a local-part template with the given (already-normalized) name
// parts. Returns null if the template needs a part that's empty.
function renderLocal(
  template: string,
  first: string,
  last: string
): string | null {
  const needFirst = template.includes("{first}") || template.includes("{f}");
  const needLast = template.includes("{last}") || template.includes("{l}");
  if (needFirst && !first) return null;
  if (needLast && !last) return null;
  return template
    .replace(/\{first\}/g, first)
    .replace(/\{last\}/g, last)
    .replace(/\{f\}/g, first.slice(0, 1))
    .replace(/\{l\}/g, last.slice(0, 1));
}

export interface DerivedPattern {
  template: string; // full template incl. domain, e.g. "{first}.{last}@acme.com"
  localTemplate: string; // e.g. "{first}.{last}"
  domain: string; // e.g. "acme.com"
  example: string; // the normalized verified email it was derived from
  recognized: boolean; // false when no known template matched the example
}

// Infer the pattern from a verified email + the name it belongs to.
// Returns null only when the email itself is unparseable. When the email
// parses but matches no known template, returns a `recognized: false`
// result prefilled with the most common pattern so the UI can ask the
// user to confirm or hand-edit the template.
export function deriveTemplate(
  verifiedEmail: string,
  name: NameParts
): DerivedPattern | null {
  const split = splitEmail(verifiedEmail);
  if (!split) return null;

  const first = normalizeNamePart(name.first);
  const last = normalizeNamePart(name.last);
  const example = `${split.local}@${split.domain}`;

  for (const t of LOCAL_TEMPLATES) {
    const rendered = renderLocal(t, first, last);
    if (rendered && rendered === split.local) {
      return {
        template: `${t}@${split.domain}`,
        localTemplate: t,
        domain: split.domain,
        example,
        recognized: true,
      };
    }
  }

  return {
    template: `{first}.{last}@${split.domain}`,
    localTemplate: "{first}.{last}",
    domain: split.domain,
    example,
    recognized: false,
  };
}

export interface RenderResult {
  email: string | null;
  reason?: string; // why it couldn't be rendered (when email is null)
}

// Render an address for a target contact from a full template. Returns
// null with a reason when the template is malformed or the contact is
// missing a name part the pattern needs.
export function renderEmailFromTemplate(
  template: string,
  name: NameParts
): RenderResult {
  const atIdx = template.lastIndexOf("@");
  if (atIdx === -1) return { email: null, reason: "Template has no @domain." };
  const localTemplate = template.slice(0, atIdx);
  const domain = template.slice(atIdx + 1).trim().toLowerCase();
  if (!domain) return { email: null, reason: "Template has no domain." };
  if (!/\{(first|last|f|l)\}/.test(localTemplate)) {
    return { email: null, reason: "Template has no name placeholder." };
  }

  const first = normalizeNamePart(name.first);
  const last = normalizeNamePart(name.last);
  const local = renderLocal(localTemplate, first, last);
  if (!local) {
    return {
      email: null,
      reason: "Contact is missing a name part this pattern needs.",
    };
  }
  return { email: `${local}@${domain}` };
}

// True when a template is well-formed enough to generate from (has a
// name placeholder and a domain). Drives the Generate button's enabled
// state after the user hand-edits the template.
export function isTemplateValid(template: string): boolean {
  const atIdx = template.lastIndexOf("@");
  if (atIdx === -1) return false;
  const localTemplate = template.slice(0, atIdx);
  const domain = template.slice(atIdx + 1).trim();
  return !!domain && /\{(first|last|f|l)\}/.test(localTemplate);
}
