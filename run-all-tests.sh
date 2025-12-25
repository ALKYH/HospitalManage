#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
failed=0

while IFS= read -r pkg; do
  dir=$(dirname "$pkg")
  has_test=$(node -e "try{const p=require(process.argv[1]); console.log(p.scripts&&p.scripts.test? '1':'0')}catch(e){console.log('0')}" "$pkg")
  if [ "$has_test" = "1" ]; then
    echo "=== Running tests in $dir ==="
    if ! npm --prefix "$dir" test; then
      echo "Tests failed in $dir"
      failed=1
      break
    fi
  fi
done < <(find "$root" -name package.json)

if [ $failed -ne 0 ]; then
  echo "One or more test suites failed."
  exit 1
else
  echo "All discovered tests completed successfully"
  exit 0
fi
