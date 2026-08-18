---
name: pisoflow
description: Create interactive isometric Isoflow architecture explanations from code, services, event streams, databases, and data flows. Use when the user asks to visualize a system with Isoflow, explain architecture interactively, compare current and target flows, or identify active, legacy, and unused components.
license: MIT
compatibility: Requires Node.js 22.12 or newer, npm, and a browser. Uses Isoflow Community Edition under the MIT license.
---

# Pisoflow

Create the smallest interactive diagram that answers the user's question.

## Workflow

1. Inspect the relevant code, configuration, and runtime entry points.
2. Identify the runtime flow, source lineage, output contract, and migration state.
3. Separate facts from assumptions. Mark a component as unused only when configuration and references prove it.
4. Create as few views as needed, normally two to five:
   - a small default overview
   - current detailed runtime flow
   - proposed runtime flow
   - component decision or migration state
   - future target when relevant
5. Put exact component names and simplified queries or code in node descriptions.
6. Keep visible node labels short.
7. Mark every proposed interface or parameter contract explicitly.
8. Add regions, headings, a legend, meaningful edge descriptions, and more than color to distinguish flow types.
9. Write the diagram source as JSON that follows [references/schema.md](references/schema.md).
10. Render and open it from the package root:

```bash
npm run render -- <diagram.json> --output=<name> --open
```

The renderer creates a unique directory below `~/.agent/diagrams/pisoflow/`. It does not accept an arbitrary output path.

## Setup

From the package root, run:

```bash
npm ci
```

## Modeling rules

- Use one node for one responsibility.
- Use one edge for one meaningful data or control transfer.
- Do not show framework internals unless they explain the decision.
- Use `context` for shared request context.
- Use `fact` for active calculation.
- Use `source` for source events and persisted data.
- Use `unused` only for confirmed unused or removable components.
- Use `warning` for legacy, parallel, or candidate components.
- Put simple queries or code in descriptions, not in visible labels.
- Keep raw fact domains separate.
- Show request-time and precomputed paths in separate views.
- State freshness, watermark, and historical-read behavior when they affect correctness.
- State the exact condition required before a legacy component can be removed.
- Keep the default overview below approximately seven nodes.
- Keep detailed views below approximately 20 nodes.
- Ensure the text alternative explains every canvas view.

## Result

Return the generated `index.html` path and a short list of views. State any component whose usage remains uncertain. Tell the user that node details contain simplified code and that the text alternative is below the canvas.
