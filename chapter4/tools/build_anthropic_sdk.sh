#!/bin/sh
# 自動採点用の Anthropic SDK を、ブラウザでそのまま読める1ファイル（vendor/anthropic-sdk.js）にまとめる。
# 使い方: 空のフォルダで sh <このファイル> <出力先 chapter4/vendor>
set -e
VERSION=0.132.1
npm init -y >/dev/null
npm install --silent "@anthropic-ai/sdk@$VERSION" esbuild@0.25.10
printf 'export { default } from "@anthropic-ai/sdk";\n' > entry.mjs
npx esbuild entry.mjs --bundle --format=esm --platform=browser --minify --legal-comments=none --outfile="$1/anthropic-sdk.js"
cp node_modules/@anthropic-ai/sdk/LICENSE "$1/LICENSE-anthropic-sdk.txt"
