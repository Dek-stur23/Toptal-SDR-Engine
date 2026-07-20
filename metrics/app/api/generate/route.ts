import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getMyMonthSpendCents, insertAiUsage } from "@/lib/data/aiUsage";
import {
  MEETING_AUTOFILL_SYSTEM,
  MEETING_AUTOFILL_TOOL_SCHEMA,
  MEETING_AUTOFILL_USER_PROMPT,
  type MeetingAutofillResult,
} from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// Pricing for cost estimation, in cents per million tokens. Numbers
// match the published Sonnet 4.x tier at the time of writing (input
// $3/M, output $15/M). If the price changes, update here and the
// per-user cap in the /admin/invites view will keep working with the
// new estimates. We over-round to the next cent to stay conservative.
const INPUT_CENTS_PER_MTOK = 300;
const OUTPUT_CENTS_PER_MTOK = 1500;

function estimateCostCents(tokensIn: number, tokensOut: number): number {
  const raw =
    (tokensIn * INPUT_CENTS_PER_MTOK + tokensOut * OUTPUT_CENTS_PER_MTOK) /
    1_000_000;
  return Math.max(1, Math.ceil(raw));
}

function monthlyCapCents(): number {
  const raw = process.env.AI_MONTHLY_CAP_CENTS;
  const n = raw ? Number.parseInt(raw, 10) : 5000;
  return Number.isFinite(n) && n > 0 ? n : 5000;
}

// The single endpoint used by the meeting-modal Autofill button.
// Auth-gated (never allow anonymous). Metered per-user against
// AI_MONTHLY_CAP_CENTS.
//
// Body: { endpoint: "autofill", image: "data:image/...;base64,..." }
//
// Response (success): { result: MeetingAutofillResult, usage: { ... } }
// Response (over cap): 429 with { error, spentCents, capCents }
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: { endpoint?: string; image?: string };
  try {
    body = (await req.json()) as { endpoint?: string; image?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (body.endpoint !== "autofill") {
    return NextResponse.json({ error: "Unknown endpoint." }, { status: 400 });
  }

  const spent = await getMyMonthSpendCents(supabase);
  const cap = monthlyCapCents();
  if (spent >= cap) {
    return NextResponse.json(
      { error: "Monthly AI spend cap reached.", spentCents: spent, capCents: cap },
      { status: 429 }
    );
  }

  const image = body.image;
  const match =
    typeof image === "string" ? image.match(/^data:([^;]+);base64,(.+)$/) : null;
  if (!match) {
    return NextResponse.json(
      { error: "Missing or malformed image." },
      { status: 400 }
    );
  }
  const mediaType = match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const base64 = match[2];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: MEETING_AUTOFILL_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: MEETING_AUTOFILL_USER_PROMPT },
          ],
        },
      ],
      tools: [
        {
          name: "submit_result",
          description: "Submit the extracted contact fields.",
          input_schema: MEETING_AUTOFILL_TOOL_SCHEMA as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "submit_result" },
    });
  } catch (err) {
    console.error("Autofill error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Anthropic call failed." },
      { status: 502 }
    );
  }

  const toolUse = response.content.find(
    (c): c is Anthropic.ToolUseBlock =>
      c.type === "tool_use" && c.name === "submit_result"
  );
  if (!toolUse) {
    return NextResponse.json(
      { error: "Model did not return structured output." },
      { status: 502 }
    );
  }

  const result = toolUse.input as MeetingAutofillResult;
  const tokensIn = response.usage?.input_tokens ?? 0;
  const tokensOut = response.usage?.output_tokens ?? 0;
  const costCents = estimateCostCents(tokensIn, tokensOut);

  // Insert usage via the service-role client — the caller doesn't get
  // an insert policy on ai_usage (only select), so RLS would refuse
  // an anon-scoped insert.
  try {
    const service = createServiceClient();
    await insertAiUsage(service, {
      userId: user.id,
      endpoint: "autofill",
      tokensIn,
      tokensOut,
      estimatedCostCents: costCents,
    });
  } catch (err) {
    // If usage logging fails we still return the result — it's a
    // metering miss, not a user-visible error. Surface it in logs.
    console.error("ai_usage insert failed:", err);
  }

  return NextResponse.json({
    result,
    usage: {
      tokensIn,
      tokensOut,
      costCents,
      spentCentsThisMonth: spent + costCents,
      capCents: cap,
    },
  });
}
