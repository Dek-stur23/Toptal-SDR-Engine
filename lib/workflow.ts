import type { StepDefinition, StepKind } from "./types";

export const WORKFLOW: StepDefinition[] = [
  {
    id: "account_research",
    order: 1,
    title: "Account Research",
    subtitle: "Deep-dive profile of the target company",
    description:
      "Use the embedded Claude Project to generate a research brief: company overview, industry context, recent signals (funding, hiring, press), tech stack, and an initial Toptal-fit hypothesis. The output becomes the source of truth for every downstream step.",
    estMinutes: 20,
    storageKey: "sdr.account_research",
  },
  {
    id: "stakeholder_mapping",
    order: 2,
    title: "Buying Committee & Stakeholder Map",
    subtitle: "Identify the people who matter",
    description:
      "Using the research brief, map the buying committee: economic buyer, champion, technical evaluator, and blockers. Capture titles, LinkedIn URLs, and a one-line rationale per stakeholder.",
    estMinutes: 25,
    storageKey: "sdr.stakeholder_mapping",
  },
  {
    id: "pain_value_mapping",
    order: 3,
    title: "Pain → Toptal Value Mapping",
    subtitle: "Connect their problems to our offer",
    description:
      "For each stakeholder or workstream, list the likely pain points and the specific Toptal service line that addresses them (on-demand talent, project teams, AI services, etc.). This becomes the raw material for messaging.",
    estMinutes: 15,
    storageKey: "sdr.pain_value_mapping",
  },
  {
    id: "outreach_strategy",
    order: 4,
    title: "Outreach Strategy & Sequence Design",
    subtitle: "Multi-touch plan across channels",
    description:
      "Design the sequence: which stakeholders to target first, what channel mix (email / LinkedIn / phone), cadence, and the narrative arc across touches. Pick one 'wedge' angle per persona.",
    estMinutes: 15,
    storageKey: "sdr.outreach_strategy",
  },
  {
    id: "message_crafting",
    order: 5,
    title: "Personalized Message Crafting",
    subtitle: "Write the actual touches",
    description:
      "Draft each touch (subject line + body). Pull personalization from Steps 1-3. Every message should pass the 'would-a-CxO-reply' bar: concrete, specific, low-ask.",
    estMinutes: 30,
    storageKey: "sdr.message_crafting",
  },
  {
    id: "launch_track",
    order: 6,
    title: "Launch & Track",
    subtitle: "Ship it and watch the signals",
    description:
      "Load the sequence into your outreach tool, launch, and track replies / meetings booked. Note what worked so the next account compounds your learning.",
    estMinutes: 10,
    storageKey: "sdr.launch_track",
  },
];

export const WORKFLOW_BY_ID: Record<StepKind, StepDefinition> = WORKFLOW.reduce(
  (acc, step) => {
    acc[step.id] = step;
    return acc;
  },
  {} as Record<StepKind, StepDefinition>,
);
