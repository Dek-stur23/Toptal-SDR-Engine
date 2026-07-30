// Pure types for the Lusha-cleanup module.
//
// Everything the UI needs sits on Contact + Summary. The CSV writer
// intentionally only reaches into `fields` — the workflow metadata
// (flags, flag_detail, decisions, email_source, currentEmployerLusha)
// lives outside `fields` so it can never leak into the deliverable.

export type FlagStatus =
  | "LEFT_COMPANY"
  | "NO_CONTACT_DATA"
  | "ROLE_CHANGE"
  | "UNVERIFIED"
  | "MATCH";

// The full CSV column set, in output order. Any CSV row uses exactly
// these headers, and workflow columns never appear here.
export const OUTPUT_FIELDS = [
  "First Name",
  "Last Name",
  "Email",
  "Supplemental Email",
  "Additional Emails",
  "Mobile Phone",
  "Work Phone",
  "Additional Phones",
  "Title",
  "Company",
  "LinkedIn URL",
  "City",
  "State",
  "Country",
  "Management Level",
  "Job Function",
] as const;

export type ContactFieldKey = (typeof OUTPUT_FIELDS)[number];
export type ContactFields = Record<ContactFieldKey, string>;

export interface Contact {
  contactId: string;
  flags: FlagStatus[]; // sorted by severity, most severe first
  flagDetail: string;
  defaultDecision: "keep" | "delete";
  currentEmployerLusha: string;
  emailSource: "source" | "lusha";
  // True when the Email was auto-filled from a company nomenclature
  // pattern rather than sourced from ZoomInfo/Lusha. These are educated
  // guesses, not verified addresses — the UI badges them and the audit
  // CSV marks them so they're never mistaken for real data.
  emailGenerated?: boolean;
  fields: ContactFields;
}

export interface Summary {
  total: number;
  withEmail: number;
  withPhone: number;
  withNeither: number;
  emailsRecoveredFromLusha: number;
  countsByStatus: Record<FlagStatus, number>;
}

export interface ProcessResult {
  summary: Summary;
  contacts: Contact[];
  warnings: string[]; // non-fatal issues surfaced to the UI
}

export type DecisionMap = Record<string, "keep" | "delete">;

// Config keeps behavior tunable per §7 of the spec. Column name lists
// are matched by normalized header (lowercased, punctuation/whitespace
// stripped) so leading-space quirks and minor Lusha header renames
// don't break resolution.
export interface CleanupConfig {
  columns: {
    firstName: string[];
    lastName: string[];
    sourceEmail: string[];
    lushaEmail: string[];
    phones: { number: string; type: string | null }[];
    sourceCompany: string[];
    sourceDomain: string[];
    lushaCompany: string[];
    lushaDomain: string[];
    enrichStatus: string[];
    lastJobChange: string[];
    title: string[];
    lushaTitle: string[];
    linkedin: string[];
    lushaLinkedin: string[];
    city: string[];
    state: string[];
    country: string[];
    managementLevel: string[];
    jobFunction: string[];
  };
  behavior: {
    primaryEmailOnJobChange: "lusha" | "source";
    mobileTypes: string[];
    workTypes: string[];
    legalSuffixes: string[];
    defaultDecision: Record<FlagStatus, "keep" | "delete">;
  };
}

// Severity order for row styling. First entry wins when a contact
// carries multiple flags.
export const FLAG_SEVERITY: FlagStatus[] = [
  "LEFT_COMPANY",
  "NO_CONTACT_DATA",
  "ROLE_CHANGE",
  "UNVERIFIED",
  "MATCH",
];
