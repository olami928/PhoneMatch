#!/usr/bin/env bash
# deploy-login.sh — ONE command to let the agent deploy for you.
#
# WHAT THIS DOES: opens a browser login for Vercel, Netlify and Render. Each one
# prints a URL; click/approve it. That is the only manual step in the whole
# deploy, because hosting providers will not accept a deploy from an
# unauthenticated machine. Once this is done, the agent runs every build,
# environment variable and deployment itself.
#
# SAFE: these logins are stored by the CLIs in your home folder
# (~/.local/share/com.vercel.cli and ~/.netlify). They are NOT written into the
# repository, so they cannot be committed to GitHub.

set -u

cd "$(dirname "$0")"

echo "=============================================="
echo " 1/3  Vercel  (the frontend)"
echo "=============================================="
npx --yes vercel@latest login
echo ">>> open the URL it printed and approve in your browser"
echo
echo ">>> When done, press Enter to continue to Netlify."
read -r

echo "=============================================="
echo " 2/3  Netlify  (the backend)"
echo "=============================================="
npx --yes netlify-cli@latest login
echo ">>> open the URL it printed and approve in your browser"
echo
echo ">>> When done, press Enter to continue to Render."
read -r

echo "=============================================="
echo " 3/3  Render  (the model service)"
echo "=============================================="
echo "Render is not needed if you deploy the model service yourself."
echo "Press Enter to skip, or follow https://render.com/docs/cli to install it."
read -r

echo
echo "=============================================="
echo " All done. Tell the agent 'logged in' and the"
echo " deploys will be run automatically."
echo "=============================================="