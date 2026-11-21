# Video calling: Phase 0 audit and plan

Audit of the repository as of 21 November 2026, made before any video-calling code. It follows [the implementation brief](the-fluency-talks-video-calling-implementation%20(1).md). Nothing has been changed yet.

## 1. What exists

### Application
| Area | Finding |
|---|---|
| Stack | React 18, Vite 5, TypeScript, React Router 6 (`src/router/index.tsx`), Zustand, Tailwind fed by `src/theme/tokens.ts`. npm. |
| Scripts | `check` (tsc + vite build), `build` (also SSR prerender), `test:unit`, `test:db`, `test:auth`, `test:security`, `test:admin`, `check:seo`, `check:legal`, `deploy` (`wrangler deploy`). |
| CI | `.github/workflows/check.yml`: tsc, test:auth, build, check:seo, check:legal, and `scripts/test-db.sh` on Postgres 16. `test:unit` and `test:security` are manual only. |
| Hosting | Cloudflare **Worker** `thefluencytalks` with static assets (`wrangler.toml`). The Worker runs only for `/`, `/faq`, `/blog*`, `/sitemap.xml`, `/llms.txt`. App routes are served as `dist/app.html`. `vercel.json` is unused. |
| Headers | `public/_headers` sets no CSP and no `Permissions-Policy`, so camera, microphone and `wss://` to LiveKit are not blocked. HTTPS is in place in production. |
| UI parts | `src/components/ui` (Button, Modal, ConfirmDialog, Avatar, Spinner, ErrorState, EmptyState, Toaster...). Icons are `lucide-react`. Design rules are in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md): token colours only, and a reduced spacing scale where some classes silently generate nothing. |
| Bundle | Main chunk is about 1 MB. The LiveKit SDK must be lazy-loaded with the call screen, the same way `BlogEditor` is. |
| Data access | Pages call services, and services call `rpc()` in `src/lib/api.ts`, which maps errors to safe `UserError` text through `src/lib/refusals.ts`. Supabase is created only in `src/lib/supabase.ts`. |

### Identity and safety
| Area | Finding |
|---|---|
| Auth | Supabase Auth with `auth.uid()` in every definer function. `assert_active()` refuses signed-out users and users who aren't `status = 'active'`. |
| Profiles | `profiles` (id, username, display_name, avatar_url are the only columns readable directly). `role` and `status` are protected by a trigger. |
| Blocks | `blocks` table, with `is_blocked_between(a, b)` checked in both directions in every read and write. |
| Staff | `refuse_staff_learner_action()` trigger: staff can't message or be messaged by learners. |
| Reports | `report_user(p_target, p_reason, p_details, p_conversation)`, with `ReportDialog` and the Block action in `UserMenu`. |
| Restrictions | `user_restrictions` covers only `new_posts`, so it doesn't apply to calls. |
| Pause and limits | `check_request()` runs before every PostgREST request and handles the pause switch and the per-path `rate_limit_rules`. Edge Functions go through the same check with `_shared/edge-gate.ts`. Failed calls aren't counted, because the counter rolls back with the error. |

### Messaging
- **Direct only.** `conversations.direct_key` is unique per pair, and `conversation_members` holds two rows. There is no group messaging, so a group call can't hang off a group chat.
- A member's status is `active`, `request` or `ignored`. A non-follower's first chat arrives as a request that has to be accepted.
- `can_access_conversation()` means the caller is a member and nobody in the chat has blocked them.
- Realtime uses postgres_changes on messages, members and notifications, plus private broadcast channels `ft-chat:<id>` that RLS checks against membership (`usePresence.ts`).

### Notifications
- The `notifications` table has a check-constrained `type` list. `notify_event(..., p_key)` deduplicates on `(user_id, dedupe_key)`, respects per-category preferences, and skips blocked actors.
- A trigger calls the `send-push` Edge Function through `pg_net` with a shared secret. That function claims the row (`push_claimed_at`), which makes a retry harmless.
- `public/sw.js` shows a push only when no app tab is focused, which already prevents duplicate realtime and push alerts. Clicking it opens `data.url`.
- `src/lib/push.ts` handles the states: unconfigured, unsupported, needs-install (iOS outside the Home Screen), blocked, off and on. It is enabled from `PushToggle`, and only on a tap.
- Push can reach a closed browser only where the browser or OS keeps a push service running. iOS needs the app installed to the Home Screen. Push is not a ringing phone call.

### Backend
- Migrations are one file per area (`supabase/migrations/2026110310xxxx_*.sql`). These are **applied on hosted**, so calling gets a **new file**.
- New tables start closed: they need explicit grants and RLS. Every function needs `revoke ... from public, anon, authenticated, service_role` followed by grants. `supabase/tests/privileges.sql` enforces both.
- Edge Functions: `delete-account` and `unsplash-proxy` (user JWT and edgeGate), `send-push` and `archive-run` (`verify_jwt = false` with a shared secret). Secrets are set with `supabase secrets set`, never with `VITE_`.
- Logs: `app_logs` (level, source, message, user_id), retained 13 months under Decree 333.
- pg_cron is optional. Expiry already falls back to lazy sweeps inside RPCs (`refund_expired_bounties`), and calls will use the same pattern.

### Legal (Vietnamese regime, see [LEGAL_COMPLIANCE.md](LEGAL_COMPLIANCE.md))
- The privacy policy lists its outside processors. LiveKit would be **a new processor and a new cross-border transfer** (IP addresses and media in transit). That needs privacy **v4**, a `consent_documents` row and `check:legal`, and the transfer dossier has to cover it.
- The public content rules ([DESIGN_SYSTEM.md](DESIGN_SYSTEM.md#content-rules)) removed claims of "voice or video". Marketing text stays as it is until the feature ships.

### Baseline checks (unchanged tree, 21 Nov 2026, local)
| Command | Result |
|---|---|
| `npx tsc --noEmit` | Pass |
| `npm run test:unit` | 69 of 69 pass |
| `scripts/test-db.sh` (local stack via psql shim, safeupdate on) | ALL APP-FLOW CHECKS PASSED, RPC contract ok |
| `npm run build` | Pass, 48 URLs in the sitemap |

## 2. Reuse

`assert_active`, `is_blocked_between`, the staff-refusal trigger, `notify_event` with its dedupe key, `send-push` and `sw.js`, `rate_limit_rules` and `check_request`, `edgeGate`, `app_logs`, `rpc()` and refusals, `ConfirmDialog`, `Modal`, `Avatar`, `Toaster`, `ErrorState`, `ReportDialog`, `UserMenu` and the `useOnline` hook.

## 3. Gaps and risks

| # | Gap or risk | Mitigation |
|---|---|---|
| R1 | No group conversations exist | The call is its own entity with no conversation FK. A direct call can be *started from* a chat, but this release stores no origin. |
| R2 | In a group call, a blocked pair could end up together | When inviting, check blocks between the invitee and **every** current or pending participant, not just the inviter. |
| R3 | Failed calls aren't rate-limited (the counter rolls back) | Join and invite return structured refusals for expected denials instead of raising, so the counter commits. A per-user failed-join counter lives inside the function. |
| R4 | pg_cron may be off | Ringing and invitation expiry are swept lazily in every call RPC, plus a cron job where it's available. |
| R5 | No staging Supabase project. `.env` points at hosted | Develop and test on the **local stack** and a **separate LiveKit dev project**. Nothing touches hosted until you approve. |
| R6 | No browser test suite | `playwright-core` and Chrome are present. Chrome's fake-media flags allow automated 2 to 7-participant runs against the LiveKit dev project. Real devices and networks are still manual. |
| R7 | Bundle size | The call screen is lazy-loaded. |
| R8 | Legal | Privacy v4 and an update to the transfer dossier before production (owner). |
| R9 | Latest LiveKit releases are under 2 weeks old (client 2.25.0, components-react 2.9.26, server-sdk 2.20.1, all 19 to 20 Nov) | Pin the newest versions published at least 2 weeks before install. The server SDK loads in Deno as `npm:livekit-server-sdk@<pinned>`. Its compatibility with Deno is confirmed in Phase 2 before relying on it. |
| R10 | `UserMenu` uses the native `confirm()` | Existing behaviour, out of scope. The call UI uses `ConfirmDialog`. |

## 4. Proposed design

### Eligibility (proposed, needs approval)
A user may call or invite someone only when all of these hold:
- They share a direct conversation in which **both members are `active`**, meaning any message request was accepted.
- Both accounts are active.
- Neither is staff.
- There is no block in either direction, including with the other participants in the call (R2).
- The invitee isn't the caller.

Refusals use the existing generic `user_unavailable` wording, so they don't reveal whether an account exists.

### Data model: new migration `20261121100000_calls.sql`
- **`call_settings`** is a single row, like `app_status`. It is the one place for configuration:
  - `calls_enabled`, the kill switch
  - `max_participants` = 6
  - `ring_seconds` = 45
  - `token_ttl_seconds` = 600
  - `empty_grace_seconds` = 60
- **`calls`** holds:
  - `id`
  - `initiated_by` (`on delete set null`)
  - `host_id`
  - `status` (`ringing`, `active`, `ended`, `cancelled`, `expired`)
  - `provider` (`livekit`)
  - `provider_room` (an opaque random `ftc_<uuid>`, not derived from the call id)
  - `max_participants`, copied from settings
  - `created_at`, `started_at`, `ended_at`, `end_reason`
  - `call_type` is derived from the participant count rather than stored, which avoids drift.
- **`call_participants`** holds:
  - `id`, `call_id`, `user_id`
  - `role` (`host`, `participant`)
  - `invitation_status` (`pending`, `accepted`, `declined`, `cancelled`, `expired`)
  - `presence` (`invited`, `joining`, `joined`, `left`, `removed`)
  - `invited_by`, `invited_at`, `expires_at`, `responded_at`, `joined_at`, `left_at`
  - It is unique on `(call_id, user_id)` and indexed on `(user_id, invitation_status)`.
- **`call_webhook_events`** has `event_id` as its primary key and `received_at`. It is used for idempotency and is service-role only.
- **RLS:** select only, and only for a participant of the call who isn't blocked by anyone in it. No client insert or update grants. All changes go through definer functions, which take `select ... for update` on the `calls` row to serialise invites and joins.
- **Capacity** = rows with `invitation_status in ('pending','accepted')` and `presence <> 'removed'`, checked under that lock.
- **Notifications:** add the types `call_incoming` and `call_missed`, with dedupe keys `call:<id>:<kind>`.
- **Realtime:** add `call_participants` and `calls` to the publication, so RLS limits events to participants.
- **Retention:** proposed to follow messages, kept while the account exists. Participant rows cascade on account deletion, and a call row is removed once it has no participants left. This needs approval (D4).

### Server operations
**Database RPCs** (signed in, rate-limited through `rate_limit_rules`):
- `start_call(p_invitees uuid[])`
- `invite_to_call(p_call, p_users uuid[])`, host only
- `respond_call_invite(p_call, p_accept)`
- `cancel_call_invite(p_call, p_user)`
- `leave_call(p_call)`
- `list_call_history(...)`
- `get_call(p_call)`

**`claim_call_join(p_call)`** is granted only to the Edge Function's user-context call. It checks:
- identity, call status, invitation, expiry and blocks
- capacity under the lock
- the failed-join counter

It then marks the participant as `joining` and returns `provider_room` and the identity (the user's UUID).

**Edge Function `call-token`** (user JWT and edgeGate):
1. Calls `claim_call_join` *as the user*.
2. Signs a LiveKit token with these grants:
   - `roomJoin` for that one room only
   - `canSubscribe`
   - `canPublish` limited to the camera and microphone sources
   - no `roomCreate`, `roomAdmin`, data publishing or recording
   - TTL from settings
3. Returns `{ token, url }`. The token is never logged or stored.

**Edge Function `call-control`** (user JWT): end for everyone, and remove a participant. It checks the host role with an RPC, then uses LiveKit `RoomServiceClient` (`deleteRoom`, `removeParticipant`), so removal takes effect in the media layer as well as in the database.

**Edge Function `livekit-webhook`** (`verify_jwt = false`) verifies the signature with `WebhookReceiver` and deduplicates by event id. It applies `participant_joined`, `participant_left` and `room_finished` as the authoritative attendance record. What the client reports is only a hint.

**Provider boundary:** `supabase/functions/_shared/media-provider.ts` (token, end room, remove participant, verify webhook) on the server, and `src/services/calls/media.ts` in the browser. Nothing else imports LiveKit.

### Lifecycle policy (proposed)
| Event | Effect |
|---|---|
| Nobody joins within `ring_seconds` | Pending invitations become `expired`, the call becomes `expired`, and `call_missed` is sent |
| Host leaves or drops while others remain | Host passes to the earliest-joined remaining participant |
| The room is empty for `empty_grace_seconds`, or LiveKit sends `room_finished` | The call becomes `ended` |
| Host chooses "End for everyone" | Confirmation, then `call-control` deletes the room and finalises every row |
| Refresh | `claim_call_join` is idempotent for the same user, so no duplicate rows. LiveKit replaces a duplicate identity. |

### Frontend
- Add a call button to the `ChatThread` header (direct chats where both members are active) and next to `MessageButton` on `UserProfile`.
- Add a lazy route `/call/:id` inside `AppShell` with these screens:
  - pre-call preview, where devices are requested only when you tap
  - ringing and connecting
  - the grid and the participant list
  - controls for mute, camera, devices, invite, leave, and end for everyone
  - reconnecting, ended and failed-with-retry states
- An incoming-call banner, mounted once in `AppShell`, fed by Realtime on your own `call_participants` rows.
- Recommended SDK approach: `livekit-client` plus hooks from `@livekit/components-react`, styled with the project's tokens and without the LiveKit default stylesheet. All tracks are stopped on leave, end and unmount, and on `pagehide`.
- Not included: screen sharing, recording, Conversation Rooms.

### Future Conversation Rooms
A room would later create a call through the same `start_call` and participant lifecycle, with a validated origin column added then. Nothing is built for it now.

## 5. Files expected to change

**New:**
- `supabase/migrations/20261121100000_calls.sql`
- `supabase/functions/{call-token,call-control,livekit-webhook}/index.ts`
- `supabase/functions/_shared/media-provider.ts`
- `src/services/calls.ts`
- `src/services/calls/media.ts`
- `src/store/callStore.ts`
- `src/lib/callState.ts`, a pure reducer that is unit-tested
- `src/pages/app/Call.tsx`
- `src/components/features/call/*`
- `tests/unit/callState.test.ts`
- `scripts/test-calls-e2e.mjs`, using playwright and fake media, local only
- `docs/VIDEO_CALLING.md`, the remaining required documentation

**Modified:**
- `package.json` (2 pinned client deps)
- `src/router/index.tsx`
- `src/components/layout/AppShell.tsx`
- `ChatThread.tsx`, `UserProfile.tsx`
- `src/services/index.ts`
- `src/lib/refusals.ts`
- `src/types/db.ts`
- `_shared/notification-text.ts`, `send-push/index.ts` (call tag), `public/sw.js` (call notification options)
- `supabase/config.toml` (webhook `verify_jwt = false`)
- `supabase/tests/app_flow.sql`
- `scripts/test-security.mjs`
- `.env.example` (`VITE_LIVEKIT_URL` only, which is public)
- `docs/ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`, `TESTING.md`, `FEATURES.md`

**Owner-gated (Phase 7):** `src/pages/public/Privacy.tsx`, `legalVersions.ts`, a legal-documents migration, and `LEGAL_COMPLIANCE.md`.

## 6. Tests

| Existing | To add |
|---|---|
| `test-db.sh` (privileges, RPC contract, app flows) | `app_flow.sql`: state transitions, self-invite, duplicates, capacity 6 and the 7th refused, decline, expiry and cancel blocking a join, an uninvited user, blocks including R2, host transfer, history visibility, the kill switch |
| — | A race for the last slot: two parallel `claim_call_join` sessions through the shim |
| `test:security` | Cross-user RLS on calls and participants, anon refused, Realtime events only reach participants, `call-token` refused for strangers and a guessed room, token grants decoded and checked |
| `test:unit` | `callState` reducer, refusal mapping |
| — | `test-calls-e2e.mjs`: 2, 3 and 6 real accounts in separate browser contexts with fake media, a 7th refused, leave, end and refresh |
| — | Bundle scan: the built `dist/` contains no LiveKit secret or service key |

Manual matrix (§9.2 to 9.4 of the brief) on real devices and networks, recorded in `docs/VIDEO_CALLING.md`.

## 7. External setup needed

1. **A LiveKit Cloud project for development and staging**, separate from any future production project. I need its `LIVEKIT_URL` (wss) and an API key and secret. They go into `supabase/functions/.env` locally (gitignored) and `supabase secrets` later. Configure its webhook URL when testing webhooks: locally this needs a tunnel, or webhooks are exercised with signed test payloads.
2. **Decisions D1 to D6** below.

## 8. Decisions for the owner

| # | Decision | Recommendation |
|---|---|---|
| D1 | Who may be called | Only people you share an **accepted** direct chat with, as in section 4 |
| D2 | Who may add people to a call | The host only |
| D3 | If the host drops | Host passes to the earliest-joined participant, and the call ends when empty |
| D4 | Call history retention | Kept while the account exists, deleted with it, no archive (same as messages) |
| D5 | Development environment | Local Supabase stack plus a separate LiveKit dev project. No hosted changes until Phase 7 |
| D6 | Legal | Privacy v4 naming LiveKit, and a transfer dossier update, before any production release |

**Owner's answer, 21 Nov 2026:**
- **The first release is one-to-one only.** Group calling comes later.
- D1, D4, D5 and D6 are approved as recommended.
- D2 and D3 don't apply yet. The schema stays ready for groups, and `call_settings.max_participants` is 2.
- **End policy for one-to-one calls:**
  - A call ends when fewer than two people remain in it. Either person hanging up ends it.
  - An unexpected disconnect doesn't end the call straight away. The person can rejoin within `empty_grace_seconds`.
- Phase 4 (group) is deferred. Its invite flow, the race for the last slot, and the 6-person tests move to the group release.
