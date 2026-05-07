"use client";

interface GenerateOptions {
  prompt: string;
  system: string;
  schema?: unknown;
  image?: string | null;
  webSearch?: boolean;
  maxWebSearches?: number;
}

export async function generateWithClaude<T>(opts: GenerateOptions): Promise<T> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });

  if (!res.ok && !res.body) {
    throw new Error(`Request failed (${res.status})`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("No response body.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let final: { result?: T; error?: string } | null = null;

  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });

    let idx = buffer.indexOf("\n");
    while (idx !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) {
        try {
          const event = JSON.parse(line) as {
            event?: string;
            result?: T;
            error?: string;
          };
          if (event.event !== "ping") {
            final = { result: event.result, error: event.error };
          }
        } catch {
          // ignore malformed line
        }
      }
      idx = buffer.indexOf("\n");
    }

    if (done) break;
  }

  if (!final) {
    throw new Error("Server closed the connection without a result.");
  }
  if (final.error) {
    throw new Error(final.error);
  }
  return final.result as T;
}

export function getStatusContext(status: string): string {
  if (!status) return "";
  let desc = "";
  if (status === "Signed Account - Active") {
    desc =
      "Toptal has a contract with the account and has worked with / generated revenue with the account in the last 12 months.";
  } else if (status === "Signed Account - Dormant") {
    desc =
      "Toptal has a signed contract on file with the account but has not generated revenue or delivered work for the account in at least 12 months and potentially never.";
  } else if (status === "Unsigned Account") {
    desc = "Toptal does not currently have a signed contract with this account.";
  }
  return `\n\nCRITICAL CONTEXT FOR THIS ACCOUNT:\nAccount Relationship Status: ${status}\nDefinition: ${desc}\nEnsure this relationship context strictly informs the tone, strategy, and messaging of your output.`;
}
