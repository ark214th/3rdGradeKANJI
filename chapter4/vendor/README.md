# 第4章の教材素材

- Klee One Regular: https://github.com/google/fonts/tree/main/ofl/kleeone
  - 元TTF blob: `106bd3dbcfb24f7c971b761d63223b37104d4b6f`
  - Copyright 2020 The Klee Project Authors, SIL OFL 1.1（OFL-KleeOne.txt）。fontToolsでWOFFへ変換、字形変更・サブセット化なし。
  - 娘側 `ark214th/1stGradeMath` main `186f111` と作業ブランチ `b50e690` に追加フォントがなかったため、移植元とは別に採用。教科書体そのものと同一であるとは扱わない。
- KanjiVG: https://github.com/KanjiVG/kanjivg
  - source commit: `70a0b7ae0c18ceb5cb358274b029cce0234a43bc`
  - Copyright (C) 2009–2026 Ulrich Apel and contributors, CC BY-SA 3.0（LICENSE-KanjiVG.txt）。
  - `../kanji-strokes.js`: 第4章全80文の答えに含まれる218文字（句読点を除く）。`kanji/XXXXX.svg`の`kvg:XXXXX-sN`を画番号順に抽出。座標・パス変更なし。派生データもCC BY-SA 3.0。
- `../tracing-core.js`: `ark214th/1stGradeMath` main `186f111` の `kanji_mahou/kanji-core.js` から、SVGパス処理・なぞり判定だけを移植。ゲーム固有の保存・報酬処理を除外。

画面から `../credits.html` へリンク。素材は同一オリジン配信で、外部CDN・筆跡送信なし。
