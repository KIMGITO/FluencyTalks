// The text a member ticks must be the text the consent ledger proves they agreed to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LEGAL_VERSIONS, LEGAL_WORDING } from '../../src/lib/legalVersions.ts';

const sql = fs.readFileSync('supabase/migrations/20261121100400_age_and_guardians.sql', 'utf8');

for (const kind of Object.keys(LEGAL_WORDING) as (keyof typeof LEGAL_WORDING)[]) {
  test(`${kind} wording matches its consent_documents row`, () => {
    const row = new RegExp(`\\('${kind}', '${LEGAL_VERSIONS[kind]}', \\$w\\$([^$]*)\\$w\\$`).exec(sql);
    assert.ok(row, `no consent_documents row for ${kind} v${LEGAL_VERSIONS[kind]}`);
    assert.equal(row[1], LEGAL_WORDING[kind]);
  });
}
