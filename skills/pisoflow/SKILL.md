---
name: pisoflow
description: Create evidence-backed interactive isometric architecture explanations from code, services, event streams, databases, and data flows. Use when the user asks to visualize a system, explain architecture interactively, compare current and target flows, or identify active, legacy, and unused components.
license: MIT
compatibility: Requires Node.js 22.12 or newer and a browser. Rendering is offline and does not require npm.
---

# Pisoflow

Create the smallest interactive diagram that answers the user's question.

## Workflow

1. Identify the decision, audience, and system boundary. Ask one question only when the answer changes the diagram.
2. Inspect relevant entry points, configuration, contracts, and runtime evidence. Stop at the stated boundary.
3. Separate observed facts, inferences, proposals, legacy paths, unused parts, and unknowns. Attach source evidence to each node and flow.
4. Create one view by default. Add a view only when it answers a different question, such as current versus proposed behavior.
5. Keep canvas summaries short. Put exact component names, contracts, simplified code, and queries in details.
6. Write semantic JSON that follows [references/schema.md](references/schema.md). Do not choose coordinates, colors, line styles, region bounds, or legend entries.
7. Write the source to a temporary file outside the inspected repository.
8. Resolve this skill's directory from the loaded `SKILL.md` path, then render with Node:

```bash
node <pisoflow-skill-directory>/scripts/render.mjs <absolute-diagram.json> --output=<name> --open
```

The renderer creates a unique directory below `~/.agent/diagrams/pisoflow/`. Delete the temporary source after a successful render.

## Modeling rules

- Use one node for one responsibility.
- Use one edge for one meaningful data, event, request, control, or result transfer.
- Use groups for deployment zones, ownership boundaries, runtime stages, or other meaningful lanes.
- Use exact names from evidence. Do not invent an implementation name.
- Mark `observed` only when source or runtime evidence supports the claim.
- Use `inferred` when evidence supports a conclusion but does not prove it.
- Mark every proposed interface and parameter contract explicitly.
- Use `unused` only when references and configuration prove removal is safe.
- State freshness, watermark, failure behavior, and historical-read behavior when they affect correctness.
- State the exact condition required before a legacy component can be removed.
- Keep an overview below approximately seven nodes and a detailed view below approximately 20 nodes.

## Result

Return the generated `index.html` path and a short list of views. State unresolved unknowns. Tell the user that accessible view controls and component details are beside the canvas, and the complete searchable text alternative is below it.
