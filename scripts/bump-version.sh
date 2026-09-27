#!/bin/sh
# Stamps a new ?v= version on the CSS/JS references so browsers and home-screen
# apps fetch fresh files after a deploy instead of reusing cached ones.
# Run before committing a change: ./scripts/bump-version.sh
set -e
cd "$(dirname "$0")/.."
v=$(date +%Y%m%d%H%M%S)
sed -i.bak -E \
  -e "s#href=\"style\.css(\?v=[0-9]+)?\"#href=\"style.css?v=$v\"#" \
  -e "s#src=\"src/ui\.js(\?v=[0-9]+)?\"#src=\"src/ui.js?v=$v\"#" \
  -e "s#href=\"src/(api|score)\.js(\?v=[0-9]+)?\"#href=\"src/\1.js?v=$v\"#" \
  index.html
sed -i.bak -E "s#from '\./(api|score)\.js(\?v=[0-9]+)?'#from './\1.js?v=$v'#" src/ui.js
rm -f index.html.bak src/ui.js.bak
echo "Asset version: $v"
