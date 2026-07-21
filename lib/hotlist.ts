// Centralized factories and safe mutation helpers for the hotlist.
//
// Every callsite that adds a prospect must go through createProspect so the
// shape, id generation, and timestamp are consistent. Every remove operation
// must go through removeProspectById/removeMessageById so a stale or missing
// id no-ops loudly instead of silently rewriting the list to [].

import type { HotlistMessage, HotlistPriority, HotlistProspect } from "./types";
import { genId } from "./ids";

export interface NewProspectInput {
  firstName?: string;
  lastName?: string;
  title?: string;
  company?: string;
  linkedinUrl?: string;
  priority?: HotlistPriority;
  notes?: string;
  image?: string | null;
  messages?: HotlistMessage[];
  dateAdded?: string;
}

function defaultStamp(): string {
  return new Date().toLocaleString([], {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function createProspect(input: NewProspectInput): HotlistProspect {
  return {
    id: genId(),
    firstName: (input.firstName ?? "").trim(),
    lastName: (input.lastName ?? "").trim(),
    title: (input.title ?? "").trim(),
    company: (input.company ?? "").trim(),
    linkedinUrl: (input.linkedinUrl ?? "").trim(),
    priority: input.priority ?? "high",
    notes: input.notes ?? "",
    dateAdded: input.dateAdded ?? defaultStamp(),
    messages: Array.isArray(input.messages) ? input.messages : [],
    image: input.image ?? null,
  };
}

export interface NewMessageInput {
  channel: HotlistMessage["channel"];
  subject?: string;
  body: string;
  date?: string;
  response?: string;
}

export function createMessage(input: NewMessageInput): HotlistMessage {
  return {
    id: genId(),
    channel: input.channel,
    subject: (input.subject ?? "").trim(),
    body: input.body,
    date: input.date ?? defaultStamp(),
    response: (input.response ?? "").trim(),
  };
}

// Remove exactly one prospect by id. Returns the original reference (not a
// rebuilt array) when the id doesn't match anything, so the no-op is
// detectable and React won't trigger a re-render for a no-op.
export function removeProspectById(
  list: HotlistProspect[],
  id: number,
): HotlistProspect[] {
  let matches = 0;
  for (const p of list) if (p.id === id) matches++;
  if (matches === 0) {
    console.warn(
      `[hotlist] removeProspectById: id ${id} not found; list unchanged`,
    );
    return list;
  }
  if (matches > 1) {
    console.warn(
      `[hotlist] removeProspectById: ${matches} prospects share id ${id}; removing all matches (data was corrupt)`,
    );
  }
  return list.filter((p) => p.id !== id);
}

export function removeMessageById(
  messages: HotlistMessage[],
  id: number,
): HotlistMessage[] {
  let matches = 0;
  for (const m of messages) if (m.id === id) matches++;
  if (matches === 0) {
    console.warn(
      `[hotlist] removeMessageById: id ${id} not found; messages unchanged`,
    );
    return messages;
  }
  if (matches > 1) {
    console.warn(
      `[hotlist] removeMessageById: ${matches} messages share id ${id}; removing all matches`,
    );
  }
  return messages.filter((m) => m.id !== id);
}

// Patch a prospect in place by id. No-op if the id isn't found.
export function patchProspectById(
  list: HotlistProspect[],
  id: number,
  patch: Partial<HotlistProspect>,
): HotlistProspect[] {
  let found = false;
  const next = list.map((p) => {
    if (p.id !== id) return p;
    found = true;
    return { ...p, ...patch };
  });
  if (!found) {
    console.warn(
      `[hotlist] patchProspectById: id ${id} not found; list unchanged`,
    );
    return list;
  }
  return next;
}

export function patchMessageById(
  list: HotlistProspect[],
  prospectId: number,
  messageId: number,
  patch: Partial<HotlistMessage>,
): HotlistProspect[] {
  let found = false;
  const next = list.map((p) => {
    if (p.id !== prospectId) return p;
    const messages = (p.messages ?? []).map((m) => {
      if (m.id !== messageId) return m;
      found = true;
      return { ...m, ...patch };
    });
    return { ...p, messages };
  });
  if (!found) {
    console.warn(
      `[hotlist] patchMessageById: prospect ${prospectId} / message ${messageId} not found; list unchanged`,
    );
    return list;
  }
  return next;
}

// Prepend new prospects to an existing list, preserving every existing entry.
// Used by both single-add and bulk-add paths.
export function prependProspects(
  list: HotlistProspect[],
  newProspects: HotlistProspect[],
): HotlistProspect[] {
  return [...newProspects, ...list];
}
