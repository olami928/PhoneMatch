#!/bin/bash
# check-for-secrets.sh — refuse to let a Supabase secret reach the repo or the browser.
#
# WHY THIS EXISTS
# The Supabase secret key (sb_secret_..., formerly "service_role") bypasses row
# level security completely. Anyone holding it can read every order, every
# customer name, email and shipping address. It is the one value in this project
# that can leak the whole customer list.
#
# Two things can leak it:
#   1. committing it to git, where it stays in the history forever
#   2. shipping it in the frontend bundle, where every visitor can read it
#
# So we check for both, and we check the BUILD OUTPUT too, not just the source.
# A key that is only found leaking after deploy is already too late.
#
# Run it: ./scripts/check-for-secrets.sh
# Wire it into CI before anyone deploys.

set -uo pipefail
cd "$(dirname "$0")/.."

FAIL=0
note() { printf '  %s\n' "$1"; }
bad()  { printf '  FAIL %s\n' "$1"; FAIL=1; }

echo "Secret leak check"

# --- 1. tracked files must never contain key-shaped values -----------------
echo
echo "1. scanning git-tracked files for key material"
# Match the real prefixes plus the long-lived JWT form of the old keys.
PATTERN='sb_secret_[A-Za-z0-9_-]{16,}|sb_publishable_[A-Za-z0-9_-]{16,}|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9[A-Za-z0-9_.-]{40,}'

HITS=$(git ls-files -z | xargs -0 grep -lE "$PATTERN" 2>/dev/null | grep -v '^scripts/check-for-secrets.sh$')
if [ -n "$HITS" ]; then
  bad "key-shaped value found in tracked file(s):"
  echo "$HITS" | sed 's/^/       /'
else
  note "OK  no key material in tracked files"
fi

# --- 2. the frontend must not reference any secret -------------------------
echo
echo "2. checking the frontend for secret references"
FE_HITS=$(grep -rlE 'SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|sb_secret_' frontend/src frontend/.env* 2>/dev/null)
if [ -n "$FE_HITS" ]; then
  bad "the frontend references a secret key: $FE_HITS"
  note "the browser must never hold this key. Use the publishable key plus row"
  note "level security for anything the frontend does directly."
else
  note "OK  frontend references no secret key"
fi

# --- 3. the built bundle must not contain it -------------------------------
# The one that actually matters. Next.js inlines NEXT_PUBLIC_* into client JS,
# so a key pasted into a .env with the wrong prefix ships to every visitor.
echo
echo "3. scanning the built frontend bundle"
if [ -d frontend/.next ]; then
  BUNDLE_HITS=$(grep -rlE "$PATTERN" frontend/.next/static frontend/.next/server 2>/dev/null | head -5)
  if [ -n "$BUNDLE_HITS" ]; then
    bad "key material found in the build output:"
    echo "$BUNDLE_HITS" | sed 's/^/       /'
  else
    note "OK  no key material in the build output"
  fi
else
  note "SKIP no build found (run npm run build to check this)"
fi

# --- 4. the secret key must not be inside a NEXT_PUBLIC_ variable ----------
echo
echo "4. checking for keys hidden in NEXT_PUBLIC_ variables"
PUB_HITS=$(grep -rhnE 'NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE_ROLE)' frontend/.env* 2>/dev/null)
if [ -n "$PUB_HITS" ]; then
  bad "a secret is behind a NEXT_PUBLIC_ prefix, so it would be inlined into the browser bundle"
  echo "$PUB_HITS" | sed 's/^/       /'
else
  note "OK  no secret behind a NEXT_PUBLIC_ prefix"
fi

echo
if [ "$FAIL" -eq 0 ]; then
  echo "PASS  no secret leak detected"
  exit 0
fi
echo "FAILED  fix the above before deploying"
exit 1
