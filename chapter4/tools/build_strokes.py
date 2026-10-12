#!/usr/bin/env python3
"""KanjiVG の SVG から、第4章の答えと問題文に出る文字の書き順データ（kanji-strokes.js）を作る。

娘側 ark214th/1stGradeMath の kanji_mahou/tools/build_strokes.py と同じ形式。
使い方:
  1. https://github.com/KanjiVG/kanjivg を取得する
  2. python3 chapter4/tools/build_strokes.py <kanjivg/kanji フォルダ> > chapter4/kanji-strokes.js
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
HTML = HERE.parent / 'index.html'

HEADER = """/*
 * 第4章の答え・問題文に出る文字の書き順データ（画ごとの SVG パス、座標は 109×109）。
 * chapter4/tools/build_strokes.py で KanjiVG から作成。手で編集しない。
 *
 * This file is derived from KanjiVG (http://kanjivg.tagaini.net)
 * Copyright (C) 2009-2026 Ulrich Apel and contributors.
 * Licensed under the Creative Commons Attribution-Share Alike 3.0 License.
 * https://creativecommons.org/licenses/by-sa/3.0/
 * Changes: coordinates rounded to 0.1, only the characters used in chapter 4.
 */
"""


def chars_in_chapter():
    html = HTML.read_text(encoding='utf-8')
    script = html.split('<script>', 1)[1].split('</script>', 1)[0]
    texts = re.findall(r'"?\b[ap]"?:"((?:[^"\\]|\\.)*)"', script)
    texts += re.findall(r'^"(.*)",?$', script, re.M)  # CLUE_P
    out = []
    for t in texts:
        for ch in re.sub(r'<[^>]*>', '', t):
            if ch not in out and not ch.isascii():
                out.append(ch)
    return out


def num(m):
    v = round(float(m.group(0)), 1)
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    if s in ('-0', '0'):
        # 「-0.01」が「0」になると、前の数字とくっついてしまうので空白で区切る
        return ' 0' if m.group(0).startswith('-') else '0'
    return s


def strokes(svg):
    found = re.findall(r'id="kvg:[0-9a-f]+-s(\d+)"[^>]*?\sd="([^"]+)"', svg)
    found.sort(key=lambda t: int(t[0]))
    return [re.sub(r'-?\d+(?:\.\d+)?', num, d) for _, d in found]


def main(folder):
    out = [HEADER, '(function (root) {', '  var S = {']
    missing = []
    for ch in chars_in_chapter():
        f = Path(folder) / ('%05x.svg' % ord(ch))
        if not f.exists():
            missing.append(ch)
            continue
        paths = strokes(f.read_text(encoding='utf-8'))
        if not paths:
            missing.append(ch)
            continue
        out.append('    %s: [%s],' % ('"%s"' % ch, ', '.join('"%s"' % p for p in paths)))
    out += ['  };', '  root.KANJI_STROKES = S;', "  if (typeof module !== 'undefined') module.exports = S;", '})(typeof window !== "undefined" ? window : globalThis);', '']
    sys.stdout.write('\n'.join(out))
    if missing:
        sys.stderr.write('KanjiVG にない文字（画面の文字で表示）: %s\n' % ''.join(missing))


if __name__ == '__main__':
    main(sys.argv[1])
