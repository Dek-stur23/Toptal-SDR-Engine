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
