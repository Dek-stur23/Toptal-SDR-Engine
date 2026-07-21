# Toptal SDR Engine

An internal Next.js tool that walks an Enterprise SDR through a structured
account preparation workflow. Each AI-powered step ("Gem") is a card with a
configurable system prompt and a button that runs Claude with structured
output.

Multi-account support, with per-account state stored in `localStorage`.

## Workflow

**Phase 1 — Account R&D**
1. Account Relationship (status capture)
2. Account Overview — *Gem*: Enterprise Account Plan
3. Account Initiative & Challenges — *Gem*: Executive Sales Intelligence
4. Initiative / Challenge Architect — *Gem*: Toptal Solutions Architect
5. Procurement Insights — *Gems*: Procurement Strategist + Cadence Copywriter

**Phase 2 — Account Launch**
6. Account Context (notes)
7. Previous Contacts (CRUD)
8. Team Link Search (CRUD)
9. Cadence Builder (CRUD with checklist + briefing)

**Phase 3 — Daily Actions**
- Recent News — *Gem*: News Analyst
- ICP Intel — *Gem*: ICP Intel Research Analyst (with image input)
- Personalized Messaging — *Gem*: Observation-Based Copywriter (with image input)
- Log Conversation
- ESE Meeting

## Getting started

```bash
npm install
cp .env.example .env.local       # then set ANTHROPIC_API_KEY
npm run dev
```

Open <http://localhost:3000>.

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS + tailwindcss-animate
- `@anthropic-ai/sdk` (server-side only)
- `lucide-react` icons

## Architecture

- **AI calls run server-side** through `app/api/generate/route.ts`. Each call
  takes a prompt, system prompt, and optional JSON schema. Schemas are
  enforced via Claude's tool-use mechanism (forced tool choice). The server
  prompt-caches the system prompt, since each Gem reuses its instructions
  across calls.
- **Vision input** (LinkedIn screenshots) is forwarded as base64 image blocks
  for the ICP Intel and Personalized Messaging Gems.
- **Persistence** is `localStorage` (key `toptal-sdr-engine::app`). Multiple
  accounts are stored, each with its own data, completion state, active
  step/tool, and Gem instruction overrides.
- **PDF export** opens a print-optimized window assembled from the active
  account's data.

## Project structure

```
app/
  api/generate/route.ts     Anthropic API proxy with structured output
  page.tsx                  App shell, phase/step orchestrator
components/
  Sidebar.tsx               Multi-account sidebar (active + archived)
  Header.tsx                Top header
  StepCard.tsx              Reusable expandable step (with timeline node)
  ToolCard.tsx              Reusable expandable tool
  steps/                    Phase 1 + Phase 2 step components
  tools/                    Phase 3 tool components
lib/
  api.ts                    Client wrapper for /api/generate
  gems.ts                   Default Gem (system prompt) instructions
  pdf.ts                    PDF export
  storage.ts                localStorage CRUD
  types.ts                  Shared types
```

## Customizing a Gem

Each AI-powered step has a "Configure Gem" button that exposes the system
prompt as a textarea. Edits are scoped to the current account and persist in
`localStorage`. Defaults live in `lib/gems.ts`.
