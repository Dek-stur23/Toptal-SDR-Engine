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
  const json = (await res.json()) as { result?: T; error?: string };
  if (!res.ok || json.error) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json.result as T;
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
