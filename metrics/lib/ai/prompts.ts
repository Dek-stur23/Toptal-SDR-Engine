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
