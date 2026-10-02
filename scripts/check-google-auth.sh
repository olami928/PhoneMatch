#!/usr/bin/env bash
# check-google-auth.sh — is Google sign-in actually working?
#
# WHY: Google sign-in needs two things set in the Supabase dashboard (the provider
# switch and the redirect URL). Both are invisible in the code, so it is easy to
# believe it is working when it is not. This asks Supabase directly and reports
# exactly what is missing.
#
# Usage:  ./scripts/check-google-auth.sh
#
# It reads the keys from backend/.env (git-ignored, never committed). It prints
# no secret values, only whether each piece is present.

set -u
cd "$(dirname "$0")/.."

ENV_FILE="backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Cannot check: $ENV_FILE not found."
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_PUBLISHABLE_KEY:-}" ]; then
  echo "Cannot check: SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY missing from $ENV_FILE."
  exit 1
fi

echo "1. Is the Google provider switched on?"
GOOGLE_STATE=$(curl -sS -m 30 "$SUPABASE_URL/auth/v1/settings" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  | grep -o '"google": *\(true\|false\)' | head -1 | awk '{print $2}')

if [ "$GOOGLE_STATE" = "true" ]; then
  echo "   OK - Google provider is enabled."
else
  echo "   NOT ENABLED."
  echo "   Fix: Supabase -> Authentication -> Providers -> Google -> switch ON,"
  echo "         then paste the Google Client ID and Client Secret."
fi

echo
echo "2. Can a redirect be started from this machine?"
# Supabase answers 400 with "Unsupported provider" when the provider is off, and a
# different 400 when the redirect URL is not in the allow list. Either outcome is
# fine for a local check; a 200/302 means the request was accepted.
HTTP=$(curl -sS -m 30 -o /dev/null -w '%{http_code}' -G "$SUPABASE_URL/auth/v1/authorize" \
  --data-urlencode "provider=google" \
  --data-urlencode "redirect_to=${1:-http://localhost:3000/auth/callback}")

if [ "$HTTP" = "200" ] || [ "$HTTP" = "302" ]; then
  echo "   OK - Supabase accepted the redirect request (HTTP $HTTP)."
elif [ "$HTTP" = "400" ]; then
  echo "   HTTP 400 - either the provider is still off, or this redirect URL is"
  echo "   not in the allow list. Supabase says exactly which in the response body."
  echo "   Fix: Supabase -> Authentication -> URL Configuration -> Redirect URLs,"
  echo "         and add the address printed above."
else
  echo "   Unexpected HTTP $HTTP. Check the network or the Supabase URL."
fi

echo
echo "3. Localhost sign-in still needed?"
echo "   Add http://localhost:3000/auth/callback to the Redirect URLs as well,"
echo "   otherwise Google sign-in will not work on your own machine."

echo
echo "4. First admin"
echo "   Sign in once, then in Supabase -> Table editor -> profiles, set"
echo "   role = 'admin' for that row. Admin cannot be self-assigned by design."