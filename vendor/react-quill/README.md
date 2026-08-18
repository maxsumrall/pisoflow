# Pisoflow read-only ReactQuill compatibility package

Isoflow 1.1.1 includes ReactQuill in its compiled distribution but also declares `react-quill` as an installed dependency. Pisoflow uses Isoflow only in `EXPLORABLE_READONLY` mode and does not use that external editor dependency.

This local package satisfies the unused declaration without installing Quill 1. It renders any unexpected value as React text and does not interpret HTML.
