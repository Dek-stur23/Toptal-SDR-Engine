import { parseCsv } from "./parse";
import {
  digitsOnly,
  normalizeCompanyName,
  normalizeDomain,
  normalizeEmail,
  normalizeHeader,
} from "./normalize";
import {
  DEFAULT_CONFIG,
} from "./config";
import {
  FLAG_SEVERITY,
  OUTPUT_FIELDS,
  type CleanupConfig,
  type Contact,
  type ContactFields,
  type FlagStatus,
  type ProcessResult,
  type Summary,
} from "./types";

// The pure processing module. `process(csvText, config?) -> ProcessResult`.
// No UI imports, no persistence, no network. Runs the same in a browser,
// a Node CLI, or a test harness.
//
// The runtime assertion at the end enforces the spec's "no data loss"
// invariant (test #1) on every run — if any input email or phone is
// missing from the output, it throws with a specific message. This is
// how we get regression protection without adding a test framework.
export function process(
  csvText: string,
  configOverride?: Partial<CleanupConfig>
): ProcessResult {
  const config: CleanupConfig = configOverride
    ? mergeConfig(DEFAULT_CONFIG, configOverride)
    : DEFAULT_CONFIG;

  const parsed = parseCsv(csvText);
  const warnings: string[] = [];

  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    throw new Error("File is empty or has no data rows.");
  }
  if (parsed.raggedLines.length > 0) {
    const first = parsed.raggedLines.slice(0, 5).join(", ");
    const more =
      parsed.raggedLines.length > 5
        ? ` and ${parsed.raggedLines.length - 5} more`
        : "";
    throw new Error(
      `Ragged rows detected on line(s) ${first}${more} — cell count differs from header count. Fix the file and try again.`
    );
  }

  // Resolve each logical column to an index in the header row, using
  // normalized-header matching for tolerance.
  const normalizedHeaders = parsed.headers.map(normalizeHeader);
  const resolveOne = (candidates: string[]): number => {
    for (const c of candidates) {
      const idx = normalizedHeaders.indexOf(normalizeHeader(c));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idx = {
    firstName: resolveOne(config.columns.firstName),
    lastName: resolveOne(config.columns.lastName),
    sourceEmail: resolveOne(config.columns.sourceEmail),
    lushaEmail: resolveOne(config.columns.lushaEmail),
    sourceCompany: resolveOne(config.columns.sourceCompany),
    sourceDomain: resolveOne(config.columns.sourceDomain),
    lushaCompany: resolveOne(config.columns.lushaCompany),
    lushaDomain: resolveOne(config.columns.lushaDomain),
    enrichStatus: resolveOne(config.columns.enrichStatus),
    lastJobChange: resolveOne(config.columns.lastJobChange),
    title: resolveOne(config.columns.title),
    lushaTitle: resolveOne(config.columns.lushaTitle),
    linkedin: resolveOne(config.columns.linkedin),
    lushaLinkedin: resolveOne(config.columns.lushaLinkedin),
    city: resolveOne(config.columns.city),
    state: resolveOne(config.columns.state),
    country: resolveOne(config.columns.country),
    managementLevel: resolveOne(config.columns.managementLevel),
    jobFunction: resolveOne(config.columns.jobFunction),
  };

  // Phones: each candidate pair (number column, type column) resolved
  // independently — kept only when the number column exists.
  const phoneCols: { numberIdx: number; typeIdx: number }[] = [];
  for (const pair of config.columns.phones) {
    const numberIdx = resolveOne([pair.number]);
    if (numberIdx === -1) continue;
    const typeIdx = pair.type ? resolveOne([pair.type]) : -1;
    phoneCols.push({ numberIdx, typeIdx });
  }

  if (idx.firstName === -1 && idx.lastName === -1) {
    throw new Error(
      "No resolvable first-name or last-name column. Cannot proceed."
    );
  }
  if (idx.sourceEmail === -1 && idx.lushaEmail === -1) {
    throw new Error(
      'No resolvable email column in either family ("Email" or "(Lusha) Work email"). Cannot proceed.'
    );
  }
  if (idx.lushaEmail === -1)
    warnings.push(
      "No (Lusha) Work email column found. Emails cannot be recovered from Lusha for rows where the source Email is blank."
    );
  if (idx.lushaCompany === -1 && idx.lushaDomain === -1)
    warnings.push(
      "No (Lusha) Company name or domain column found. Job-change detection is disabled — all rows will resolve to MATCH or UNVERIFIED."
    );

  // For the "no data loss" invariant we accumulate every input email
  // and phone as we go, and verify at the end.
  const inputEmailsPerRow: string[][] = [];
  const inputPhonesPerRow: string[][] = [];

  const contacts: Contact[] = [];
  const padWidth = Math.max(4, String(parsed.rows.length).length);

  parsed.rows.forEach((row, rowIdx) => {
    const cell = (i: number) => (i >= 0 ? row[i] : "");

    const firstName = cell(idx.firstName);
    const lastName = cell(idx.lastName);
    const sourceEmail = cell(idx.sourceEmail);
    const lushaEmail = cell(idx.lushaEmail);
    const sourceCompany = cell(idx.sourceCompany);
    const sourceDomain = cell(idx.sourceDomain);
    const lushaCompany = cell(idx.lushaCompany);
    const lushaDomain = cell(idx.lushaDomain);
    const enrichStatus = cell(idx.enrichStatus);
    const lastJobChange = cell(idx.lastJobChange);
    const title = cell(idx.title) || cell(idx.lushaTitle);
    const linkedin = cell(idx.linkedin) || cell(idx.lushaLinkedin);
    const city = cell(idx.city);
    const state = cell(idx.state);
    const country = cell(idx.country);
    const managementLevel = cell(idx.managementLevel);
    const jobFunction = cell(idx.jobFunction);

    // ---- Emails ----
    const rawEmails: string[] = [sourceEmail, lushaEmail].filter(Boolean);
    inputEmailsPerRow.push(rawEmails.slice());

    // Deduplicate on normalized value, preserve original casing (first
    // occurrence wins for casing).
    const seenEmail = new Set<string>();
    const emailOrder: string[] = [];
    for (const e of rawEmails) {
      const norm = normalizeEmail(e);
      if (!norm) continue;
      if (seenEmail.has(norm)) continue;
      seenEmail.add(norm);
      emailOrder.push(e.trim());
    }

    // ---- Phones ----
    interface PhoneEntry {
      number: string;
      type: string; // possibly ""
      normalizedType: string; // "mobile" | "work" | ""
    }
    const rawPhones: PhoneEntry[] = [];
    for (const p of phoneCols) {
      const number = row[p.numberIdx]?.trim() ?? "";
      if (!number) continue;
      const type = p.typeIdx >= 0 ? (row[p.typeIdx]?.trim() ?? "") : "";
      let normalizedType = "";
      if (config.behavior.mobileTypes.some((t) => equalsCi(t, type))) {
        normalizedType = "mobile";
      } else if (config.behavior.workTypes.some((t) => equalsCi(t, type))) {
        normalizedType = "work";
      } else if (!type) {
        normalizedType = "work"; // Untyped numbers default to Work per §4.2
      } else {
        normalizedType = "other"; // Unknown type — treat as work-like fallback but preserve label
      }
      rawPhones.push({ number, type, normalizedType });
    }
    inputPhonesPerRow.push(rawPhones.map((p) => p.number));

    // Dedup by digits, preserve original formatting.
    const seenDigits = new Set<string>();
    const dedupedPhones: PhoneEntry[] = [];
    for (const p of rawPhones) {
      const digits = digitsOnly(p.number);
      if (!digits) continue;
      if (seenDigits.has(digits)) continue;
      seenDigits.add(digits);
      dedupedPhones.push(p);
    }

    // Slot phones to Mobile / Work / Additional.
    let mobilePhone = "";
    let workPhone = "";
    const additional: PhoneEntry[] = [];
    for (const p of dedupedPhones) {
      if (p.normalizedType === "mobile") {
        if (!mobilePhone) mobilePhone = p.number;
        else additional.push(p);
      } else if (p.normalizedType === "work" || p.normalizedType === "other") {
        if (!workPhone) workPhone = p.number;
        else additional.push(p);
      } else {
        additional.push(p);
      }
    }
    const additionalPhones = additional
      .map((p) => (p.type ? `${p.number} (${p.type})` : p.number))
      .join("; ");

    // ---- Job-change / company match detection (§5.2) ----
    const srcDomN = normalizeDomain(sourceDomain);
    const lushaDomN = normalizeDomain(lushaDomain);
    const srcNameN = normalizeCompanyName(
      sourceCompany,
      config.behavior.legalSuffixes
    );
    const lushaNameN = normalizeCompanyName(
      lushaCompany,
      config.behavior.legalSuffixes
    );

    let status: FlagStatus = "MATCH";
    if (!lushaCompany.trim() && !lushaDomain.trim()) {
      status = "UNVERIFIED";
    } else if (srcDomN && lushaDomN) {
      status = srcDomN === lushaDomN ? "MATCH" : "LEFT_COMPANY";
    } else if (srcNameN && lushaNameN) {
      status = srcNameN === lushaNameN ? "MATCH" : "LEFT_COMPANY";
    } else if (!srcDomN && !srcNameN && (lushaDomN || lushaNameN)) {
      // No source signal to compare against; can't call a departure.
      status = "MATCH";
    } else {
      status = "UNVERIFIED";
    }

    // Enrich-status downgrade path (§5.2 last sentence).
    const enrichStatusHasJobChange = /job\s*change/i.test(enrichStatus);
    if (status === "MATCH" && enrichStatusHasJobChange) {
      status = "ROLE_CHANGE";
    }

    // ---- Primary email selection (§4.1) ----
    const shouldPromoteLusha =
      status === "LEFT_COMPANY" &&
      config.behavior.primaryEmailOnJobChange === "lusha";
    let primary = "";
    let alternate = "";
    const additionalEmails: string[] = [];

    if (emailOrder.length > 0) {
      let ordered = emailOrder.slice();
      if (shouldPromoteLusha && lushaEmail.trim()) {
        // Move the Lusha email (matched by normalized value) to the front.
        const lNorm = normalizeEmail(lushaEmail);
        ordered = ordered.sort((a, b) => {
          const aIsLusha = normalizeEmail(a) === lNorm ? -1 : 0;
          const bIsLusha = normalizeEmail(b) === lNorm ? -1 : 0;
          return aIsLusha - bIsLusha;
        });
      }
      primary = ordered[0] ?? "";
      alternate = ordered[1] ?? "";
      for (let k = 2; k < ordered.length; k++) additionalEmails.push(ordered[k]);
    }

    const emailSource: "source" | "lusha" =
      primary && normalizeEmail(primary) === normalizeEmail(lushaEmail || "")
        ? "lusha"
        : "source";

    // ---- Contact-data flag ----
    const flags: FlagStatus[] = [];
    if (status !== "MATCH") flags.push(status);
    const hasEmail = !!primary;
    const hasPhone = !!mobilePhone || !!workPhone || additional.length > 0;
    if (!hasEmail && !hasPhone) flags.push("NO_CONTACT_DATA");
    if (flags.length === 0) flags.push("MATCH");

    // Sort by severity so the row-styling code can just take flags[0].
    flags.sort(
      (a, b) => FLAG_SEVERITY.indexOf(a) - FLAG_SEVERITY.indexOf(b)
    );

    const primaryStatus = flags[0];
    const defaultDecision =
      config.behavior.defaultDecision[primaryStatus] ?? "keep";

    // ---- Flag detail string (§5.4) ----
    let flagDetail = "";
    if (flags.includes("LEFT_COMPANY")) {
      const employer =
        lushaCompany.trim() ||
        (lushaDomN ? lushaDomN : "unknown employer");
      const domainPart = lushaDomN ? ` (${lushaDomN})` : "";
      const emailPart = lushaEmail.trim()
        ? ` — ${lushaEmail.trim()}`
        : "";
      flagDetail = `Now at ${employer}${domainPart}${emailPart}`;
    } else if (flags.includes("NO_CONTACT_DATA")) {
      flagDetail = "No email or phone in any column";
    } else if (flags.includes("ROLE_CHANGE")) {
      const when = lastJobChange.trim();
      const employer = lushaCompany.trim() || sourceCompany.trim();
      flagDetail = when
        ? `Changed roles ${when}; still at ${employer}`
        : `Changed roles; still at ${employer}`;
    } else if (flags.includes("UNVERIFIED")) {
      flagDetail = "Lusha returned no current employer";
    }

    const fields: ContactFields = {
      "First Name": firstName,
      "Last Name": lastName,
      Email: primary,
      "Alternate Email": alternate,
      "Additional Emails": additionalEmails.join("; "),
      "Mobile Phone": mobilePhone,
      "Work Phone": workPhone,
      "Additional Phones": additionalPhones,
      Title: title,
      Company: sourceCompany, // keep the source company; Lusha's stays in flag detail
      "LinkedIn URL": linkedin,
      City: city,
      State: state,
      Country: country,
      "Management Level": managementLevel,
      "Job Function": jobFunction,
    };

    contacts.push({
      contactId: String(rowIdx + 1).padStart(padWidth, "0"),
      flags,
      flagDetail,
      defaultDecision,
      currentEmployerLusha: lushaCompany.trim(),
      emailSource,
      fields,
    });
  });

  // ---- Summary ----
  const summary: Summary = {
    total: contacts.length,
    withEmail: contacts.filter((c) => c.fields.Email).length,
    withPhone: contacts.filter(
      (c) =>
        c.fields["Mobile Phone"] ||
        c.fields["Work Phone"] ||
        c.fields["Additional Phones"]
    ).length,
    withNeither: contacts.filter((c) => c.flags.includes("NO_CONTACT_DATA"))
      .length,
    emailsRecoveredFromLusha: contacts.filter(
      (c) => c.emailSource === "lusha" && !!c.fields.Email
    ).length,
    countsByStatus: {
      LEFT_COMPANY: 0,
      NO_CONTACT_DATA: 0,
      ROLE_CHANGE: 0,
      UNVERIFIED: 0,
      MATCH: 0,
    },
  };
  for (const c of contacts) {
    // Increment each unique flag on the row so LEFT_COMPANY +
    // NO_CONTACT_DATA rows show up in both counts.
    const seen = new Set<FlagStatus>();
    for (const f of c.flags) {
      if (seen.has(f)) continue;
      seen.add(f);
      summary.countsByStatus[f]++;
    }
  }

  // ---- Invariant enforcement (test #1: no data loss) ----
  contacts.forEach((c, i) => {
    const inputEmailNormSet = new Set(
      inputEmailsPerRow[i].map(normalizeEmail).filter(Boolean)
    );
    const outputEmails = [
      c.fields.Email,
      c.fields["Alternate Email"],
      ...(c.fields["Additional Emails"]
        ? c.fields["Additional Emails"].split(";")
        : []),
    ]
      .map((s) => normalizeEmail(s))
      .filter(Boolean);
    const outputEmailNormSet = new Set(outputEmails);
    for (const inp of inputEmailNormSet) {
      if (!outputEmailNormSet.has(inp)) {
        throw new Error(
          `Data loss invariant violated (contact ${c.contactId}): input email "${inp}" is not present in the output.`
        );
      }
    }
    const inputPhoneDigitsSet = new Set(
      inputPhonesPerRow[i].map(digitsOnly).filter(Boolean)
    );
    const outputPhonesRaw = [
      c.fields["Mobile Phone"],
      c.fields["Work Phone"],
      ...(c.fields["Additional Phones"]
        ? c.fields["Additional Phones"]
            .split(";")
            .map((s) => s.replace(/\s*\([^)]*\)\s*$/, "").trim())
        : []),
    ];
    const outputPhoneDigitsSet = new Set(
      outputPhonesRaw.map(digitsOnly).filter(Boolean)
    );
    for (const inp of inputPhoneDigitsSet) {
      if (!outputPhoneDigitsSet.has(inp)) {
        throw new Error(
          `Data loss invariant violated (contact ${c.contactId}): input phone "${inp}" is not present in the output.`
        );
      }
    }
  });

  // Preserve input order in contacts (already the case, but explicit).
  contacts.sort((a, b) => a.contactId.localeCompare(b.contactId));

  return { summary, contacts, warnings };
}

function equalsCi(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function mergeConfig(
  base: CleanupConfig,
  override: Partial<CleanupConfig>
): CleanupConfig {
  return {
    columns: { ...base.columns, ...(override.columns ?? {}) },
    behavior: { ...base.behavior, ...(override.behavior ?? {}) },
  };
}

// Re-export for consumers.
export type { CleanupConfig, Contact, ProcessResult } from "./types";
export { OUTPUT_FIELDS };
