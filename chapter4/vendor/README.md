# Local handwriting recognition dependencies

Upstream: https://github.com/asdfjkl/kanjicanvas (MIT; included LICENSE.TXT).
Retrieved 2026-09-29. No CDN or remote recognition service is used at runtime.

- `kanji-canvas.js`: upstream (whitespace normalized only) `docs/resources/javascript/kanji-canvas.js`, Git blob `fd398c48e86161a5a9fcce51550d0d89efcbbfa2`.
- `ref-patterns.js`: 2,213 upstream reference characters from Git blob `97bc952927c58b3ae66a87c39fe538f784559215`. Removed commented test vectors and rounded coordinates to 0.01 of the 256-unit reference space; character inventory and strokes retained.
- `kana-patterns.js`: 54 kana needed by the current sentences (plus full-size equivalents of small kana), derived from upstream `hiragana/*.xml` and `katakana/*.xml`. `kana-sources.json` records exact source paths and Git blob SHAs. Parse each XML stroke's x/y points, apply `KanjiCanvas.momentNormalize`, then `extractFeatures(...,20)`, round to 0.01, and append `[character, strokeCount, points]` to the dictionary. Small kana size is deliberately not scored.

`../recognition-worker.js` supplies a worker-only window/document shim and calls the numerical methods directly. It does not initialize KanjiCanvas DOM input handlers or call its UI recognition wrapper. Fine ranking follows upstream's distance algorithm but returns numeric distances and three candidates instead of its HTML/string output. This also avoids upstream debug logging in the UI wrapper.

The worker receives ink only, never the correct answer. Distances are heuristic and not confidence probabilities. The game uses these for advisory marks only; real child handwriting accuracy has not been measured.
