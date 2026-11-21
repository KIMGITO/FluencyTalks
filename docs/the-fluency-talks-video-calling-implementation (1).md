# The Fluency Talks --- Video Calling Implementation Specification

**Status:** Implementation brief\
**Product scope:** Browser-based one-to-one and group video calling\
**Initial release:** Private, invitation-based calls only\
**Future extension:** Conversation Rooms (explicitly out of scope for
this release)\
**Primary instruction:** Follow this document phase by phase. Inspect
the existing codebase before changing it, implement the feature in the
project's established patterns, and test each phase before proceeding.

------------------------------------------------------------------------

## 1. Objective

Implement reliable, secure, browser-based video calling inside the
existing **The Fluency Talks** application.

Users must be able to start a one-to-one call and invite additional
people to turn it into a group call. Calls are private and
invitation-based. There must be no public room directory, room
discovery, public room creation, scheduled rooms, or open room joining
in this release.

The initial maximum is **6 participants per call, including the
caller**. Keep this limit configurable in one central server-side
configuration location so it can be changed without rewriting call
logic.

Calling is free to users at launch. This does **not** mean
infrastructure usage is unlimited or free to the business. Add usage
visibility, sensible safeguards, and cost monitoring.

## 2. Non-negotiable working rules

1.  **Audit before implementation.** Do not assume the current schema,
    routes, messaging model, notification provider, authentication flow,
    deployment setup, or component conventions. Inspect the repository
    and document what actually exists.
2.  **Preserve existing functionality.** Do not break messaging,
    authentication, profiles, language settings, proficiency levels,
    notifications, or existing navigation.
3.  **Do not duplicate existing infrastructure.** Reuse existing user
    identities, notification mechanisms, design tokens, UI components,
    and established service patterns where appropriate.
4.  **Do not invent data or schema.** Verify table names, column names,
    relationships, RLS policies, Edge Functions, environment variables,
    and migrations before using them.
5.  **No secrets in the browser.** LiveKit API secret, service-role
    credentials, and other privileged keys must only exist in trusted
    server-side environments.
6.  **Server-side authorization is authoritative.** Hiding a button or
    route in React is not security.
7.  **Use migrations.** All database changes must be version-controlled,
    repeatable, reviewed, and documented. Never make undocumented
    production-only schema changes.
8.  **Test continuously.** After each phase, run the relevant tests and
    checks, fix failures, and record evidence before moving forward.
9.  **Do not skip failing tests.** Do not silence TypeScript errors,
    disable lint rules, weaken RLS, remove tests, or use broad `any`
    types merely to make checks pass.
10. **Do not claim a test passed unless it was actually run.** Record
    command, result, environment, and any limitation.
11. **Do not deploy to production or modify production data without
    explicit authorization.** Use a local or designated staging
    environment for implementation and testing.
12. **Do not add call recording.** Recording is excluded from this
    release. Do not capture or store audio/video.
13. **Do not implement Conversation Rooms now.** Keep the call model
    extensible, but do not build room browsing, public rooms, room
    schedules, or room administration.
14. Work in small, reviewable changes. Avoid unrelated refactors.
15. If a requirement conflicts with the current architecture, explain
    the conflict and propose the safest compatible solution before
    making a risky change.

## 3. Required initial repository audit

Before editing files, inspect and report:

### 3.1 Application structure

-   Framework, build tool, TypeScript configuration, package manager,
    and scripts.
-   Routing and navigation conventions.
-   Existing design system, responsive layout patterns, and reusable
    components.
-   Current web deployment and Cloudflare configuration.
-   Existing test tools and CI checks.

### 3.2 Authentication and user data

-   Supabase client initialization and authentication lifecycle.
-   How the currently authenticated user is identified.
-   Profile table and user display-name/avatar fields.
-   Account status, blocking, reporting, and moderation mechanisms, if
    present.
-   Any existing restrictions on who may contact or interact with whom.

### 3.3 Messaging and notifications

-   Existing one-to-one and group messaging capabilities.
-   How conversations and conversation participants are represented.
-   Existing message permissions and RLS policies.
-   Existing in-app, browser push, email, or other notification
    mechanisms.
-   Whether notifications work when the browser tab is inactive or
    closed.
-   Existing notification preferences and permission-request UX.

### 3.4 Database and backend

-   Existing migrations and migration conventions.
-   Existing Supabase Edge Functions and deployment configuration.
-   Existing RLS policies, database functions, triggers, and indexes.
-   Existing audit/logging conventions.
-   Existing environment variable handling and secret management.

### 3.5 Audit deliverable

Create or update a technical audit document at an appropriate existing
documentation location. Include: - Relevant existing files and
components. - Relevant existing tables, columns, policies, and
functions. - Existing functionality that can be reused. - Gaps and
risks. - Proposed integration design. - Exact files expected to
change. - Tests available and tests that need to be added.

Do not begin feature implementation until this audit is complete.

## 4. Product behaviour and call lifecycle

### 4.1 Starting a call

-   An authenticated, eligible user can start a call from an appropriate
    existing messaging or user interaction surface.
-   The caller can start with one recipient and add more invitees,
    subject to the participant limit.
-   Only users who are eligible to interact under existing platform
    rules can be invited.
-   Prevent inviting oneself.
-   Prevent duplicate invitations and duplicate active membership.
-   Check block relationships and any existing safety restrictions
    before inviting.
-   Show a clear pre-call state with camera/microphone preview and
    device controls where supported.
-   Explain browser permission requirements clearly.

### 4.2 Invitations

-   Invitees receive an incoming-call invitation through the existing
    notification infrastructure where technically supported.
-   Show caller identity and the relevant call context without exposing
    a join token.
-   Invitees can accept or decline.
-   The caller can cancel an invitation.
-   Invitations expire after a configurable period.
-   A declined, expired, or cancelled invitation cannot be used to join.
-   Repeated invitations must be rate-limited.
-   Do not assume browser push can wake a closed browser on every
    device. Clearly distinguish in-app notifications from push
    notifications and document platform limitations.

### 4.3 Joining

-   Only the caller and explicitly invited, authorized participants may
    join.
-   The backend must verify the authenticated identity, call status,
    invitation state, expiry, ban/block restrictions, and participant
    capacity before issuing a media token.
-   A participant must not be able to join by guessing a provider room
    name or reusing another user's token.
-   Recheck capacity safely under concurrent join attempts. Use a
    database transaction or an equivalent atomic server-side mechanism;
    do not rely on a frontend count.
-   Tokens must be scoped to the specific provider room and user
    identity, with only the minimum required grants.
-   Do not issue tokens for ended, cancelled, expired, or unauthorized
    calls.

### 4.4 During a call

Provide: - Responsive participant video layout. - Microphone
mute/unmute. - Camera on/off. - Device selection where supported by the
browser and SDK. - Participant list and clear participant identity. -
Connection/reconnection state. - Clear error states for permission
denial, unavailable devices, unsupported browsers, and network
failure. - Leave-call action. - Host/caller controls for ending the call
and, if included, removing a participant. - A visible distinction
between leaving a call and ending it for everyone.

Do not promise screen sharing in the initial release unless it is
explicitly approved after the audit. Do not implement recording.

### 4.5 Ending and history

-   A participant leaving updates their participant state and leave
    timestamp.
-   A call ends when the authorized caller/host ends it, or when the
    system's documented empty-call/timeout policy applies.
-   Handle the caller disconnecting unexpectedly. Define and test how
    host responsibility is transferred or how the call is safely ended.
-   Persist call start/end times and participant attendance.
-   Display call history only to users who participated or are otherwise
    authorized.
-   Do not store media recordings.
-   Avoid exposing private call details to unrelated users.

## 5. Architecture requirements

### 5.1 Media provider

Use **LiveKit** as the initial media provider, subject to the repository
audit and a final compatibility check against current LiveKit
documentation.

-   Use the official, currently supported LiveKit client SDK for
    React/browser integration.
-   Use LiveKit Cloud initially unless the audit identifies a compelling
    reason otherwise.
-   Do not self-host the SFU in this release.
-   Keep provider-specific operations behind a small service boundary so
    the provider could be replaced later without rewriting call
    lifecycle and UI logic.
-   Do not send audio/video through Supabase Realtime or store media in
    Supabase.
-   Use the provider's documented connection, participant, track, and
    reconnection lifecycle APIs. Do not invent SDK methods.

### 5.2 Supabase responsibilities

Use Supabase for: - User authentication and authorization. - Call
metadata and lifecycle state. - Participant invitations and membership
state. - Call history. - Rate limits and abuse controls where
appropriate. - Secure Edge Functions for privileged operations. -
Webhook processing, if supported by the chosen provider integration.

Supabase is not the media transport layer.

### 5.3 Suggested logical data model

Treat these as **logical requirements, not permission to create
blindly**. First compare with existing schema and naming conventions.
Adapt names and relationships to the actual project.

#### Calls

Potential fields: - `id` - `call_type` (`direct` or `group`) -
`initiated_by` - `status` (for example: `ringing`, `active`, `ended`,
`cancelled`, `expired`) - `provider` (initially `livekit`) -
`provider_room_id` (opaque, non-secret identifier) -
`max_participants` - `created_at` - `started_at` - `ended_at` -
`end_reason` where useful

#### Call participants

Potential fields: - `id` - `call_id` - `user_id` - `role` (for example:
`caller`, `participant`, `moderator` only if required) -
`invitation_status` (`pending`, `accepted`, `declined`, `cancelled`,
`expired`) - `participant_status` (`invited`, `joining`, `joined`,
`left`, `removed`) - `invited_at` - `responded_at` - `joined_at` -
`left_at`

Use appropriate foreign keys, unique constraints, indexes, timestamps,
and deletion behaviour. Avoid storing unnecessary personal data. Decide
whether to retain historical participant rows when accounts are deleted
in accordance with existing data-retention rules.

### 5.4 Future Conversation Rooms compatibility

The initial implementation must not contain a `conversation_rooms`
feature. It should, however, avoid making the call lifecycle depend on a
messaging conversation ID.

Keep the call entity independently addressable. If useful, use a
generic, validated call origin/context field only when it has a real
present requirement; do not introduce speculative polymorphic foreign
keys or unnecessary abstractions.

Later, a Conversation Room can create or reference a call through the
same call service and participant lifecycle. Document this extension
point. Do not build it now.

## 6. Backend and security requirements

Implement the smallest set of secure server-side operations needed.
Names are examples; follow existing project conventions.

Potential operations: - Start a call. - Invite participants. - Accept or
decline an invitation. - Cancel an invitation. - Join a call / issue a
LiveKit token. - Leave a call. - End a call. - Remove a participant, if
host moderation is included. - Process provider webhooks, if needed.

For every operation: - Authenticate the caller using the verified
Supabase session. - Derive the acting user ID from the verified session,
never from a client-supplied user ID. - Validate all input with strict
schemas. - Verify authorization and current state server-side. - Apply
rate limits where appropriate. - Return safe, structured errors. - Avoid
logging access tokens, secrets, or sensitive payloads.

### RLS and database rules

-   Enable RLS on new user-accessible tables.
-   Users may only read call records and participant information they
    are authorized to see.
-   Users must not be able to self-assign caller/host roles.
-   Users must not be able to update privileged call status or provider
    identifiers directly.
-   Users must not be able to create their own invitations for another
    user.
-   Users must not be able to alter participant counts or bypass
    capacity.
-   Use server-side functions for privileged state transitions.
-   Review policies for both authenticated and anonymous roles.
-   Test cross-user access explicitly.

### LiveKit token security

-   API key and secret exist only in Edge Function/server secrets.
-   Never expose the LiveKit secret, Supabase service-role key, or
    privileged credentials in Vite environment variables or client
    bundles.
-   Generate short-lived tokens with room-specific grants.
-   Use a server-generated, stable, non-impersonable participant
    identity tied to the authenticated user.
-   Restrict publishing/subscribing permissions according to actual
    product needs.
-   Do not allow arbitrary room creation or arbitrary room joining from
    the client.
-   Validate provider webhooks using the documented
    signature-verification mechanism.
-   Never trust client-reported provider events as authoritative proof
    of another user's identity.

### Abuse and privacy protections

-   Rate-limit call creation, invitations, token issuance, and repeated
    failed joins.
-   Enforce existing block relationships.
-   Provide report/block flows using existing platform mechanisms where
    possible.
-   Avoid revealing whether a private user account exists through overly
    detailed errors.
-   Do not record calls.
-   Request camera/microphone permissions only when the user is about to
    use them.
-   Explain why permissions are needed.
-   Do not turn on camera or microphone unexpectedly.
-   Ensure camera and microphone tracks are stopped when leaving,
    ending, or abandoning a call.
-   Avoid retaining device identifiers or media metadata unnecessarily.

## 7. Frontend and UX requirements

Follow the existing Fluency Talks visual system. Do not introduce a
separate visual identity.

The interface must: - Feel like a polished, deliberately designed
language-learning product. - Work on desktop and mobile browsers. -
Respect existing typography, colours, spacing, iconography, and
component conventions. - Avoid excessive borders, oversized rounded
cards, excessive padding, decorative gradients, and generic AI-looking
UI. - Use the project's existing icons; do not use emoji as interface
icons. - Include loading, empty, success, permission-denied, offline,
reconnecting, and error states. - Be keyboard accessible and provide
visible focus states. - Have accessible labels for camera/microphone
controls. - Prevent accidental call termination with an appropriate
confirmation where necessary. - Keep call controls usable at narrow
viewport widths.

Expected UI states: 1. Idle / call action available. 2. Pre-call device
preview. 3. Outgoing call / ringing. 4. Incoming call. 5. Accepting /
connecting. 6. Active call. 7. Reconnecting. 8. Participant joined/left.
9. Permission denied or device unavailable. 10. Call ended. 11.
Missed/declined/expired call. 12. Failed to join with retry guidance.

Do not build an entirely new messaging interface. Integrate call actions
into the existing application at the most natural existing locations
identified during the audit.

## 8. Notifications

Audit and reuse the current notification system.

Support, where the current platform allows: - Incoming call. - Missed
call. - Invitation declined or expired, if useful. - Participant
joined/left only as in-app updates where appropriate.

Requirements: - Do not create duplicate notifications when both realtime
and push channels report the same event. - Make notification actions
validate the user's authorization again on the server. - Never put
LiveKit tokens or secrets in notification payloads. - Handle
notification permission denial gracefully. - Do not claim that a closed
browser will always ring. Document actual browser/OS push limitations. -
Test active tab, background tab, and closed browser separately where
supported.

## 9. Testing strategy --- mandatory

Testing is part of implementation, not a final optional activity.
Complete and document tests after each phase.

### 9.1 Automated checks

Use the project's existing tools. Add appropriate tests for: - Call
state transitions. - Invitation validation and expiry. - Participant
capacity. - Duplicate invitation prevention. - Self-invitation
prevention. - Authorization and block rules. - Token endpoint
authorization. - RLS isolation. - Call history visibility. - Error
handling. - UI state transitions.

Run and record: - TypeScript type check. - Lint. - Unit tests. -
Integration tests. - Production build. - Any existing project-wide
checks.

Do not invent package scripts. Inspect `package.json` and use the real
scripts.

### 9.2 Required manual test matrix

Test with separate authenticated accounts and separate browser
profiles/devices. Do not simulate every participant using the same
logged-in browser session.

  -----------------------------------------------------------------------
  Scenario                            Expected result
  ----------------------------------- -----------------------------------
  Two users start and accept a call   Both connect and exchange
                                      audio/video

  Invite a third user                 Third user receives invitation and
                                      can join

  Invite up to six total participants All authorized participants can
                                      join

  Attempt to add a seventh            Server rejects it safely
  participant                         

  Invite the same user twice          Duplicate invitation is prevented

  Invite yourself                     Rejected

  Decline invitation                  Declined user cannot join

  Expired invitation                  Cannot be accepted or used

  Cancel invitation                   Cancelled user cannot join

  Uninvited user guesses call ID      Cannot obtain token or join

  User guesses provider room name     Cannot join

  User attempts another user's        Rejected
  identity                            

  User is blocked                     Existing platform block rules are
                                      enforced

  Camera permission denied            Clear message; audio-only path if
                                      supported

  Microphone permission denied        Clear message and recovery guidance

  No camera attached                  Call can proceed without camera if
                                      supported

  Device disconnected mid-call        Recoverable error/reconnection
                                      state

  Network temporarily drops           Reconnect or fail gracefully

  User refreshes the page             No duplicate membership or invalid
                                      state

  Caller closes browser               Defined host-transfer/end policy
                                      works

  Participant leaves                  Other participants remain connected

  Host ends call                      Everyone is disconnected and call
                                      is finalized

  All participants leave              Call finalizes according to
                                      documented policy

  User opens call history             Only authorized history is visible

  Browser tab is backgrounded         UI and notifications behave as
                                      documented

  Browser push is denied              In-app calling remains usable

  Two users race to join the final    Capacity is never exceeded
  slot                                

  Webhook is replayed or has invalid  Rejected or handled idempotently
  signature                           
  -----------------------------------------------------------------------

### 9.3 Browser coverage

Test the browsers that the existing product officially supports. At
minimum assess current desktop Chrome, Firefox, and Edge, plus Safari if
the product supports it. Test mobile browser layouts and device
permissions separately.

Do not claim universal browser support based on one browser.

### 9.4 Real-network testing

Test: - Good Wi-Fi. - Mobile hotspot. - High latency. - Packet loss or
unstable connectivity. - Temporary network interruption. - Different
network types between participants.

Use provider diagnostics and browser WebRTC diagnostics where available.
Do not expose diagnostic data publicly if it contains sensitive
information.

### 9.5 Load and cost tests

-   Confirm the six-participant limit.
-   Test multiple simultaneous calls in staging.
-   Measure participant minutes and data usage.
-   Inspect provider usage dashboards.
-   Add operational alerts or documented thresholds.
-   Do not run expensive load tests against production without approval.

## 10. Cloudflare and deployment

The production web application is intended to use **Cloudflare**, not
Vercel.

Audit the actual deployment target and current Cloudflare setup. Do not
assume Pages or Workers without inspecting the project.

-   Ensure browser SDK dependencies are compatible with the existing
    build and Cloudflare runtime.
-   Keep secrets in the correct Supabase/server secret store, not in
    client-side Cloudflare build variables.
-   Confirm HTTPS in production because browser camera/microphone APIs
    require a secure context, except for localhost development.
-   Verify allowed origins, CORS, redirect URLs, and authentication
    callbacks.
-   Confirm the LiveKit endpoint is reachable from supported client
    browsers.
-   Confirm Supabase Edge Functions are deployed and configured
    separately from the Cloudflare frontend.
-   Document staging and production environment variables without
    recording secret values.
-   Never commit `.env` files or secrets.

## 11. Observability and operational readiness

Add useful, privacy-conscious logs and metrics for: - Call creation
attempts and outcomes. - Invitation delivery and response. - Token
issuance success/failure. - Join/leave events. - Call duration. -
Participant counts. - Connection failures and reconnection rates. -
Provider webhook failures. - Rate-limit triggers. - Provider usage and
cost.

Use correlation IDs so a failed call can be investigated across backend
and provider logs. Never log media, access tokens, API secrets, or
unnecessary personal data.

Document: - Where to inspect LiveKit usage and diagnostics. - Where to
inspect Supabase Edge Function logs. - How to rotate provider
credentials. - How to disable new calls safely if the provider has an
outage. - How to roll back database and application changes. - How to
respond to unexpected usage/cost spikes.

## 12. Documentation deliverables

Create or update documentation using the project's existing
documentation conventions.

Required: 1. Architecture and component overview. 2. Database schema and
migration notes. 3. RLS and authorization explanation. 4. Environment
variable names and configuration instructions (never values of secrets).
5. LiveKit project setup and credential configuration. 6. Edge Function
deployment instructions. 7. Local development instructions. 8. Staging
and production deployment instructions. 9. Manual test checklist and
results. 10. Known browser and notification limitations. 11. Cost/usage
monitoring instructions. 12. Troubleshooting guide. 13. Future
Conversation Rooms extension notes.

Document important decisions and their reasons. Keep documentation
synchronized with the implementation.

## 13. Phased execution and stop/go gates

Execute the following phases in order. Do not jump ahead.

### Phase 0 --- Audit and plan

-   Inspect the repository and current production architecture.
-   Produce the audit and proposed file-change list.
-   Identify missing credentials or external setup.
-   Identify risks and resolve architecture decisions.

**Gate:** No code changes until the audit is reviewed and the
implementation plan is internally consistent.

### Phase 1 --- Data model and authorization

-   Create reviewed migrations.
-   Add constraints and indexes.
-   Implement RLS.
-   Implement secure call state transitions.
-   Add tests for authorization and capacity.

**Gate:** Migrations apply cleanly in the designated development
environment. RLS and authorization tests pass.

### Phase 2 --- LiveKit integration

-   Configure provider in a non-production environment.
-   Add secure token generation.
-   Implement provider service boundary.
-   Add webhook verification/idempotency if webhooks are used.
-   Test token scope and expiry.

**Gate:** Authorized users can obtain valid scoped tokens; unauthorized
users cannot. No secret is present in the browser bundle.

### Phase 3 --- One-to-one calling

-   Build pre-call preview.
-   Implement outgoing/incoming call states.
-   Implement accept/decline/cancel.
-   Connect two authenticated users.
-   Implement leave/end and cleanup.

**Gate:** Two real accounts can complete repeated calls. Permissions,
refresh, disconnection, and cleanup tests pass.

### Phase 4 --- Group calling

-   Add invite-more-participants flow.
-   Enforce six-participant maximum server-side.
-   Handle concurrent joins.
-   Implement participant grid and participant list.
-   Implement host/caller controls and host-disconnect policy.

**Gate:** Three or more real accounts can join the same call. Capacity
and authorization tests pass, including simultaneous join attempts.

### Phase 5 --- Notifications and history

-   Integrate incoming/missed-call notifications.
-   Implement history and attendance.
-   Prevent duplicate notification events.
-   Test foreground/background/closed-browser behaviour as supported.

**Gate:** Notification and history tests pass. Browser limitations are
documented accurately.

### Phase 6 --- Security, reliability, and UX hardening

-   Complete abuse controls.
-   Complete accessibility and responsive checks.
-   Complete browser/network test matrix.
-   Verify media cleanup and privacy.
-   Review logging and observability.

**Gate:** No unresolved critical or high-severity security issue. All
mandatory tests are passed or explicitly documented as blocked with an
approved mitigation.

### Phase 7 --- Staging release and production readiness

-   Deploy to staging only.
-   Run the full regression suite.
-   Verify Cloudflare, Supabase, LiveKit, HTTPS, origins, and secrets.
-   Review provider usage and cost.
-   Produce a production-readiness report and rollback plan.

**Gate:** Do not deploy to production until the owner explicitly
approves the release.

## 14. Definition of done

The feature is not complete merely because a video appears on screen.

It is complete only when: - A user can start a private one-to-one
call. - The caller can invite additional eligible users. - Authorized
participants can accept and join. - The six-person limit is enforced
server-side. - Unauthorized users cannot join or obtain tokens. - Camera
and microphone controls work. - Calls recover gracefully from ordinary
network interruptions. - Leaving and ending calls clean up media tracks
and server state. - Call history and participant attendance are
accurate. - Notifications behave as documented. - Existing messaging and
platform features still work. - RLS, automated tests, manual tests, and
production build checks pass. - Cloudflare deployment and
Supabase/LiveKit configuration are documented. - Usage and cost can be
monitored. - No recording or public Conversation Rooms have been
introduced. - Future Conversation Rooms can reuse the call lifecycle
without replacing it.

## 15. Required phase report format

At the end of every phase, provide this report:

``` text
PHASE:
STATUS: PASS / BLOCKED / FAIL

WHAT WAS INSPECTED:
- ...

WHAT WAS IMPLEMENTED:
- ...

FILES CREATED:
- ...

FILES MODIFIED:
- ...

DATABASE CHANGES:
- ...

SECURITY CHANGES:
- ...

TESTS RUN:
- Command:
  Result:
  Evidence:

MANUAL TESTS:
- Scenario:
  Result:
  Evidence:

KNOWN ISSUES:
- ...

EXTERNAL ACTIONS REQUIRED:
- ...

ROLLBACK NOTES:
- ...

NEXT PHASE:
- ...
```

A phase is `PASS` only when its gate is satisfied. If blocked, state
exactly what is missing and stop before proceeding to dependent work.

## 16. Final instruction to Claude Code

Work as a careful senior engineer taking responsibility for an existing
production application.

Start with **Phase 0 only**. Inspect the repository, produce the audit,
and propose the implementation plan. Do not immediately install
packages, create migrations, edit application code, or deploy anything.

After Phase 0, proceed phase by phase, testing and reporting at every
gate. Preserve existing functionality and follow the actual repository
architecture rather than forcing a generic implementation onto it.

The first release is private, invitation-based one-to-one and group
video calling on the web, free to users, with a maximum of six
participants per call. Public Conversation Rooms are a future extension
only.
