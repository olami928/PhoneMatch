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
# TWO patterns, because the two Supabase keys are NOT equally dangerous:
#
#   SECRET_PATTERN     sb_secret_... bypasses row level security completely.
#                      One occurrence anywhere is a serious leak. Hard failure.
#   PUBLISHABLE_PATTERN sb_publishable_... is DESIGNED to be public. Supabase
#                      publishes it in the browser bundle and its power is
#                      limited by row level security policies. A frontend that
#                      calls Supabase Auth DIRECTLY (which sign-in does) cannot
#                      work without it, so flagging it as a leak would block
#                      correct code. Reported for visibility, never a failure.
#
# The JWT form of the retired `anon`/`service_role` keys still fails hard.
SECRET_PATTERN='sb_secret_[A-Za-z0-9_-]{16,}|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9[A-Za-z0-9_.-]{40,}'
PUBLISHABLE_PATTERN='sb_publishable_[A-Za-z0-9_-]{16,}'
PATTERN="$SECRET_PATTERN|$PUBLISHABLE_PATTERN"

HITS=$(git ls-files -z | xargs -0 grep -lE "$SECRET_PATTERN" 2>/dev/null | grep -v '^scripts/check-for-secrets.sh$')
if [ -n "$HITS" ]; then
  bad "a SECRET key was found in tracked file(s):"
  echo "$HITS" | sed 's/^/       /'
  note "sb_secret_ bypasses row level security. Rotate it if it was ever committed."
else
  note "OK  no secret key in tracked files"
fi

# The publishable key is allowed, but say so, so its presence is a decision
# someone made rather than something that quietly slipped in.
PUB_TRACKED=$(git ls-files -z | xargs -0 grep -lE "$PUBLISHABLE_PATTERN" 2>/dev/null | grep -v '^scripts/check-for-secrets.sh$')
if [ -n "$PUB_TRACKED" ]; then
  note "note publishable key present (safe by design, RLS-bounded):"
  echo "$PUB_TRACKED" | sed 's/^/       /'
  note "     it should only ever be the sb_publishable_ value, never sb_secret_"
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
  # The SECRET key in the bundle is the disaster: it would let any visitor read
  # every order and customer address. This must fail the build.
  SECRET_HITS=$(grep -rlE "$SECRET_PATTERN" frontend/.next/static frontend/.next/server 2>/dev/null | head -5)
  if [ -n "$SECRET_HITS" ]; then
    bad "THE SECRET KEY IS IN THE BUILD OUTPUT. Anyone can read every order:"
    echo "$SECRET_HITS" | sed 's/^/       /'
    note "Remove it, then rebuild. If it was ever deployed, rotate it in Supabase."
  else
    note "OK  the secret key is not in the build output"
  fi

  # The publishable key IS expected in the bundle once sign-in exists, because
  # Next.js inlines NEXT_PUBLIC_* and the browser must call Supabase Auth. It is
  # reported so it is a conscious decision, not a surprise.
  PUB_HITS=$(grep -rlE "$PUBLISHABLE_PATTERN" frontend/.next/static frontend/.next/server 2>/dev/null | head -3)
  if [ -n "$PUB_HITS" ]; then
    note "note publishable key is in the bundle (expected; it is RLS-bounded):"
    echo "$PUB_HITS" | sed 's/^/       /'
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
