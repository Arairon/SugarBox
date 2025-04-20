#!/bin/bash

set -e

ROOT=$(pwd)
TARGET="$ROOT/../dist"

mkdir -p "$TARGET"

cd ./popup

pnpm i
pnpm build

cp -r dist "$TARGET/popup"

cd "$ROOT"

cp manifest-dist.json "$TARGET/manifest.json"
cp page.js "$TARGET/page.js"
cp proxy.js "$TARGET/proxy.js"

mkdir -p "$TARGET/icons"

cp icons/48.png "$TARGET/icons/48.png"
cp icons/96.png "$TARGET/icons/96.png"
cp icons/128.png "$TARGET/icons/128.png"

echo "Done"