# Diagram schema

```json
{
  "title": "System flow",
  "description": "What the diagram explains",
  "nodes": [
    {
      "id": "client",
      "name": "Client",
      "icon": "desktop",
      "description": "Starts the request"
    },
    {
      "id": "service",
      "name": "Service",
      "icon": "server",
      "description": "Purpose and a small code or query sketch"
    }
  ],
  "views": [
    {
      "id": "overview",
      "name": "Overview",
      "description": "The main runtime flow",
      "nodes": [
        { "id": "client", "x": -3, "y": 0, "labelHeight": 100 },
        { "id": "service", "x": 3, "y": 0, "labelHeight": 100 }
      ],
      "edges": [
        {
          "id": "request",
          "from": "client",
          "to": "service",
          "color": "service",
          "description": "Request"
        }
      ],
      "regions": [
        {
          "id": "runtime",
          "color": "context",
          "from": { "x": -2, "y": 2 },
          "to": { "x": 2, "y": -2 }
        }
      ],
      "labels": [
        {
          "id": "runtime-label",
          "tile": { "x": -2, "y": 3 },
          "content": "Runtime",
          "fontSize": 0.6,
          "orientation": "X"
        }
      ]
    }
  ]
}
```

## Standard colors

- `context`: shared request context
- `fact`: active fact calculation
- `source`: source events or tables
- `service`: application or API
- `output`: final result
- `unused`: unused or removable model
- `warning`: legacy, risk, or migration state

## Standard icons

- `desktop`: client
- `server`: service
- `storage`: database or table
- `queue`: event stream
- `function-module`: query or transformation
- `document`: result or contract
- `block`: generic or unused item

## Layout

Use integer tile coordinates. Put the main flow from left to right. Keep at least three tiles between nodes. Use one view for each distinct question. Keep each view below approximately 20 nodes.

Descriptions support Markdown. Put a short responsibility statement first. Add simplified SQL or pseudocode only when it helps the user understand the node.