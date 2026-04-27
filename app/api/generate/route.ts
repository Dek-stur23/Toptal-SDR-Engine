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

  const { prompt, system, schema, image } = body;
  if (!prompt || !system) {
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
  userContent.push({ type: "text", text: prompt });

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: MODEL,
    max_tokens: 8192,
    system: [
      {
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
  };

  if (schema) {
    const jsonSchema = convertSchema(schema);
    if (jsonSchema.type !== "object") jsonSchema.type = "object";
    params.tools = [
      {
        name: "submit_result",
        description: "Submit the structured result for the user.",
        input_schema: jsonSchema as Anthropic.Tool.InputSchema,
      },
    ];
    params.tool_choice = { type: "tool", name: "submit_result" };
  }

  try {
    const response = await client.messages.create(params);

    if (schema) {
      const toolUse = response.content.find(
        (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
      );
      if (!toolUse) {
        return NextResponse.json(
          { error: "Model did not return structured output." },
          { status: 502 },
        );
      }
      return NextResponse.json({ result: toolUse.input });
    }

    const text = response.content.find(
      (c): c is Anthropic.TextBlock => c.type === "text",
    );
    return NextResponse.json({ result: text?.text ?? "" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Generate error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
