import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

type GeminiType = "OBJECT" | "STRING" | "ARRAY" | "NUMBER" | "BOOLEAN" | "INTEGER";

interface GeminiSchema {
  type?: GeminiType | string;
  properties?: Record<string, GeminiSchema>;
  items?: GeminiSchema;
  required?: string[];
  description?: string;
  enum?: unknown[];
}

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  description?: string;
  enum?: unknown[];
  additionalProperties?: boolean;
}

function convertSchema(s: GeminiSchema | undefined): JsonSchema {
  if (!s) return { type: "object" };
  const out: JsonSchema = {};
  if (s.type) out.type = String(s.type).toLowerCase();
  if (s.description) out.description = s.description;
  if (s.required) out.required = s.required;
  if (s.enum) out.enum = s.enum;
  if (s.properties) {
    out.properties = {};
    for (const k of Object.keys(s.properties)) {
      out.properties[k] = convertSchema(s.properties[k]);
    }
  }
  if (s.items) out.items = convertSchema(s.items);
  return out;
}

interface GenerateRequest {
  prompt: string;
  system: string;
  schema?: GeminiSchema;
  image?: string | null;
  webSearch?: boolean;
  maxWebSearches?: number;
}

interface BlockCitation {
  type?: string;
  url?: string;
  title?: string | null;
}

const MODEL_SOURCE_LINK_RE = /\s*\[Source\]\([^)]+\)/gi;

function citationLabel(c: BlockCitation): string {
  const rawTitle = (c.title ?? "").trim();
  // Strip trailing "| Site" or " - Site" suffixes that page titles often carry.
  const cleaned = rawTitle.replace(/\s*[|\-–—]\s*[^|\-–—]+$/u, "").trim();
  const title = cleaned || rawTitle;
  if (title) return title.length > 60 ? title.slice(0, 60).trim() + "…" : title;
  if (c.url) {
    try {
      return new URL(c.url).hostname.replace(/^www\./, "");
    } catch {
      return "Source";
    }
  }
  return "Source";
}

function blockTextWithVerifiedSources(block: Anthropic.TextBlock): string {
  const stripped = block.text.replace(MODEL_SOURCE_LINK_RE, "");
  const raw = (block as unknown as { citations?: BlockCitation[] }).citations;
  if (!Array.isArray(raw) || raw.length === 0) return stripped;
  const seen = new Set<string>();
  const links: string[] = [];
  for (const c of raw) {
    if (c.type !== "web_search_result_location" || !c.url) continue;
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    links.push(`[${citationLabel(c)}](${c.url})`);
  }
  if (links.length === 0) return stripped;
  const trimmed = stripped.replace(/\s+$/, "");
  return `${trimmed} ${links.join(" ")}`;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { prompt, system, schema, image, webSearch, maxWebSearches } = body;
  const trimmedPrompt = typeof prompt === "string" ? prompt.trim() : "";
  const trimmedSystem = typeof system === "string" ? system.trim() : "";
  if (!trimmedPrompt || !trimmedSystem) {
    return NextResponse.json(
      { error: "Missing prompt or system." },
      { status: 400 },
    );
  }

  const userContent: Anthropic.ContentBlockParam[] = [];

  if (image && typeof image === "string") {
    const match = image.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: match[1] as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp",
          data: match[2],
        },
      });
    }
  }
  userContent.push({ type: "text", text: trimmedPrompt });

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: MODEL,
    max_tokens: 8192,
    system: [
      {
        type: "text",
        text: trimmedSystem,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
  };

  const tools: NonNullable<Anthropic.MessageCreateParamsNonStreaming["tools"]> =
    [];

  if (webSearch) {
    tools.push({
      type: "web_search_20250305",
      name: "web_search",
      max_uses:
        typeof maxWebSearches === "number" && maxWebSearches > 0
          ? Math.min(maxWebSearches, 10)
          : 3,
    } as unknown as Anthropic.Tool);
  }

  if (schema) {
    const jsonSchema = convertSchema(schema);
    if (jsonSchema.type !== "object") jsonSchema.type = "object";
    tools.push({
      name: "submit_result",
      description: "Submit the structured result for the user.",
      input_schema: jsonSchema as Anthropic.Tool.InputSchema,
    });
    params.tool_choice = webSearch
      ? { type: "any" }
      : { type: "tool", name: "submit_result" };
  }

  if (tools.length > 0) params.tools = tools;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`{"event":"ping"}\n`));
        } catch {
          // controller already closed; ignore
        }
      }, 5000);

      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
      };

      try {
        const response = await client.messages.create(params);

        if (schema) {
          const toolUse = response.content.find(
            (c): c is Anthropic.ToolUseBlock =>
              c.type === "tool_use" && c.name === "submit_result",
          );
          if (!toolUse) {
            send({ error: "Model did not return structured output." });
          } else {
            send({ result: toolUse.input });
          }
        } else {
          const textBlocks = response.content.filter(
            (c): c is Anthropic.TextBlock => c.type === "text",
          );
          const text = textBlocks
            .map(blockTextWithVerifiedSources)
            .join("\n\n");
          send({ result: text });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Generate error:", err);
        send({ error: message });
      } finally {
        clearInterval(pingInterval);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
