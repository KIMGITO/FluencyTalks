#!/usr/bin/env bash
# Builds a THROWAWAY database, applies every migration + the seed, checks the app/database contract
# and replays the app's flows. Run it before every push that touches supabase/ or src/services/.
#
#   ADMIN_URL=postgresql://postgres:postgres@localhost:5432/postgres scripts/test-db.sh
#
# Needs: psql, python3, and a Postgres 15+ you can create databases on. Never point it at a real project.
set -euo pipefail
cd "$(dirname "$0")/.."
export PGOPTIONS="-c client_min_messages=warning"
ADMIN_URL="${ADMIN_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"
DB="ft_test_$$"
BASE="${ADMIN_URL%/*}"                       # everything before the database name
URL="$BASE/$DB"
cleanup() { psql "$ADMIN_URL" -q -c "drop database if exists $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql "$ADMIN_URL" -q -c "create database $DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/stubs.sql >/dev/null 2>&1

echo "== migrations (in version order)"
for f in $(ls supabase/migrations/*.sql | sort); do
  echo "   $(basename "$f")"
  psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done
psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/seed.sql >/dev/null
# Hosted Supabase gives these to the API roles automatically; a plain Postgres does not.
psql "$URL" -q -c "grant select,insert,update,delete on all tables in schema public to authenticated; grant select on all tables in schema public to anon; grant usage on all sequences in schema public to authenticated" >/dev/null

echo "== app/database contract"
python3 scripts/check-rpc-contract.py "$URL"

echo "== app flows"
if ! out=$(psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/app_flow.sql 2>&1); then
  echo "$out" | grep -v '^\s*$' | grep -vE '^[- +]*$|row\)|expect_error|as_user' | tail -12
  echo "APP FLOW FAILED"; exit 1
fi
if echo "$out" | grep -q "ALL APP-FLOW CHECKS PASSED"; then echo "   ALL APP-FLOW CHECKS PASSED"; else echo "$out" | tail -12; echo "APP FLOW DID NOT REPORT SUCCESS"; exit 1; fi
echo "OK: database matches the app"
