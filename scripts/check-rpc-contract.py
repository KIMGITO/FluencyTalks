#!/usr/bin/env python3
"""Fails if the app calls a database function that does not exist, or passes a parameter name the
function does not have. This is exactly the class of bug that breaks onboarding after a migration
rewrite ("Could not find the function ... in the schema cache").

usage: check-rpc-contract.py <database url>
"""
import re, subprocess, sys, pathlib

url = sys.argv[1]
rows = subprocess.run(['psql', url, '-At', '-F', '|', '-c',
    "select p.proname, coalesce(array_to_string(p.proargnames, ','), '') from pg_proc p "
    "join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f'"],
    check=True, capture_output=True, text=True).stdout.strip().splitlines()
db = {}
for r in rows:
    name, args = r.split('|', 1)
    db.setdefault(name, set()).update(a for a in args.split(',') if a)

call = re.compile(r"""rpc(?:<[^>]*>)?\(\s*['"](\w+)['"]\s*(?:,\s*\{([^}]*)\})?""", re.S)
problems = []
for path in sorted(pathlib.Path('src').rglob('*.ts*')):
    text = path.read_text()
    for m in call.finditer(text):
        fn, body = m.group(1), m.group(2) or ''
        line = text.count('\n', 0, m.start()) + 1
        if fn not in db:
            problems.append(f"{path}:{line}  rpc('{fn}') does not exist in the database")
            continue
        for key in re.findall(r'\b(p_\w+)\s*:', body):
            if key not in db[fn]:
                problems.append(f"{path}:{line}  rpc('{fn}') sends '{key}' but the function only has: {', '.join(sorted(db[fn])) or '(no parameters)'}")
if problems:
    print('RPC CONTRACT BROKEN:'); print('\n'.join('  ' + p for p in problems)); sys.exit(1)
print(f'RPC contract ok: every rpc() call in src/ matches a database function and its parameter names')
