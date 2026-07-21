import type { StackBuckets } from "./types";

export const STACK_BUCKETS: ReadonlyArray<{
  key: keyof StackBuckets;
  label: string;
}> = [
  { key: "backend", label: "Core Infrastructure & Backend" },
  { key: "frontend", label: "Frontend & UI" },
  { key: "data", label: "Data & Storage" },
  { key: "devops", label: "DevOps & Observability" },
  { key: "ai", label: "AI & Emerging Tech" },
];

export function stackHasAny(stack: StackBuckets): boolean {
  return STACK_BUCKETS.some((b) => stack[b.key].trim().length > 0);
}

export function stackToText(stack: StackBuckets): string {
  return STACK_BUCKETS.filter((b) => stack[b.key].trim().length > 0)
    .map((b) => `## ${b.label}\n\n${stack[b.key].trim()}`)
    .join("\n\n");
}
