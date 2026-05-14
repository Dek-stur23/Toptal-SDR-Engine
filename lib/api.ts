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

  type Final = { result?: T; error?: string };

  const decoder = new TextDecoder();
  let buffer = "";
  const finalRef: { current: Final | null } = { current: null };

  const parseEvent = (raw: string) => {
    const line = raw.trim();
    if (!line) return;
    try {
      const event = JSON.parse(line) as {
        event?: string;
        result?: T;
        error?: string;
      };
      if (event.event !== "ping") {
        finalRef.current = { result: event.result, error: event.error };
      }
    } catch {
      // ignore malformed line
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });

    let idx = buffer.indexOf("\n");
    while (idx !== -1) {
      parseEvent(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 1);
      idx = buffer.indexOf("\n");
    }

    if (done) {
      // Flush trailing content with no terminating newline. This catches
      // plain-JSON error responses from the route (e.g., missing API key)
      // that don't follow the NDJSON streaming convention.
      parseEvent(buffer);
      buffer = "";
      break;
    }
  }

  const final = finalRef.current;
  if (!final) {
    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`);
    }
    throw new Error("Server closed the connection without a result.");
  }
  if (final.error) {
    throw new Error(final.error);
  }
  return final.result as T;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamChatOptions {
  system: string;
  messages: ChatMessage[];
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
}

export async function streamChatTurn(
  opts: StreamChatOptions,
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system: opts.system, messages: opts.messages }),
    signal: opts.signal,
  });

  const reader = res.body?.getReader();
  if (!reader) {
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    throw new Error("No response body.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  const state: { full: string; error: string | null; done: boolean } = {
    full: "",
    error: null,
    done: false,
  };

  const handle = (raw: string) => {
    const line = raw.trim();
    if (!line) return;
    try {
      const event = JSON.parse(line) as {
        event?: string;
        text?: string;
        error?: string;
      };
      if (event.event === "delta" && typeof event.text === "string") {
        state.full += event.text;
        opts.onDelta?.(event.text);
      } else if (event.event === "done") {
        if (typeof event.text === "string") state.full = event.text;
        state.done = true;
      } else if (event.event === "error" || event.error) {
        state.error = event.error ?? "Unknown error";
      }
    } catch {
      // ignore malformed lines
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });

    let idx = buffer.indexOf("\n");
    while (idx !== -1) {
      handle(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 1);
      idx = buffer.indexOf("\n");
    }

    if (done) {
      handle(buffer);
      buffer = "";
      break;
    }
  }

  if (state.error) throw new Error(state.error);
  if (!state.done && !state.full) {
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    throw new Error("Server closed the connection without a result.");
  }
  return state.full;
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
