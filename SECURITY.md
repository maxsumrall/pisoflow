# Security policy

## Report a vulnerability

Use GitHub's private vulnerability reporting for this repository. Do not publish an exploit in a public issue.

## Supported version

Only the current default branch is supported.

## Dependency policy

- Root runtime dependencies and isolated tooling dependencies have separate lockfiles.
- Pi package installation installs only the root runtime dependency.
- CI audits both dependency trees and runs runtime and browser tests.
- Dependabot checks root npm, tooling npm, and GitHub Actions each week.
- Isoflow is pinned to an exact tooling version.
- Every Isoflow upgrade must pass renderer, file URL, keyboard, responsive, console-error, concurrency, hostile-text, and embedded-license tests.
- Every Isoflow upgrade must refresh and review `licenses/isoflow-bundle-notices.txt` and `licenses/generated-document-notices.txt`.
- The local ReactQuill compatibility package is valid only for the tested `EXPLORABLE_READONLY` integration.

## Browser accessibility boundary

- The external view tabs, component controls, inspector, and complete text alternative provide the accessible architecture contract.
- Isoflow's three exposed canvas controls have accessible names and keyboard focus tests.
- Isoflow renders decorative component icons without `alt` attributes. The browser audit excludes only `.canvas img`; the same component names and meanings remain available in text beside and below the canvas.

## Template policy

- `skills/pisoflow/assets/template.html` is a generated release asset.
- CI rebuilds it from `tooling/` and rejects drift.
- The template must contain exactly one `__PISOFLOW_DATA_BASE64__` marker.
- The template must not contain external script or stylesheet references.
- Runtime rendering validates the marker count before it writes output.
- Diagram data is UTF-8 JSON encoded as Base64 before template injection.

## Release checks

```bash
npm ci
npm run audit
npm test
npm --prefix tooling ci
npx --prefix tooling playwright install chromium
npm --prefix tooling run audit
npm --prefix tooling test
npm --prefix tooling run build-template
git diff --exit-code -- skills/pisoflow/assets/template.html
node skills/pisoflow/scripts/render.mjs examples/order-processing.json --output=release-check
```

Open the generated document and confirm that the canvas, external controls, component inspector, searchable text alternative, and open-source license section render correctly.
