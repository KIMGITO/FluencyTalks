# Learning path, age and safeguarding

Decided by the owner on 2026-11-21. This replaces the evidence-based levels (`level_rules`, `level_evidence`, vouches), which have been removed.

## The path

- **25 discussion topics**, A1 to C2: A1 1–4, A2 5–8, B1 9–12, B2 13–17, C1 18–21, C2 22–25. Each has a title, a summary and 4 prompts (`path_topics`, seeded in `20261121100300_learning_path.sql`).
- **A conversation counts only as a 1:1 call** started from the path (`start_topic_call`), which tags the call with the learner's current topic (`topic_calls`). Both people must be in the call together for at least `min_call_minutes` (10).
- **Assessors** are a native speaker of the language, or someone who has passed a topic at least one CEFR band higher (`assessor_basis`). The learner can only call people they share an accepted chat with (`can_call`).
- **Assessment**: after the call, the partner scores 5 criteria from 1 to 5 (fluency, vocabulary, grammar, pronunciation, conversation) and can add a comment. The score is the sum × 4, as a percentage. They have `assess_window_days` (7) to do it. Each person assesses a topic once.
- **Passing**: at least `partners_needed` (5) different assessors, and a **cumulative** average of at least `pass_pct` (80%). The average covers every counting assessment for the topic, so a learner below 80% recovers by talking with more people. Passing unlocks the next topic.
- **Anti-abuse**: from B1 up, a topic gives rights, so an assessor's score counts only once their account is `settle_days` (7) old. The assessment is accepted at once and counts later, as the first-week rule requires. An hourly sweep (`sweep_settling_topics`) picks these up. Blocking an assessor never removes their assessment. Assessments from suspended or banned accounts don't count.
- **Learners see** the averages per criterion and the comments, but never who gave which score, so assessors can be honest.
- **Level** = the CEFR band of the highest topic passed in the language being learned (`evaluate_level`). B1+ rights (correcting others, teaching posts) follow it as before.
- **Placement**: a new path starts at the first topic of the band the learner declared at sign-up. The topics below are marked "skipped", not passed, so they give no level.
- **Migration of existing users**: every `verified_level` was reset to null, and paths were created at each user's declared band.

Settings live in `path_settings` (one row) and can be changed without a migration.

## Age and safeguarding

- **Everyone gives a full date of birth** (`profiles.birth_date`, set once with `set_birth_date(birth, minor_rules_version)`; a correction goes through support). It is never shown to others: the column isn't granted, and only `my_guardian_status` returns it, to the owner.
- **Rules about members under 16, accepted by everyone**: `set_birth_date` refuses (`minor_rules_required`) unless the member accepts the `minor_rules` consent document on the same screen, adults included: voice-only calls with under-16s; never asking them for photos, address, school, phone or social media, to meet, or to move off the platform; no sexual, violent or harmful content, gifts or money; breaches close the account and suspected abuse or grooming is reported to the police and child-protection authorities. The text on screen is the stored wording word for word (`LEGAL_WORDING` in src/lib/legalVersions.ts, checked by tests/unit/legalWording.test.ts).
- **Under 12**: refused (`too_young`) with nothing stored, and the app deletes the sign-in account.
- **12 to 15**: the account can finish setup, but `check_request` refuses every other API call (`age_gate`, `age_gate_paths`) until a parent or guardian agrees. The child gives the guardian's full name, their relationship and their email. The `guardian-consent` edge function emails the guardian a link; the token travels only in that email, and the database stores only its hash. On the public page `/guardian`, the guardian confirms their name, that they are 18+ and a parent or legal guardian, and agrees or refuses. They can withdraw later from the same link. **A refusal or a withdrawal deletes the child's account at once**: `svc_guardian_decide` returns `delete_user`, and the edge function deletes the auth user and their photos (`_shared/delete-user.ts`). If deletion fails, the account stays shut (`guardian_declined`) and the error is logged. A declined child can't send a new request.
- **Proof**: agreeing writes a `consents` row of kind `guardian` (hash-chained in `consent_ledger`, keyed to the child's email hash) and a second ledger entry, `guardian_identity`, keyed to the guardian's email hash. Refusing and withdrawing append `ended` entries keyed to the guardian's email hash, so the reason for the deletion stays provable after the account is gone.
- **Calls with under-16s are voice only, enforced by the media token**: under-16s may call anyone they share an accepted chat with, adults included, so adult native speakers and advanced learners can assess them. When anyone in the call is under 16, `claim_call_join` returns `voice_only` and `call-token` signs a token that can publish the microphone only; the app never starts the camera (`call_voice_only_with`). Anything but an explicit `false` counts as voice only.
- **Separation, enforced in the database**: An adult's first message to an under-16 is always a request the child chooses to accept (`start_conversation`). Adults don't see under-16s in search, the home feed or match counts (`minor_visible`). Under-16s can find and message adults.
- **Existing accounts** without a date of birth see a one-time screen asking for it (`AgeGateRoute`) before the app opens.
- **Turning 16** lifts the restrictions automatically, because age is computed from the birth date on every check.

### Topics suit 12 to 15 year olds

Minors and adults take the same 25 topics, so none deal with politics, crime, punishment or adult themes, and no prompt asks for a home address, a school or a daily timetable (topic 5 uses an imagined town for directions). Topics 19, 23 and 24 were replaced: *Science and discovery*, *Rules and fairness*, *Opportunity and community*.

## Open items (owner)

1. Secrets for `guardian-consent`: `RESEND_API_KEY`, `GUARDIAN_EMAIL_FROM` (a domain verified with Resend) and `PUBLIC_SITE_URL`.
2. Legal text: the Terms and Privacy Policy still say "16 or older". New versions are needed (age 12, guardian consent, date of birth, assessments, LiveKit), each with a `consent_documents` row (`npm run check:legal`). Have them reviewed under Law 91/2025 and Decree 356/2025.
3. Accounts whose guardian declines are deleted at once. Accounts that stay pending still keep their data: decide a retention period (for example, delete after 30 days) and add it to docs/DATA_RETENTION.md.
4. The `minor_rules` wording promises reports to the police and child-protection authorities. Have it reviewed (Law on Children 2016 and the data-protection texts) and set up who sends those reports.

## Deploy order

1. Database: `supabase db push` (applies `20261121100300_learning_path.sql` and `20261121100400_age_and_guardians.sql`).
2. Functions: `supabase functions deploy guardian-consent`, and set the secrets above.
3. Website: `npm run deploy`.
