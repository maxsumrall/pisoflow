# Pisoflow

Pisoflow is a [Pi](https://github.com/badlogic/pi-mono) skill that turns architecture descriptions into interactive, self-contained [Isoflow](https://github.com/markmanx/isoflow) documents.

Each document includes:

- an explorable isometric canvas
- several focused architecture views
- searchable component details
- an accessible text representation
- embedded open-source license notices

Pisoflow is independent and is not affiliated with Isoflow.

## Install

```bash
pi install git:github.com/maxsumrall/pisoflow
```

Review the source before installation. Pi skills can instruct the agent to run local programs.

## Use with Pi

Ask Pi to use Pisoflow when you want an interactive architecture explanation:

```text
Use Pisoflow to show the current and proposed order-processing architecture.
```

The skill inspects the relevant project, writes a validated JSON diagram, and runs the renderer.

## Render directly

Requires Node.js 22.12 or newer.

```bash
npm ci
npm run render -- examples/order-processing.json --output=order-processing --open
```

The renderer creates a unique directory below:

```text
~/.agent/diagrams/pisoflow/
```

It returns the generated `index.html` path. Each document is self-contained and can be opened without a server.

## Diagram format

See [`skills/pisoflow/references/schema.md`](skills/pisoflow/references/schema.md). The renderer validates the complete document before it starts a build. It rejects unknown references, duplicate identifiers, unknown colors, malformed coordinates, and unsafe output names.

## Safety

- Output names cannot contain paths.
- Each render owns a unique output directory.
- Concurrent renders do not share generated data or output directories.
- Failed builds remove only their own new output directory.
- The renderer uses argument arrays instead of shell command strings.
- Descriptions are HTML-escaped before they enter the Isoflow runtime.

## Development

```bash
npm ci
npm run audit
npm test
```

See [`SECURITY.md`](SECURITY.md) for the dependency and release policy.

## Licensing

Pisoflow is available under the MIT license in [`LICENSE`](LICENSE).

Isoflow Community Edition is an MIT-licensed runtime dependency. Its full notice is in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and is embedded in every generated HTML document. Notices supplied with Isoflow's distribution bundle are preserved in [`licenses/isoflow-bundle-notices.txt`](licenses/isoflow-bundle-notices.txt). Complete license texts used by generated documents are combined in [`licenses/generated-document-notices.txt`](licenses/generated-document-notices.txt) and embedded in every document.

Pisoflow does not depend on or redistribute `@isoflow/isopacks`. The included generic SVG icons are original Pisoflow assets, which avoids the mixed third-party icon licenses in that package.
