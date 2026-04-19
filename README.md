# Toptal SDR Engine

A lightweight internal tool that walks an Enterprise SDR through a repeatable,
six-step workflow for opening a new account. Each step is a module on a
vertical timeline; the output of one step is pinned as context for every step
that follows.

## Workflow

1. **Account Research** — embedded Claude Project + a structured capture form.
   The saved brief becomes the source of truth for all downstream steps.
2. **Buying Committee & Stakeholder Map**
3. **Pain → Toptal Value Mapping**
4. **Outreach Strategy & Sequence Design**
5. **Personalized Message Crafting**
6. **Launch & Track**

State is persisted in `localStorage` under `toptal-sdr-engine::workflow`, so
there's no backend required for the MVP.

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Stack

- Next.js 14 (App Router) + React 18
- TypeScript
- Tailwind CSS

## Notes on the Claude Project embed

`claude.ai` sends `X-Frame-Options: DENY`, which blocks iframe embedding. The
Account Research step therefore:

- Accepts a Claude Project URL you configure in the UI.
- Renders a prominent "Open Claude Project" button that opens it in a new
  tab.
- Provides structured fields to paste the Project's output back into the app,
  where it's stored and pinned to later steps.

If you later proxy the Claude Project through your own domain (which removes
the frame headers), the UI will automatically render it inline.

## Project structure

```
app/                 Next.js App Router entrypoint
components/          Timeline + step UI
components/steps/    Per-step panels (AccountResearch, GenericStep, …)
lib/workflow.ts      Ordered workflow definition
lib/storage.ts       localStorage persistence
lib/types.ts         Shared types
```
