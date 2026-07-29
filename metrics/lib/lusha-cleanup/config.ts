import type { CleanupConfig } from "./types";

// Default config per §7 of the spec. Column-name lists are the
// resolution candidates for each logical field. Header matching is
// normalized (lowercase, whitespace + punctuation stripped) elsewhere,
// so the display strings here can be human-readable.
export const DEFAULT_CONFIG: CleanupConfig = {
  columns: {
    firstName: ["First Name", "(Lusha) First name"],
    lastName: ["Last Name", "(Lusha) Last name"],
    sourceEmail: ["Email", "Email Address", "Work Email"],
    lushaEmail: ["(Lusha) Work email"],
    phones: [
      { number: "(Lusha) Phone number 1", type: "(Lusha) Phone number 1 type" },
      { number: "(Lusha) Phone number 2", type: "(Lusha) Phone number 2 type" },
      { number: "(Lusha) Phone number 3", type: "(Lusha) Phone number 3 type" },
      { number: "Phone", type: null },
      { number: "Mobile Phone", type: null },
      { number: "Direct Phone Number", type: null },
    ],
    sourceCompany: ["Company Name"],
    sourceDomain: ["Company Domain"],
    lushaCompany: ["(Lusha) Company name"],
    lushaDomain: ["(Lusha) Company domain"],
    enrichStatus: ["(Lusha) Enrich status"],
    lastJobChange: ["(Lusha) Last job change"],
    title: ["Job Title", "Title"],
    lushaTitle: ["(Lusha) Job title"],
    linkedin: ["LinkedIn URL", "LinkedIn Contact Profile URL"],
    lushaLinkedin: ["(Lusha) LinkedIn URL"],
    city: ["(Lusha) City", "Company City", "City"],
    state: ["(Lusha) State", "Company State", "State"],
    country: ["(Lusha) Country", "Company Country", "Country"],
    managementLevel: ["Management Level"],
    jobFunction: ["Job Function"],
  },
  behavior: {
    primaryEmailOnJobChange: "lusha",
    mobileTypes: ["Mobile"],
    workTypes: ["Phone", "Direct"],
    legalSuffixes: [
      "inc",
      "llc",
      "ltd",
      "limited",
      "corp",
      "corporation",
      "co",
      "plc",
      "gmbh",
      "sa",
      "bv",
      "pty",
      "ag",
    ],
    defaultDecision: {
      LEFT_COMPANY: "keep",
      NO_CONTACT_DATA: "delete",
      ROLE_CHANGE: "keep",
      UNVERIFIED: "keep",
      MATCH: "keep",
    },
  },
};
