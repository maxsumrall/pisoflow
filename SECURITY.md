# Security policy

## Report a vulnerability

Use GitHub's private vulnerability reporting for this repository. Do not publish an exploit in a public issue.

## Supported version

Only the current default branch is supported.

## Dependency policy

- Runtime and build dependencies are locked in `package-lock.json`.
- CI runs `npm ci`, `npm run audit`, and `npm test`.
- Dependabot checks npm packages and GitHub Actions each week.
- Isoflow is pinned to an exact version.
- Every Isoflow upgrade must pass the renderer, browser, concurrency, HTML-escaping, and embedded-license tests.
- Every Isoflow upgrade must refresh and review `licenses/isoflow-bundle-notices.txt` and `licenses/generated-document-notices.txt`.
- The local ReactQuill compatibility package is valid only for the tested `EXPLORABLE_READONLY` integration.

## Release checks

```bash
npm ci
npm run audit
npm test
npm run render -- examples/order-processing.json --output=release-check
```

Open the generated document and confirm that the canvas, text alternative, and open-source license section render correctly.
