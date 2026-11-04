# App-wide rules

Four behaviours hold on every screen. Follow them whenever you add a form, an overlay or an error.

## 1. No backend or crash text on screen

Only messages we wrote can reach a user. Database, network and auth errors become a generic line such as "Something went wrong. Please try again."

- `UserError` in `src/lib/errors.ts` is the only error that speaks for itself.
- `userMessage(e, fallback)` turns anything else into a generic line. **A friendly message thrown with plain `new Error()` is hidden, so throw `UserError`.**
- `ApiError` extends `UserError`, and `src/lib/api.ts` maps known database errors to safe messages.
- `friendlyAuthError` in `src/lib/authHelpers.ts` falls back to a generic line and never shows raw text.
- `RouteError` replaces React Router's stack-trace page. There are boundaries at the root and inside `AppShell` and `AdminLayout`, so navigation survives a crash.
- The real error still goes to the admin Logs page through `reportClientError`.
- **Failed database requests are captured at the network layer.** `src/lib/supabase.ts` watches every response, including calls whose code ignores the error, and `failureReport` in `src/lib/refusals.ts` decides what staff should read. Planned refusals like `rate_limited` aren't logged. Anything else is, without the query or `details`, as they can hold what someone typed.
- **Every refusal has words.** A new `raise exception` needs a line in `REFUSALS` (`src/lib/refusals.ts`), or a place on the list of internal codes in `tests/unit/refusals.test.ts`. The test fails otherwise.
- **Nothing uncaught goes silent.** An unhandled failure shows an "Oops!" toast, at most one every 30 seconds so background work can't nag. `CrashBoundary` catches a crash outside any route.
- **Edge functions** put details in `app_logs` and reply with a code, never with the database's text.
- **Not captured:** failures before someone logs in, because `log_client_error` needs a signed-in user. They still show a friendly message.

## 2. No browser validation

The browser's own "Please fill out this field" bubbles are never used.

- Every `<form>` has `noValidate`.
- `Input` and `Textarea` reject `required`, `minLength`, `min`, `max` and `pattern` at compile time, and enforce `maxLength` in code. Raw fields use `limitLength`.
- Checks live in `src/lib/validate.ts`: `checkText`, `checkEmail`, `checkPassword`, `checkUsername`, `checkWholeNumber` and `firstProblem`.
- `tests/unit/noNativeValidation.test.ts` fails if any of this comes back.

## 3. Data is checked before it reaches the database

- Forms check their fields before sending.
- `rpc()` runs `cleanArgs` on every call. It removes NUL and control characters and broken surrogates, and refuses `NaN` and `Infinity`.
- **Text is cleaned with `cleanText`, and never HTML-escaped.** It travels as JSON parameters and React escapes it on screen, so escaping would store `don&#39;t`. Server search already escapes LIKE wildcards.
- Stored blog bodies only render through the allow-list in `src/lib/blogHtml.ts`.
- Client checks can be bypassed by calling the API directly, so **the database stays the authority**: `CHECK` constraints and function checks are what really enforce limits. Form limits must never be higher than the database's.

## 4. Phone keyboard

`src/lib/keyboard.ts` handles this for the whole app, started from `src/main.tsx`.

- The field being typed in moves into the space left above the keyboard.
- When the keyboard closes, the page returns to where it was. If the person scrolled by hand while typing, the page stays where they scrolled.
- It sets `--ft-vv-top`, `--ft-vv-bottom` and `--ft-kb`, and the `html.ft-keyboard` class.
- **A new full-screen overlay holding a field needs the `ft-overlay` class.**
- **A fixed bottom bar needs `ft-hide-on-keyboard`.**
- **Scrolls must use `behavior: 'instant'`,** because public pages set smooth scrolling in CSS.
- Small fields are forced to 16px on touch screens, because iPhones zoom into anything smaller.
- In chat, `ChatThread` keeps the newest messages in place when the list height changes.

**Testing limit.** So far this has only been tested with a simulated keyboard in phone-sized Chrome. It still needs checking on a real iPhone and Android phone, especially the chat screen, which hasn't been tested in a browser at all.

## Home feed

Home mixes posts and people and opens with posts. The rules are in [Features](FEATURES.md#5-home-feed-and-matching), the code is in `src/lib/feedMix.ts`, and `tests/unit/feedMix.test.ts` covers it.
