#!/bin/bash
# Rebuild the distributable source zip for the user's laptop
set -e
cd /home/z/my-project
OUT=download/hcm-lite-source.zip
rm -f "$OUT"
zip -qr "$OUT" \
  src public scripts \
  package.json bun.lock jsconfig.json next.config.mjs postcss.config.mjs eslint.config.mjs components.json \
  .env.local PATCH.sql \
  -x "src/app/api/auth/register/node_modules/*" \
  -x "*.log" -x "node_modules/*" -x ".next/*" -x "dev.log" -x "server.log"
echo "ZIP BUILT:"
unzip -l "$OUT" | tail -3
echo "--- key new files present:"
unzip -l "$OUT" | grep -E "auth/register|auth/join-codes|RoleSignupForm|SessionBanner|signup/hr|signup/employee|joinCodes|restore-owner|e2e-signup-portals" | awk '{print "  " $4}'
