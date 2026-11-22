# Video calling

Private, invitation-only video calls between two people. Audio and video go through LiveKit Cloud. Supabase holds who called whom, the invitations and attendance, and nothing else. **Nothing is recorded.**

The audit and the decisions behind this design are in [Video calling audit](VIDEO_CALLING_AUDIT.md). The original brief is in [the implementation brief](the-fluency-talks-video-calling-implementation%20(1).md).

| | |
|---|---|
| Who can call | Two active learners who share an **accepted** chat, with no block either way. Staff can't call or be called |
| Size | One-to-one (`call_settings.max_participants = 2`). Group calls are the next release |
| Ends when | Either person hangs up; or nobody answers within 45 seconds; or both drop and nobody rejoins within 60 seconds; or 2 hours pass |
| Not included | Recording, screen sharing, group calls, public rooms |

## 1. How it fits together

```
Browser ── rpc ──────────────► Postgres: calls, call_participants (RLS: members only)
   │   ── call-token ────────► Edge Function ─ claim_call_join (as the user) ─► signs a LiveKit token
   │   ── call-control ──────► Edge Function ─ leave_call / end_call ─► closes the LiveKit room
   │   ◄─ Realtime ───────────  call_participants changes (members only)
   └── WebRTC ───────────────► LiveKit Cloud ── signed webhook ──► livekit-webhook ─► attendance
```

| Part | File |
|---|---|
| Schema, rules, sweep | `supabase/migrations/20261121100000_calls.sql` |
| Provider events | `supabase/migrations/20261121100100_call_provider_events.sql` |
| Notifications | `supabase/migrations/20261121100200_call_notifications.sql` |
| Token, hang-up, webhook | `supabase/functions/{call-token,call-control,livekit-webhook}` |
| The only server file that knows it's LiveKit | `supabase/functions/_shared/media-provider.ts` |
| The only browser file that knows it's LiveKit | `src/services/callMedia.ts`, loaded only with the call page |
| Call state and wording (pure, unit-tested) | `src/lib/callState.ts` |
| Screens | `src/pages/app/Call.tsx` (`/call/new?to=…`, `/call/:id`), `src/pages/app/CallHistory.tsx` (`/calls`) |
| Banner and chat button | `src/components/features/call/IncomingCall.tsx` |

**Decisions, and why:**
- **The call is its own record**, not part of a chat. Chats are one-to-one only, and a future Conversation Room can create a call the same way.
- **The token function only signs.** Every decision (identity, call state, invitation, blocks, capacity) is made in `claim_call_join`, under a row lock on the call.
- **Webhooks are the authority on attendance.** The browser's own report only moves its own row.
- **Hanging up closes the LiveKit room**, so every device is disconnected, not just told to leave.
- `livekit-client` 2.23.0 is used directly, without `@livekit/components-react`. It's smaller, and the UI uses the app's own components.

## 1a. On the call screen

| Feature | How it works |
|---|---|
| Incoming call | Covers whatever page is open, rings (Web Audio tones in `src/lib/ringtone.ts`, no files) and vibrates. **Answer** joins at once with camera and microphone on. Browsers allow sound only after one tap on the page, so before that it only vibrates |
| Caller feedback | "Trying to reach…" until the callee's device shows the call (`report_call_ringing` sets `call_participants.rang_at`), then "Ringing…" with a ringback tone. Busy, unavailable, declined, missed and ended each get their own words |
| Layouts | Them in front, me in front, or side by side (stacked on a phone held upright). Tap the small window to swap, drag it (or use the arrow keys) to any corner. Remembered on the device |
| Camera flip | Front or back, shown only when the device has more than one camera |
| Messages | Typed lines sent over the LiveKit data channel to the other person only. Never stored; they disappear when the call ends. 500 characters each |
| Voice waves | Bars follow each person's audio level; the tile outline turns green while they talk |
| Controls | Each button says its state underneath ("Muted", "Camera off"); off is red with a crossed icon, hang up is a wide red button, answer and call are green |
| Video quality | 720p at 24 fps with 180p and 360p simulcast layers, adaptive stream at the screen's pixel density, dynacast, speech audio with DTX and RED |
| Call log | Finished calls appear in the chat with that person (`list_calls_with`) and at `/calls` |

## 2. Database

| Table | What it holds | Client access |
|---|---|---|
| `call_settings` | One row: kill switch, cap, ring time, token lifetime, grace period, call length, failed-join limit | None |
| `calls` | Status, host, timestamps, how it ended, the opaque room name | Select for members, **without `provider_room`** |
| `call_participants` | Invitation and presence per person, with timestamps | Select for members; published to Realtime |
| `call_join_failures` | Refused joins, for the limit. Cleaned after an hour | None |
| `call_webhook_events` | Provider event ids, so each is applied once. Cleaned after 7 days | None |

The status of a call is `ringing`, `active`, `ended`, `cancelled` or `expired`. Its `end_reason` is `hung_up`, `cancelled`, `declined`, `no_answer`, `empty`, `ended_by_host`, `time_limit` or `account_gone`.

**Retention:** call history stays as long as the account exists, like messages, and goes with it. Deleting an account ends any live call it was in. No media and no device identifiers are stored.

## 3. Who can do what

| Function | Who | Notes |
|---|---|---|
| `start_call(p_callee)` | Signed in | Refuses yourself, strangers, blocks, staff, anyone already in a call. Limit: 3 calls to one person in 10 minutes, 30 an hour |
| `respond_call_invite(p_call, p_accept)` | The person invited | Only while pending and ringing |
| `leave_call` / `end_call` | Members / the host | Through `call-control`, which also closes the room |
| `claim_call_join(p_call)` | Members, via `call-token` | Returns refusals instead of raising, so failures are counted (10 per 10 minutes) |
| `report_call_connected` | Members | Moves only your own row |
| `get_call`, `list_live_calls`, `list_call_history` | Members | Blocks hide calls from both sides |
| `apply_call_provider_event` | Service role only | Called by `livekit-webhook` after it checks the signature |

**The token** is scoped to one room and one identity (the user's id from their verified session). It lasts 10 minutes and allows camera, microphone and the room's data channel, which carries the in-call messages (section 1a). It has no admin rights, no recording rights and no room creation. It is never stored, logged or put in a notification.

**Blocks** end any live call between the two people at once (`block_ends_calls` trigger).

## 4. Configuration

| Name | Where | Secret |
|---|---|---|
| `LIVEKIT_URL` | Edge Function secrets (`supabase secrets set`); locally `supabase/functions/.env` | No, but keep it with the others |
| `LIVEKIT_API_KEY` | Same | Yes |
| `LIVEKIT_API_SECRET` | Same | **Yes. Never in `.env` with a `VITE_` prefix** |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Website build | No (already existed) |

The browser gets the LiveKit URL along with its token, so the website needs no new variables.

## 5. LiveKit setup

1. Create a LiveKit Cloud project for each environment, with development separate from production.
2. Copy its URL, API key and secret into the Edge Function secrets (above).
3. **Project settings → Webhooks:** add `https://<project-ref>.supabase.co/functions/v1/livekit-webhook`, signed with the same API key.
4. Set a usage alert in the LiveKit dashboard (see section 11).

**To rotate credentials:** create a new key in LiveKit, `supabase secrets set LIVEKIT_API_KEY=… LIVEKIT_API_SECRET=…`, check one call works, then delete the old key. Tokens last 10 minutes, so calls already connected carry on.

## 6. Deploying the functions

```bash
supabase secrets set --env-file supabase/functions/.env          # LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
supabase functions deploy call-token
supabase functions deploy call-control
supabase functions deploy livekit-webhook --no-verify-jwt          # LiveKit signs it; the function checks
supabase functions deploy send-push --no-verify-jwt                # call notifications: short TTL, call tag
```

Deploy order is the same as always: database, then functions, then the website.

## 7. Local development

```bash
supabase start
supabase migration up --local
supabase functions serve --env-file supabase/functions/.env       # NOT with --no-verify-jwt=false: that breaks the webhook
VITE_SUPABASE_URL=… VITE_SUPABASE_ANON_KEY=… npx vite --port 5199
```

Camera and microphone need HTTPS, or `localhost`. LiveKit can't reach a local webhook without a tunnel, so locally no one is ever marked as dropped. Hang up instead, or wait for the 2-hour cap.

## 8. Testing

| Command | What | Needs |
|---|---|---|
| `npm run test:db` | Lifecycle, eligibility, capacity, blocks, expiry, limits, kill switch, notifications, privileges | Throwaway Postgres |
| `npm run test:unit` | Call state, wording, device errors, notification text | Node |
| `npm run test:security` | Real API and Realtime: members only, no room names, no direct writes, signed-out refused, live updates only to members | Local stack |
| `npm run test:calls` | Who gets a token and what it allows, hang-up, signed webhooks (bad signature, replay, intruder), drop and grace | Local stack + functions + LiveKit dev keys |
| `npm run test:calls:e2e` | Two real Chrome instances: preview, ring, answer, video both ways, mute, camera off, hang-up and release of devices, decline, cancel, refresh and rejoin, camera blocked, tab closed. `ONLY=1,5` runs some rounds | The above + the app on `APP_URL` |

### Results, 21 November 2026 (local stack, LiveKit Cloud dev project)

| Check | Result |
|---|---|
| test:db, test:unit (75), tsc, build, check:seo, check:legal, test:auth | Pass |
| test:security | 30 of 30 pass |
| test:calls | 9 of 9 pass |
| test:calls:e2e rounds 1–4 (answer, video both ways, mute, camera off, hang-up and device release, decline, cancel, refresh and rejoin) | Pass. All 8 checks passed in one full run |
| test:calls:e2e round 5 (camera blocked, sound only, tab closed) | **Blocked by the network.** The camera-blocked message and the sound-only call worked. The "their microphone shows as on" check failed while both browsers lost LiveKit's signalling connection ("ping timeout") |
| Secret scan of the built site | No LiveKit key or secret, no service key. LiveKit code only in the call page's chunk |
| Keyboard and phone layout | Focus stays inside the call screen. Every control has a name, a visible focus ring and `aria-pressed` where it toggles. 44 px controls; no sideways scroll at 360 px |

**Network finding:** from the test machine, LiveKit Cloud took 250–650 ms to open a TCP connection and about 1 s for TLS, against 56 ms for Google. WebRTC negotiation intermittently timed out, and that, not the app, caused the flaky runs. **Test from where your learners are** (Vietnam, Kenya) before launch, and check which LiveKit region serves them.

### Still to do by hand (needs real devices or networks)

- Firefox, Safari (macOS and iOS) and Edge. Only Chrome was automated.
- Phones on mobile data, a hotspot, high latency, packet loss, and a network switch mid-call.
- Push with the tab in the background and with the browser closed, on each platform (see section 10).
- Real LiveKit webhooks on a deployed project: a drop, a rejoin within 60 seconds, and a call ending after the grace period.
- Repeat round 5 of the e2e test on a better network.

## 9. Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Calls are unavailable right now" | `call_settings.calls_enabled` is false, or the functions have no LiveKit secrets |
| "This person is unavailable" | No accepted chat, a block, or a staff account |
| Stuck on "Connecting…" | The network to LiveKit. The browser console shows `NegotiationError` or `ping timeout`. Try another network |
| "Tap to hear …" | The browser blocked sound until a tap (autoplay rules) |
| A call shows "In progress" long after | Webhooks aren't arriving. Check the URL in LiveKit, and `app_logs` where `source = 'edge:livekit-webhook'` (bad signature shows there). Either person can hang up from the banner, and the 2-hour cap ends it anyway |
| Webhook answers 401 locally | `functions serve` was started with `--no-verify-jwt=false` |
| Local Realtime "transport failure" after a reset | `docker restart supabase_kong_fluencytalks` |

## 10. Notifications and their limits

- **Incoming call:** a `call_incoming` notification, always sent (it ignores the category switches), but never to someone who blocked the caller. It also goes out as a web push with a **60-second lifetime**, so a phone that was offline doesn't ring later. The push stays on screen until dealt with.
- **Missed call:** `call_missed`, when an invitation is cancelled or runs out. Answering or declining sends nothing.
- **No duplicates:** each has a dedupe key. The incoming row is deleted as soon as the invitation is answered, so the bell never shows an old ring. A push is skipped while an app tab is focused, because the in-app banner shows instead.
- **In the app:** the banner appears on any page via Realtime, and the tab title changes when the tab is in the background.

**What this can't do, and the app doesn't claim:**
- A closed browser rings only if the browser keeps a push service running. Chrome and Edge on desktop usually do. Firefox needs the browser open.
- On iPhone, push works only for the app added to the Home Screen.
- **There is no ringtone.** A web push is a notification, not a phone call, and browsers don't let a page play sound until someone has tapped it.
- If push is turned off, calling still works whenever the app is open.

## 11. Cost and usage

Calling is free to learners, not to us. LiveKit Cloud charges by participant minutes and bandwidth.

- **Where to look:** the LiveKit Cloud dashboard (Usage, and Sessions for each call), plus `app_logs` sources `edge:call-token`, `edge:call-control` and `edge:livekit-webhook`. The `call_id` in each log line matches LiveKit's room (via `calls.provider_room`).
- **Built-in limits:** 2 people, 2-hour maximum, 45-second ring, 3 calls to one person in 10 minutes, 30 calls an hour, 10 failed joins in 10 minutes, and request rate limits on each function.
- **Suggested alert:** a usage alert in LiveKit at about 70% of your plan's included minutes. Weekly, run `select count(*), sum(extract(epoch from ended_at - started_at))/60 as minutes from calls where started_at > now() - interval '7 days';`.
- **On a spike:** turn calls off (below), look at `calls` grouped by `initiated_by`, then decide whether to lower the limits in `call_settings` or `rate_limit_rules`.

## 12. Operations

**Turn calls off** (provider outage or a cost spike). New calls and joins are refused at once, and nothing else is affected:

```sql
update public.call_settings set calls_enabled = false where id;   -- back on: true
```

**Roll back:**
- *Website:* redeploy the previous Worker version. Old pages don't know the call routes.
- *Functions:* `supabase functions delete call-token call-control livekit-webhook`.
- *Database:* turn calls off first. Then a new migration that drops `call_invite_notify`, `call_participant_gone` and `block_ends_calls`, then the tables `call_webhook_events`, `call_join_failures`, `call_participants`, `calls` and `call_settings` with their functions, restores the old `notifications_type_check`, and deletes the five `rate_limit_rules` rows. Don't edit applied migrations.

## 13. Group calls and Conversation Rooms later

- **Group calls:**
  - raise `max_participants`
  - add `invite_to_call` (host only), using the same lock and block checks as `claim_call_join`
  - check blocks between every pair of people, which is already done when joining
  - add host hand-off when the host drops
  - add the grid layout (the media layer already lists every remote person)
- **Conversation Rooms:** a room creates a call through the same functions. Add a validated origin column then. Nothing in the call lifecycle depends on a chat.
