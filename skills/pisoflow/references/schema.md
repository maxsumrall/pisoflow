# Diagram schema

Pisoflow source is semantic. The renderer derives all geometry and visual styling.

```json
{
  "title": "System flow",
  "description": "What this explanation covers.",
  "question": "What question does this diagram answer?",
  "audience": "Engineers reviewing the runtime path",
  "scope": "The client request through the final response",
  "nodes": [
    {
      "id": "client",
      "name": "Client",
      "icon": "desktop",
      "summary": "Starts the request.",
      "details": "Optional exact contract, query, or simplified code.",
      "status": "observed",
      "evidence": [
        { "source": "src/client.ts:20", "detail": "Calls POST /result" }
      ]
    },
    {
      "id": "service",
      "name": "Result service",
      "icon": "server",
      "summary": "Creates the result.",
      "status": "observed",
      "evidence": [
        { "source": "src/server.ts:42" }
      ]
    }
  ],
  "views": [
    {
      "id": "overview",
      "name": "Overview",
      "question": "How does the request complete?",
      "description": "The client calls the service and receives a result.",
      "groups": [
        { "id": "runtime", "name": "Runtime", "nodes": ["client", "service"] }
      ],
      "edges": [
        {
          "id": "create-result",
          "from": "client",
          "to": "service",
          "kind": "request",
          "label": "Create result",
          "contract": "POST /result { input }",
          "status": "observed",
          "evidence": [
            { "source": "src/client.ts:20", "detail": "Request call" }
          ]
        }
      ]
    }
  ]
}
```

## Required metadata

- `title`: short document title
- `description`: one-sentence purpose
- `question`: the main decision or question
- `audience`: intended reader
- `scope`: included boundary and relevant exclusions

## Nodes

Every node requires `id`, `name`, `icon`, `summary`, `status`, and `evidence`. `details` is optional plain text. Keep `summary` short because it appears on the canvas. Put contracts, queries, and simplified code in `details`.

Valid icons:

- `desktop`: client
- `server`: service
- `storage`: database or table
- `queue`: event stream
- `function-module`: transformation or worker
- `document`: result or contract
- `block`: generic component

## Views and groups

Use one view by default. Each view requires at least one group. Group order defines stable visual lanes. Node order within a group is a stable tie-breaker for layout. Every node must appear in at least one view. A node can appear once in each view and must belong to exactly one group in that view.

Edges belong to a view. Both endpoints must be members of that view. Edge identifiers must be unique within the view.

## Statuses

- `observed`: direct source or runtime evidence
- `inferred`: evidence-backed conclusion that is not proved
- `proposed`: future design
- `legacy`: active old path with a removal condition
- `unused`: proved unused or removable
- `unknown`: unresolved usage or behavior

## Edge kinds

- `request`: synchronous request or command
- `event`: asynchronous message or event
- `data`: data read, write, or transfer
- `control`: scheduling, coordination, or control signal
- `result`: returned output

## Evidence

Each evidence entry requires `source` and can include `detail`. Use a repository path with a line number, a configuration key, a runtime trace identifier, or another exact source. Use an empty evidence array only when the status is `unknown` and no evidence exists.
