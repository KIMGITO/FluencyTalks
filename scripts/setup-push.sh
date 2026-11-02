#!/usr/bin/env bash
# One-time web push setup for the LINKED Supabase project (supabase/.temp/project-ref). Touches production:
#   1. generates a VAPID key pair and a webhook secret,
#   2. sets the send-push function's secrets and redeploys it,
#   3. points the database at the function (push_settings row),
#   4. prints the public key for VITE_VAPID_PUBLIC_KEY (.env locally, and your hosting provider's env).
# Run it once. Running it again rotates the keys, and every device must turn push on again.
set -euo pipefail
cd "$(dirname "$0")/.."
SUBJECT="${1:?usage: scripts/setup-push.sh mailto:you@example.com}"
REF=$(cat supabase/.temp/project-ref)

keys=$(npx --yes web-push@3.6.7 generate-vapid-keys --json)
PUB=$(node -e "console.log(JSON.parse(process.argv[1]).publicKey)" "$keys")
PRIV=$(node -e "console.log(JSON.parse(process.argv[1]).privateKey)" "$keys")
SECRET=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")

supabase secrets set VAPID_PUBLIC_KEY="$PUB" VAPID_PRIVATE_KEY="$PRIV" VAPID_SUBJECT="$SUBJECT" PUSH_WEBHOOK_SECRET="$SECRET"
supabase functions deploy send-push --no-verify-jwt

URL="https://$REF.supabase.co/functions/v1/send-push"
cat > "${TMPDIR:-/tmp}/push_settings.sql" <<SQL
insert into public.push_settings (id, function_url, webhook_secret) values (true, '$URL', '$SECRET')
on conflict (id) do update set function_url = excluded.function_url, webhook_secret = excluded.webhook_secret;
SQL
supabase db query --linked -f "${TMPDIR:-/tmp}/push_settings.sql" 2>/dev/null \
  || { echo; echo "Couldn't write push_settings automatically. Run this in the SQL editor:"; cat "${TMPDIR:-/tmp}/push_settings.sql"; }
rm -f "${TMPDIR:-/tmp}/push_settings.sql"

echo
echo "Done. Add this to .env and to the hosting provider's environment, then rebuild:"
echo "VITE_VAPID_PUBLIC_KEY=$PUB"
