# 第4章の教材素材

## KanjiVG（書き順・お手本の字形）

- 配布元: https://kanjivg.tagaini.net/ ／ https://github.com/KanjiVG/kanjivg（commit `70a0b7ae0c18ceb5cb358274b029cce0234a43bc`）
- Copyright (C) 2009-2026 Ulrich Apel and contributors.
- ライセンス: Creative Commons Attribution-ShareAlike 3.0（[LICENSE-KanjiVG.txt](LICENSE-KanjiVG.txt)、https://creativecommons.org/licenses/by-sa/3.0/deed.ja ）
- `../kanji-strokes.js`: 第4章の答え・問題文に出る254文字の画のパスを `../tools/build_strokes.py` で抽出。座標を小数1桁に丸めた以外は変更なし。派生データとして CC BY-SA 3.0 で配布します。
- 画面では、海図と図鑑の下に権利表記を表示しています。

## なぞり判定

- `../stroke-trace.js`: 娘側 `ark214th/1stGradeMath` の `kanji_mahou/kanji-core.js` から、SVGパスの点列化となぞり判定だけを移植。

書き順や字形には教材による違いがあります。学校のお手本と異なる場合は、学校の指導を優先してください。

## Anthropic TypeScript SDK（自動採点）

- `anthropic-sdk.js`: `@anthropic-ai/sdk` 0.132.1 を esbuild でブラウザ用の1ファイルにまとめたもの（`../tools/build_anthropic_sdk.sh` で再生成）。MIT License（[LICENSE-anthropic-sdk.txt](LICENSE-anthropic-sdk.txt)、Copyright 2023 Anthropic, PBC）。
- 自動採点を使うときだけ読み込む。APIキーはソースに含めず、保護者用画面で入力した値をこの端末の localStorage に保存する。

