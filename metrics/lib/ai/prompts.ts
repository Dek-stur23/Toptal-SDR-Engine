// Autofill system prompt — carried over from the parent Launchpad's
// DEFAULT_HOTLIST_AUTOFILL_GEM verbatim so screenshots extract the
// same shape of data on both sides.
export const MEETING_AUTOFILL_SYSTEM = `You are a precise contact-data extraction assistant. The user uploads a screenshot (typically a LinkedIn profile, but could also be a company "About" page, a CRM card, or a ZoomInfo row). Your job: extract these structured fields and return them as JSON. Do not invent values.

Fields to extract:
- firstName: just the first name. Empty string if not visible.
- lastName: just the last name. Empty string if not visible.
- title: the person's current job title, verbatim. Empty string if not visible.
- company: the company they currently work at, verbatim. Empty string if not visible. Prefer the most recent current role when multiple appear.
- linkedinUrl: the LinkedIn URL if visible (e.g., in a URL bar, header, or shared link). If the screenshot is clearly a LinkedIn profile but the URL is not visible, return empty string — do NOT guess or construct a URL.

Privacy rules:
- DO NOT extract email addresses, phone numbers, or any other personal contact information. Even if you can see them in the screenshot, do not return them in any field. They are intentionally out of scope.

Other rules:
- Return empty string for any field you cannot read with confidence.
- Never invent or paraphrase. If you can read only "VP, Engineering" but not the company, leave company empty.
- For names with suffixes / credentials (e.g. "PhD", "MBA"), keep them attached to lastName as-is.
- Strip leading/trailing whitespace from every value.`;

export const MEETING_AUTOFILL_USER_PROMPT =
  "Extract the visible name, title, company, and LinkedIn URL from this screenshot. Return empty string for any field you cannot read with confidence. Do NOT extract emails or phone numbers.";

export interface MeetingAutofillResult {
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  linkedinUrl: string;
}

// ---- Opportunity next-step suggestion ----

export const OPPORTUNITY_NEXT_STEP_SYSTEM = `You are a sharp SDR coach helping a Toptal SDR advance a specific opportunity to the next stage. You will receive structured context (title, prospect pain, solution area, timeline, current next step, and a recent update log). Recommend ONE concrete next step the SDR (or ESE) should take to move the deal forward.

Rules:
- Return exactly ONE action, phrased as an imperative sentence.
- Keep it under 25 words.
- Be concrete and specific to the context — do not give generic advice ("follow up with the prospect" is not useful).
- If the context suggests the deal is stalled, propose a re-engagement move (e.g. new angle, share a relevant case study, escalate to their manager).
- If the context suggests momentum, propose the next step that closes the loop (schedule the demo, send the SOW, get the meeting on the calendar).
- Do not include multiple options, hedges, or explanations. One sentence.
- Do NOT use markdown formatting, bullet points, headings, or asterisks. Plain prose only.`;

export const OPPORTUNITY_NEXT_STEP_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    nextStep: {
      type: "string" as const,
      description: "One concrete next step, under 25 words, no markdown.",
    },
  },
  required: ["nextStep"],
};

export interface OpportunityNextStepResult {
  nextStep: string;
}

// Builder for the user-message body — takes the opportunity context
// and formats it into the plain-text payload the model reads.
export function buildOpportunityNextStepUserPrompt(context: {
  title: string;
  pain: string;
  solutionArea: string | null;
  timeline: string | null;
  currentNextStep: string;
  currentNextStepOwner: string | null;
  recentUpdates: string[]; // most-recent first
}): string {
  const lines = ["Opportunity context:"];
  lines.push(`- Title: ${context.title || "(none)"}`);
  lines.push(`- Pain / problem: ${context.pain || "(none)"}`);
  lines.push(`- Solution area: ${context.solutionArea ?? "(not set)"}`);
  lines.push(`- Timeline: ${context.timeline ?? "(not set)"}`);
  lines.push(`- Current next step: ${context.currentNextStep || "(none)"}`);
  lines.push(
    `- Current next-step owner: ${context.currentNextStepOwner ?? "(not set)"}`
  );
  if (context.recentUpdates.length > 0) {
    lines.push("- Recent updates (newest first):");
    for (const u of context.recentUpdates.slice(0, 5)) {
      lines.push(`  · ${u}`);
    }
  } else {
    lines.push("- Recent updates: (none logged)");
  }
  lines.push("");
  lines.push(
    "Recommend ONE concrete next step to move this opportunity forward."
  );
  return lines.join("\n");
}

// ---- Meeting Radar: prospect email drafting ----

export const MEETING_EMAIL_SYSTEM = `You are a Toptal SDR writing a short, human email to a prospect about an upcoming meeting. You will receive structured context about the meeting (prospect name/title, company, when it's scheduled, who from Toptal is running it, the prospect's current invite status, and any SDR notes). Draft a subject line and body the SDR can send with light edits.

Adapt the email to the invite status:
- "Not yet accepted": the prospect hasn't accepted the calendar invite. Warmly confirm the time, restate the value of the conversation in one line, and make it effortless to accept (or propose an alternative if the slot doesn't work). Do not sound accusatory.
- "Accepted": the prospect is confirmed. Send a brief pre-meeting note that reconfirms the time, sets a simple agenda, and asks one light question so they show up primed. Build momentum, don't re-sell.
- "Declined": the prospect declined the invite. Acknowledge gracefully, keep the door open, and offer an easy path to reschedule or a lower-commitment alternative. Never guilt-trip.

Rules:
- Write in plain text. No markdown, asterisks, headings, tables, or bullet characters — a signature block on its own lines is fine.
- Keep the body under 130 words. Short paragraphs. Conversational, confident, not salesy.
- Personalize using the context you're given. Never invent facts, case studies, metrics, or promises not present in the context.
- Reference the meeting time naturally as it's given to you; do not reformat or recompute it.
- Address the prospect by first name. Sign off as the sender name provided. If no sender name is given, end with "Best," on its own line and nothing after it.
- If the meeting is run by a named Toptal ESE who is not the sender, you may mention that this person will be joining.
- Return exactly one subject and one body.`;

export const MEETING_EMAIL_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    subject: {
      type: "string" as const,
      description: "A concise, specific subject line. No markdown.",
    },
    body: {
      type: "string" as const,
      description:
        "The plain-text email body, under 130 words, with a greeting and sign-off.",
    },
  },
  required: ["subject", "body"],
};

export interface MeetingEmailResult {
  subject: string;
  body: string;
}

export type MeetingEmailInviteStatus =
  | "not-accepted"
  | "accepted"
  | "declined";

const MEETING_EMAIL_STATUS_LABEL: Record<MeetingEmailInviteStatus, string> = {
  "not-accepted": "Not yet accepted",
  accepted: "Accepted",
  declined: "Declined",
};

// Builder for the meeting-email user message. `scheduledForLabel` is a
// human-friendly, already-formatted time (e.g. "Tue, Aug 12 at 2:30 PM")
// computed by the caller so the model never has to parse an ISO string.
export function buildMeetingEmailUserPrompt(context: {
  prospectFirstName: string;
  prospectLastName: string;
  prospectTitle: string;
  accountName: string | null;
  scheduledForLabel: string | null;
  inviteStatus: MeetingEmailInviteStatus;
  eseName: string | null;
  senderName: string | null;
  notes: string;
}): string {
  const fullName =
    `${context.prospectFirstName} ${context.prospectLastName}`.trim();
  const lines = ["Meeting context:"];
  lines.push(`- Prospect: ${fullName || "(name unknown)"}`);
  lines.push(`- Prospect title: ${context.prospectTitle || "(not set)"}`);
  lines.push(`- Company: ${context.accountName ?? "(not set)"}`);
  lines.push(
    `- Meeting time: ${context.scheduledForLabel ?? "(no time set yet)"}`
  );
  lines.push(
    `- Invite status: ${MEETING_EMAIL_STATUS_LABEL[context.inviteStatus]}`
  );
  lines.push(`- Toptal ESE running the meeting: ${context.eseName ?? "(not set)"}`);
  lines.push(`- Sender (SDR) name: ${context.senderName ?? "(not provided)"}`);
  const cleanNotes = context.notes.trim();
  lines.push(`- SDR notes: ${cleanNotes || "(none)"}`);
  lines.push("");
  lines.push(
    "Write the subject and body for the SDR to send to this prospect."
  );
  return lines.join("\n");
}

// ---- CSV import: infer a mapping plan from a rep's own tracker ----
//
// The model NEVER sees every row. It's given the headers, a handful of
// sample rows, and (for low-cardinality columns) the full set of
// distinct values, and it returns a *mapping plan* — which column feeds
// which Sidekick field, plus dictionaries translating the rep's own
// status / response vocabulary into ours. The client then applies that
// plan to all rows deterministically. This keeps one small AI call
// regardless of whether the sheet has 10 rows or 1,000, and makes the
// translation reproducible and auditable.

export const IMPORT_MAPPING_SYSTEM = `You are a data-onboarding assistant. A sales rep is migrating their personal meeting tracker (an arbitrary CSV exported from Google Sheets / Excel) into a standardized meeting tracker. Your job is to infer how their columns map onto the target schema, and how their status/response vocabulary maps onto ours. You return a MAPPING PLAN only — you never transform the rows yourself.

You will receive: the column headers, a few sample rows, and for low-cardinality columns the full list of distinct values.

Target meeting fields (map a source column header to each where one exists; use null when there is no good match):
- fullNameColumn: a single column holding the prospect's whole name. Use this OR the first/last pair, not both.
- firstNameColumn / lastNameColumn: separate given/family name columns.
- titleColumn: the prospect's job title.
- companyColumn: the prospect's company / account name.
- meetingDateColumn: the primary date (or date+time) the meeting is/was scheduled for.
- bookedDateColumn: the date the meeting was booked/created, if tracked separately from the meeting date. Else null.
- heldDateColumn: the date the meeting actually happened, if tracked separately. Else null.
- statusColumn: the column indicating booked vs held vs dead/cancelled.
- prospectResponseColumn: a column indicating the invite response (accepted / declined / no-show / etc.), if any.
- eseColumn: the account executive / ESE / rep the meeting is handed to, if any.
- linkedinUrlColumn: a LinkedIn URL column, if any.
- opportunityColumns: any columns that flag an opportunity as a checkbox / boolean — headers like "Opportunity", "Rev Opp", "Revenue Opportunity", "STA Opp", "STA Opportunity". When such a column is positive (TRUE / yes / checked / x) for a row, an opportunity is auto-created for that meeting. Only include boolean/flag columns here — NOT free-text stage columns (e.g. "STA Stage"). Can be empty.
- notesColumns: any columns worth preserving as free-text notes (comments, next steps, source, etc.). Can be several; can be empty.

Status vocabulary — map every distinct value of statusColumn to exactly one of:
- "booked": upcoming / scheduled / confirmed / set / not yet happened.
- "held": completed / met / showed / done.
- "dead-end": cancelled / dead / lost / disqualified / rejected — a meeting that will not progress.
- "dead-end-if-past": statuses that only make sense once the meeting time has passed and imply it won't progress — most importantly "no-show", and "cancelled" when it reads that way. The client routes these to dead-end when the row's meeting date is in the past, or booked when the date is still in the future.
- "skip": a value that does NOT represent a real meeting (blank, header junk, "N/A", a total row). Rows with a skipped status are dropped.

Prospect-response vocabulary (only if prospectResponseColumn is set) — map each distinct value to one of: "accepted", "declined", "no-response", "no-show", "rescheduled", "still-scheduling", or "skip" (ignore this value).

Rules:
- Reference columns by their exact header string as given. If two headers are identical, pick the one that fits; the client resolves to the first match.
- Be conservative: only map a column when the header and sample values clearly support it. A wrong mapping is worse than a null.
- Map EVERY distinct status value you were given — do not leave any unmapped.
- In "assumptions", briefly note anything ambiguous the rep should double-check (date format, an unclear status value, a column you skipped). One or two sentences, plain text.`;

export interface ImportColumnMapping {
  fullNameColumn: string | null;
  firstNameColumn: string | null;
  lastNameColumn: string | null;
  titleColumn: string | null;
  companyColumn: string | null;
  meetingDateColumn: string | null;
  bookedDateColumn: string | null;
  heldDateColumn: string | null;
  statusColumn: string | null;
  prospectResponseColumn: string | null;
  eseColumn: string | null;
  linkedinUrlColumn: string | null;
  opportunityColumns: string[];
  notesColumns: string[];
}

export interface ImportValueMapEntry {
  from: string;
  to: string;
}

export interface ImportMappingResult {
  columns: ImportColumnMapping;
  statusValueMap: ImportValueMapEntry[];
  prospectResponseValueMap: ImportValueMapEntry[];
  dateFormatHint: string;
  assumptions: string;
}

const NULLABLE_STR = {
  type: ["string", "null"] as const,
};

export const IMPORT_MAPPING_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    columns: {
      type: "object" as const,
      properties: {
        fullNameColumn: NULLABLE_STR,
        firstNameColumn: NULLABLE_STR,
        lastNameColumn: NULLABLE_STR,
        titleColumn: NULLABLE_STR,
        companyColumn: NULLABLE_STR,
        meetingDateColumn: NULLABLE_STR,
        bookedDateColumn: NULLABLE_STR,
        heldDateColumn: NULLABLE_STR,
        statusColumn: NULLABLE_STR,
        prospectResponseColumn: NULLABLE_STR,
        eseColumn: NULLABLE_STR,
        linkedinUrlColumn: NULLABLE_STR,
        opportunityColumns: {
          type: "array" as const,
          items: { type: "string" as const },
        },
        notesColumns: { type: "array" as const, items: { type: "string" as const } },
      },
      required: [
        "fullNameColumn",
        "firstNameColumn",
        "lastNameColumn",
        "titleColumn",
        "companyColumn",
        "meetingDateColumn",
        "bookedDateColumn",
        "heldDateColumn",
        "statusColumn",
        "prospectResponseColumn",
        "eseColumn",
        "linkedinUrlColumn",
        "opportunityColumns",
        "notesColumns",
      ],
    },
    statusValueMap: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          from: { type: "string" as const },
          to: {
            type: "string" as const,
            enum: ["booked", "held", "dead-end", "dead-end-if-past", "skip"],
          },
        },
        required: ["from", "to"],
      },
    },
    prospectResponseValueMap: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          from: { type: "string" as const },
          to: {
            type: "string" as const,
            enum: [
              "accepted",
              "declined",
              "no-response",
              "no-show",
              "rescheduled",
              "still-scheduling",
              "skip",
            ],
          },
        },
        required: ["from", "to"],
      },
    },
    dateFormatHint: { type: "string" as const },
    assumptions: { type: "string" as const },
  },
  required: [
    "columns",
    "statusValueMap",
    "prospectResponseValueMap",
    "dateFormatHint",
    "assumptions",
  ],
};

export function buildImportMappingUserPrompt(context: {
  headers: string[];
  sampleRows: string[][];
  columnStats: {
    header: string;
    distinctCount: number;
    distinctValues: string[] | null; // full list when low-cardinality, else null
  }[];
}): string {
  const lines: string[] = [];
  lines.push(`Column headers (${context.headers.length}):`);
  context.headers.forEach((h, i) => lines.push(`  [${i}] ${h}`));
  lines.push("");
  lines.push(`Sample rows (${context.sampleRows.length}), cells aligned to headers:`);
  context.sampleRows.forEach((r, i) => {
    lines.push(`  Row ${i + 1}: ${JSON.stringify(r)}`);
  });
  lines.push("");
  lines.push("Per-column distinct values (for low-cardinality columns):");
  for (const s of context.columnStats) {
    if (s.distinctValues) {
      lines.push(
        `  "${s.header}" — ${s.distinctCount} distinct: ${JSON.stringify(
          s.distinctValues
        )}`
      );
    } else {
      lines.push(`  "${s.header}" — ${s.distinctCount} distinct (high-cardinality, free text)`);
    }
  }
  lines.push("");
  lines.push(
    "Return the mapping plan. Map every distinct value of the status column."
  );
  return lines.join("\n");
}

export const MEETING_AUTOFILL_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    firstName: { type: "string" as const },
    lastName: { type: "string" as const },
    title: { type: "string" as const },
    company: { type: "string" as const },
    linkedinUrl: { type: "string" as const },
  },
  required: ["firstName", "lastName", "title", "company", "linkedinUrl"],
};
